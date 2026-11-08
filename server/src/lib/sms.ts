import { prisma } from "./prisma.js";

// SMS through Africa's Talking (https://africastalking.com).
// Configure in server/.env:
//   AT_USERNAME=your_username   ("sandbox" uses the test environment)
//   AT_API_KEY=your_api_key
//   AT_SENDER_ID=VANAMART       (optional, must be approved by Africa's Talking)
// Without these, messages are recorded as SKIPPED and nothing is sent, so the
// rest of the shop keeps working.

export function smsConfigured() {
  return Boolean(process.env.AT_USERNAME && process.env.AT_API_KEY);
}

// Convert a Ugandan number to +256XXXXXXXXX, or return null if invalid.
export function toInternationalPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/[\s\-()]/g, "");
  if (/^\+256\d{9}$/.test(digits)) return digits;
  if (/^256\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+256${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `+256${digits}`;
  return null;
}

interface SmsResult {
  status: "SENT" | "FAILED" | "SKIPPED";
  providerMessageId?: string;
  error?: string;
}

async function sendViaAfricasTalking(to: string, message: string): Promise<SmsResult> {
  const username = process.env.AT_USERNAME!;
  const base =
    username === "sandbox"
      ? "https://api.sandbox.africastalking.com"
      : "https://api.africastalking.com";

  const body = new URLSearchParams({ username, to, message });
  if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);

  const response = await fetch(`${base}/version1/messaging`, {
    method: "POST",
    headers: {
      apiKey: process.env.AT_API_KEY!,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  const result = (await response.json().catch(() => null)) as {
    SMSMessageData?: { Recipients?: Array<{ status?: string; messageId?: string }>; Message?: string };
  } | null;

  const recipient = result?.SMSMessageData?.Recipients?.[0];

  if (response.ok && recipient?.status === "Success") {
    return { status: "SENT", providerMessageId: recipient.messageId };
  }

  return {
    status: "FAILED",
    error:
      recipient?.status ??
      result?.SMSMessageData?.Message ??
      `HTTP ${response.status}`,
  };
}

// Send one SMS and log it. Never throws.
export async function sendSms(
  phone: string | null | undefined,
  message: string,
  orderId?: string | null,
  options: { logAs?: string } = {},
) {
  const to = toInternationalPhone(phone);
  let result: SmsResult;

  if (!to) {
    result = { status: "FAILED", error: "Invalid phone number" };
  } else if (!smsConfigured()) {
    result = { status: "SKIPPED", error: "SMS provider not configured" };
  } else {
    try {
      result = await sendViaAfricasTalking(to, message);
    } catch (error) {
      result = {
        status: "FAILED",
        error: error instanceof Error ? error.message : "SMS request failed",
      };
    }
  }

  try {
    await prisma.notification.create({
      data: {
        orderId: orderId ?? null,
        channel: "SMS",
        recipient: to ?? String(phone ?? ""),
        // logAs keeps secrets such as one-time codes out of the log.
        message: options.logAs ?? message,
        status: result.status,
        provider: smsConfigured() ? "africastalking" : null,
        providerMessageId: result.providerMessageId ?? null,
        error: result.error ?? null,
      },
    });
  } catch (error) {
    console.error("Could not log notification:", error);
  }

  if (result.status === "FAILED") {
    console.warn(`SMS to ${to ?? phone} failed: ${result.error}`);
  }

  return result;
}
