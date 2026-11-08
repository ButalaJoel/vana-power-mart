import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireCustomer, signCustomerToken, type CustomerRequest } from "../middleware/customerAuth.js";
import { ValidationError, readText } from "../lib/validation.js";
import { sendError } from "../lib/http.js";
import { normalisePhone } from "./orders.js";
import { limitCustomerLogin, limitOtp, limitRegister } from "../middleware/rateLimits.js";
import { consumeOtp, requestOtp, type OtpPurpose } from "../lib/otp.js";

// Customer accounts (optional: guest checkout still works) and the admin
// customer list.
const customersRouter = Router();

function readPassword(value: unknown) {
  if (typeof value !== "string" || value.length < 8 || value.length > 200) {
    throw new ValidationError("Password must be at least 8 characters.");
  }
  return value;
}

function readEmail(value: unknown) {
  const email = readText(value, "Email", { max: 200 });
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("Enter a valid email address.");
  return email.toLowerCase();
}

function profile(customer: { id: string; firstName: string; lastName: string; phone: string; email: string | null }) {
  return { id: customer.id, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone, email: customer.email };
}

// POST /api/customers/otp — { phone, purpose: "REGISTER" | "RESET_PASSWORD" }
// Sends a 6-digit code by SMS. The response is the same whether or not an
// account exists for a reset, so the endpoint can't be used to find accounts.
customersRouter.post("/otp", limitOtp, async (req, res) => {
  try {
    const phone = normalisePhone(req.body?.phone);
    const purpose: OtpPurpose = req.body?.purpose === "RESET_PASSWORD" ? "RESET_PASSWORD" : "REGISTER";

    if (purpose === "REGISTER") {
      const existing = await prisma.customer.findUnique({ where: { phone } });
      if (existing?.passwordHash) {
        throw new ValidationError("An account with this phone number already exists. Please log in.", 409);
      }
    } else {
      const existing = await prisma.customer.findUnique({ where: { phone } });
      if (!existing?.passwordHash) {
        res.json({ success: true, expiresInMinutes: 10 });
        return;
      }
    }

    const result = await requestOtp(phone, purpose);
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, "Unable to send a code right now.");
  }
});

// POST /api/customers/register — needs the SMS code for the phone number.
// Guest orders already placed with that phone join the new account.
customersRouter.post("/register", limitRegister, async (req, res) => {
  try {
    const body = req.body ?? {};
    const firstName = readText(body.firstName, "First name", { required: true, max: 80 })!;
    const lastName = readText(body.lastName, "Last name", { max: 80 }) ?? "";
    const phone = normalisePhone(body.phone);
    const email = readEmail(body.email);
    const password = readPassword(body.password);

    const existing = await prisma.customer.findUnique({ where: { phone } });

    if (existing?.passwordHash) {
      throw new ValidationError("An account with this phone number already exists. Please log in.", 409);
    }

    if (email) {
      const emailOwner = await prisma.customer.findUnique({ where: { email } });
      if (emailOwner && emailOwner.id !== existing?.id) throw new ValidationError("That email is already used by another account.", 409);
    }

    await consumeOtp(phone, "REGISTER", body.code);
    const passwordHash = await bcrypt.hash(password, 12);

    const customer = existing
      ? await prisma.customer.update({
          where: { id: existing.id },
          data: { firstName, lastName, email: email ?? existing.email, passwordHash, lastLoginAt: new Date() },
        })
      : await prisma.customer.create({
          data: { firstName, lastName, phone, email, passwordHash, lastLoginAt: new Date() },
        });

    res.status(201).json({ success: true, token: signCustomerToken(customer.id), customer: profile(customer) });
  } catch (error) {
    sendError(res, error, "Unable to create your account.");
  }
});

// POST /api/customers/login — phone + password.
customersRouter.post("/login", limitCustomerLogin, async (req, res) => {
  try {
    const phone = normalisePhone(req.body?.phone);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const customer = await prisma.customer.findUnique({ where: { phone } });

    if (!customer?.passwordHash || !(await bcrypt.compare(password, customer.passwordHash))) {
      res.status(401).json({ success: false, message: "Incorrect phone number or password." });
      return;
    }

    await prisma.customer.update({ where: { id: customer.id }, data: { lastLoginAt: new Date() } });
    res.json({ success: true, token: signCustomerToken(customer.id), customer: profile(customer) });
  } catch (error) {
    sendError(res, error, "Unable to log in right now.");
  }
});

// POST /api/customers/reset-password — { phone, code, password }
customersRouter.post("/reset-password", limitCustomerLogin, async (req, res) => {
  try {
    const phone = normalisePhone(req.body?.phone);
    const password = readPassword(req.body?.password);
    const customer = await prisma.customer.findUnique({ where: { phone } });
    await consumeOtp(phone, "RESET_PASSWORD", req.body?.code);
    if (!customer?.passwordHash) throw new ValidationError("No account uses this phone number.", 404);

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash: await bcrypt.hash(password, 12), lastLoginAt: new Date() },
    });
    res.json({ success: true, token: signCustomerToken(updated.id), customer: profile(updated) });
  } catch (error) {
    sendError(res, error, "Unable to reset your password.");
  }
});

customersRouter.get("/me", requireCustomer, async (req: CustomerRequest, res) => {
  res.json({ success: true, customer: req.customer });
});

// PATCH /api/customers/me — names, email, password.
customersRouter.patch("/me", requireCustomer, async (req: CustomerRequest, res) => {
  try {
    const body = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (body.firstName !== undefined) data.firstName = readText(body.firstName, "First name", { required: true, max: 80 });
    if (body.lastName !== undefined) data.lastName = readText(body.lastName, "Last name", { max: 80 }) ?? "";
    if (body.email !== undefined) data.email = readEmail(body.email);
    if (body.newPassword !== undefined) {
      const current = await prisma.customer.findUniqueOrThrow({ where: { id: req.customer!.id } });
      if (!current.passwordHash || !(await bcrypt.compare(String(body.currentPassword ?? ""), current.passwordHash))) {
        throw new ValidationError("Your current password is incorrect.");
      }
      data.passwordHash = await bcrypt.hash(readPassword(body.newPassword), 12);
    }
    const customer = await prisma.customer.update({ where: { id: req.customer!.id }, data });
    res.json({ success: true, customer: profile(customer) });
  } catch (error) {
    sendError(res, error, "Unable to update your account.", "That email is already used by another account.");
  }
});

// GET /api/customers/me/orders
customersRouter.get("/me/orders", requireCustomer, async (req: CustomerRequest, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.customer!.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { items: { select: { productName: true, quantity: true } } },
    });
    res.json({
      success: true,
      data: orders.map((order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        createdAt: order.createdAt,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        firstItem: order.items[0]?.productName ?? null,
        phone: order.customerPhone,
      })),
    });
  } catch (error) {
    sendError(res, error, "Unable to load your orders.");
  }
});

// ---------- Admin ----------

// GET /api/customers — admin customer list with order totals.
customersRouter.get("/", requireAdmin, async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const customers = await prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search.replace(/\s/g, "").replace(/^0/, "") } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { orders: { select: { total: true, status: true, createdAt: true } } },
    });

    res.json({
      success: true,
      data: customers.map(({ orders, passwordHash, ...customer }) => {
        const counted = orders.filter((order) => order.status !== "CANCELLED");
        return {
          ...customer,
          hasAccount: Boolean(passwordHash),
          orderCount: orders.length,
          totalSpent: counted.reduce((sum, order) => sum + Number(order.total), 0),
          lastOrderAt: orders.reduce<Date | null>((latest, order) => (!latest || order.createdAt > latest ? order.createdAt : latest), null),
        };
      }),
    });
  } catch (error) {
    sendError(res, error, "Unable to load customers.");
  }
});

export default customersRouter;
