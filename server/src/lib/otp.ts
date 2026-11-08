import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma.js";
import { sendSms, smsConfigured } from "./sms.js";
import { getSettings } from "./settings.js";
import { ValidationError } from "./validation.js";

// One-time SMS codes for proving a customer owns a phone number.
export type OtpPurpose = "REGISTER" | "RESET_PASSWORD";

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;
const MAX_PER_HOUR = 5;

function hashCode(phone: string, code: string) {
  const secret = process.env.JWT_SECRET ?? "dev-secret";
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

// Without an SMS provider outside production, the code is returned to the
// browser so sign-up can be tested. In production it never is.
export function otpTestMode() {
  return !smsConfigured() && process.env.NODE_ENV !== "production";
}

export async function requestOtp(phone: string, purpose: OtpPurpose) {
  if (!smsConfigured() && process.env.NODE_ENV === "production") {
    throw new ValidationError(
      "We can't send verification codes right now. You can still order as a guest.",
      503,
    );
  }

  const now = Date.now();
  const recent = await prisma.phoneVerification.findMany({
    where: { phone, purpose, createdAt: { gte: new Date(now - 60 * 60_000) } },
    orderBy: { createdAt: "desc" },
  });

  if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_SECONDS * 1000) {
    throw new ValidationError("Please wait a minute before asking for another code.", 429);
  }
  if (recent.length >= MAX_PER_HOUR) {
    throw new ValidationError("Too many codes requested for this number. Please try again in an hour.", 429);
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  // Older unused codes stop working once a new one is sent.
  await prisma.phoneVerification.updateMany({
    where: { phone, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.phoneVerification.create({
    data: { phone, purpose, codeHash: hashCode(phone, code), expiresAt: new Date(now + CODE_MINUTES * 60_000) },
  });

  const { storeName } = await getSettings();
  const action = purpose === "REGISTER" ? "create your account" : "reset your password";
  const result = await sendSms(
    phone,
    `${code} is your ${storeName} code to ${action}. It expires in ${CODE_MINUTES} minutes. Never share it with anyone.`,
    null,
    { logAs: `Verification code to ${action} (code hidden)` },
  );

  if (result.status === "FAILED") {
    throw new ValidationError("We couldn't send the code. Check the number and try again.", 502);
  }

  return { expiresInMinutes: CODE_MINUTES, testCode: otpTestMode() ? code : undefined };
}

// Checks the code and marks it used. Throws a ValidationError when wrong.
export async function consumeOtp(phone: string, purpose: OtpPurpose, code: unknown) {
  const entered = typeof code === "string" ? code.replace(/\s/g, "") : "";
  if (!/^\d{6}$/.test(entered)) throw new ValidationError("Enter the 6-digit code we sent by SMS.");

  const record = await prisma.phoneVerification.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw new ValidationError("This code has expired. Ask for a new one.");
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    throw new ValidationError("Too many wrong attempts. Ask for a new code.");
  }

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode(phone, entered), "hex");

  if (!timingSafeEqual(expected, actual)) {
    await prisma.phoneVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_ATTEMPTS - record.attempts - 1;
    throw new ValidationError(left > 0 ? `Wrong code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Ask for a new code.");
  }

  // Conditional update so one code can't be used twice in parallel.
  const used = await prisma.phoneVerification.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (used.count !== 1) throw new ValidationError("This code has already been used. Ask for a new one.");
}
