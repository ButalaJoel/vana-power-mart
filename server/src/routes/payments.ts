import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ValidationError, readText } from "../lib/validation.js";
import { sendError } from "../lib/http.js";
import {
  applyPaymentResult,
  mobileMoneyEnabled,
  parseGatewayWebhook,
  refreshPayment,
  startMobileMoneyPayment,
} from "../lib/payments.js";
import { normalisePhone } from "./orders.js";
import { limitPaymentChecks } from "../middleware/rateLimits.js";

const paymentsRouter = Router();

function publicPayment(payment: {
  status: string;
  merchantReference: string;
  failureReason: string | null;
  amount: unknown;
  phone: string | null;
}) {
  return {
    status: payment.status,
    reference: payment.merchantReference,
    failureReason: payment.failureReason,
    amount: payment.amount,
    phoneEnding: payment.phone ? payment.phone.slice(-3) : null,
  };
}

// GET /api/payments/order/:orderNumber — status for the payment page.
// Checks with the gateway when the latest payment is still pending.
paymentsRouter.get("/order/:orderNumber", limitPaymentChecks, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: String(req.params.orderNumber) },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!order) throw new ValidationError("Order not found.", 404);

    let latest = order.payments[0] ?? null;
    if (latest?.status === "PENDING") latest = await refreshPayment(latest.id);

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        total: order.total,
        orderStatus: fresh.status,
        paymentStatus: fresh.paymentStatus,
        paymentMethod: order.paymentMethod,
        mobileMoneyEnabled: mobileMoneyEnabled(),
        payment: latest ? publicPayment(latest) : null,
      },
    });
  } catch (error) {
    sendError(res, error, "Unable to check the payment.");
  }
});

// POST /api/payments/order/:orderNumber/retry — start a new mobile money
// request. The phone must match the order's phone, so strangers can't send
// payment prompts with someone else's order number.
paymentsRouter.post("/order/:orderNumber/retry", limitPaymentChecks, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: String(req.params.orderNumber) },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!order) throw new ValidationError("Order not found.", 404);
    if (order.status === "CANCELLED") throw new ValidationError("This order was cancelled.");
    if (order.paymentStatus === "PAID") throw new ValidationError("This order is already paid.");
    if (order.payments[0]?.status === "PENDING") {
      throw new ValidationError("A payment request is already waiting. Check your phone, or wait a minute and try again.");
    }

    const orderPhone = normalisePhone(req.body?.orderPhone ?? "", "Order phone number");
    if (orderPhone !== order.customerPhone) {
      throw new ValidationError("Enter the phone number used for this order.");
    }
    const payPhone = normalisePhone(req.body?.paymentPhone ?? orderPhone, "Mobile money number");

    if (order.paymentMethod !== "mobile-money") {
      await prisma.order.update({ where: { id: order.id }, data: { paymentMethod: "mobile-money" } });
    }

    const payment = await startMobileMoneyPayment(order.id, payPhone);
    res.status(201).json({ success: true, data: publicPayment(payment) });
  } catch (error) {
    sendError(res, error, "Unable to start the payment.");
  }
});

// POST /api/payments/webhook — called by the payment gateway.
// The raw body is verified with PAYMENT_WEBHOOK_SECRET before anything is trusted.
paymentsRouter.post("/webhook", async (req, res) => {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const parsed = parseGatewayWebhook(raw, req.headers);
    if (!parsed) {
      res.status(401).json({ success: false, message: "Invalid signature." });
      return;
    }

    const reference = readText(parsed.merchantReference, "Reference", { required: true, max: 120 })!;
    const payment = await prisma.payment.findUnique({ where: { merchantReference: reference } });
    if (!payment) {
      res.status(404).json({ success: false, message: "Unknown payment reference." });
      return;
    }

    await applyPaymentResult(payment.id, parsed);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error, "Webhook processing failed.");
  }
});

export default paymentsRouter;
