import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma } from "../generated/prisma/client.js";
import { ValidationError } from "./validation.js";
import { prisma } from "./prisma.js";
import { notifyOrder } from "./notify.js";

// ---------------------------------------------------------------------------
// Mobile money payments
//
// PAYMENT_PROVIDER in server/.env chooses how mobile money works:
//   (unset)    mobile money is not offered at checkout
//   simulator  test mode: no real money; payments succeed after ~10 seconds,
//              or fail if the phone number ends in 000
//   gateway    your payment gateway (MTN + Airtel collections)
//
// Gateway settings (fill in from the gateway's documentation):
//   PAYMENT_GATEWAY_BASE_URL   e.g. https://api.example-gateway.ug/v1
//   PAYMENT_GATEWAY_API_KEY    sent as "Authorization: Bearer <key>"
//   PAYMENT_WEBHOOK_SECRET     used to verify webhook signatures (HMAC-SHA256)
//   PAYMENT_WEBHOOK_SIGNATURE_HEADER   defaults to x-signature
//   PUBLIC_API_URL             public address of this API, for the callback URL
//
// Everything specific to the gateway's request and response format is in
// the `gateway` object below. When the gateway's documentation arrives, only
// that object should need changing.
// ---------------------------------------------------------------------------

export type GatewayStatus = "PENDING" | "PAID" | "FAILED";

export interface GatewayResult {
  status: GatewayStatus;
  providerReference?: string;
  amount?: number;
  failureReason?: string;
  raw?: unknown;
}

interface Collection {
  merchantReference: string;
  amount: number;
  currency: string;
  phone: string; // +256XXXXXXXXX
  network: "MTN" | "AIRTEL" | "UNKNOWN";
  description: string;
}

interface Provider {
  name: string;
  initiate(collection: Collection): Promise<GatewayResult>;
  checkStatus(merchantReference: string, providerReference?: string | null): Promise<GatewayResult>;
  // Returns null when the signature is invalid.
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>):
    | (GatewayResult & { merchantReference: string })
    | null;
}

export function detectNetwork(phone: string): Collection["network"] {
  const local = phone.replace(/^\+256/, "0");
  if (/^07[678]|^039/.test(local)) return "MTN";
  if (/^07[045]|^020/.test(local)) return "AIRTEL";
  return "UNKNOWN";
}

function mapStatus(value: unknown): GatewayStatus {
  const text = String(value ?? "").toLowerCase();
  if (["success", "successful", "succeeded", "completed", "paid", "approved"].includes(text)) return "PAID";
  if (["failed", "failure", "cancelled", "canceled", "rejected", "expired", "declined", "error"].includes(text)) return "FAILED";
  return "PENDING";
}

// --- Test mode -------------------------------------------------------------
const simulatorStarted = new Map<string, { at: number; fail: boolean }>();

const simulator: Provider = {
  name: "simulator",
  async initiate(collection) {
    simulatorStarted.set(collection.merchantReference, {
      at: Date.now(),
      fail: collection.phone.endsWith("000"),
    });
    return { status: "PENDING", providerReference: `SIM-${collection.merchantReference}` };
  },
  async checkStatus(merchantReference) {
    const started = simulatorStarted.get(merchantReference);
    if (!started) return { status: "FAILED", failureReason: "Test payment expired (server restarted)" };
    if (Date.now() - started.at < 10_000) return { status: "PENDING" };
    return started.fail
      ? { status: "FAILED", failureReason: "Test payment declined" }
      : { status: "PAID", providerReference: `SIM-${merchantReference}` };
  },
  parseWebhook() {
    return null;
  },
};

// --- Payment gateway -------------------------------------------------------
// ASSUMED request/response shapes. Adjust these to the gateway's documentation.
const gateway: Provider = {
  name: "gateway",
  async initiate(collection) {
    const base = process.env.PAYMENT_GATEWAY_BASE_URL?.replace(/\/$/, "");
    const key = process.env.PAYMENT_GATEWAY_API_KEY;
    if (!base || !key) throw new Error("Payment gateway is not configured.");

    const callbackUrl = `${(process.env.PUBLIC_API_URL ?? "").replace(/\/$/, "")}/api/payments/webhook`;

    const response = await fetch(`${base}/collections`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        reference: collection.merchantReference,
        amount: collection.amount,
        currency: collection.currency,
        phone: collection.phone,
        network: collection.network,
        description: collection.description,
        callback_url: callbackUrl,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      return {
        status: "FAILED",
        failureReason: String(data.message ?? data.error ?? `Gateway error (HTTP ${response.status})`),
        raw: data,
      };
    }

    return {
      status: mapStatus(data.status ?? "pending"),
      providerReference: (data.transaction_id ?? data.id ?? data.reference_id) as string | undefined,
      raw: data,
    };
  },
  async checkStatus(merchantReference) {
    const base = process.env.PAYMENT_GATEWAY_BASE_URL?.replace(/\/$/, "");
    const key = process.env.PAYMENT_GATEWAY_API_KEY;
    if (!base || !key) throw new Error("Payment gateway is not configured.");

    const response = await fetch(`${base}/collections/${encodeURIComponent(merchantReference)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) return { status: "PENDING", raw: data };

    return {
      status: mapStatus(data.status),
      providerReference: (data.transaction_id ?? data.id) as string | undefined,
      amount: data.amount !== undefined ? Number(data.amount) : undefined,
      failureReason: data.reason ? String(data.reason) : undefined,
      raw: data,
    };
  },
  parseWebhook(rawBody, headers) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) return null;

    const headerName = (process.env.PAYMENT_WEBHOOK_SIGNATURE_HEADER ?? "x-signature").toLowerCase();
    const received = String(headers[headerName] ?? "").replace(/^sha256=/, "");
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const data = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    return {
      merchantReference: String(data.reference ?? data.external_reference ?? ""),
      providerReference: (data.transaction_id ?? data.id) as string | undefined,
      status: mapStatus(data.status),
      amount: data.amount !== undefined ? Number(data.amount) : undefined,
      failureReason: data.reason ? String(data.reason) : undefined,
      raw: data,
    };
  },
};

export function activeProvider(): Provider | null {
  const name = process.env.PAYMENT_PROVIDER;
  if (name === "simulator") return simulator;
  if (name === "gateway") return gateway;
  return null;
}

export function mobileMoneyEnabled() {
  return activeProvider() !== null;
}

export function newMerchantReference(orderNumber: string) {
  return `${orderNumber}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

// Start a mobile money collection for an order. Creates the Payment row first,
// so a gateway timeout still leaves a record that can be re-checked.
export async function startMobileMoneyPayment(orderId: string, phone: string) {
  const provider = activeProvider();
  if (!provider) throw new Error("Mobile money is not available right now.");

  // Lock the order row so two requests at the same moment can't both send
  // a payment prompt (which could charge the customer twice).
  const started = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { payments: { where: { status: "PENDING", method: "mobile-money" }, take: 1 } },
    });
    if (order.paymentStatus === "PAID") throw new ValidationError("This order is already paid.");
    if (order.payments.length) throw new ValidationError("A payment request is already waiting. Check your phone, or wait a minute and try again.");

    const merchantReference = newMerchantReference(order.orderNumber);
    const payment = await tx.payment.create({
      data: {
        orderId,
        method: "mobile-money",
        provider: provider.name,
        amount: order.total,
        currency: order.currency,
        status: "PENDING",
        phone,
        merchantReference,
      },
    });
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "PENDING" } });
    return { order, payment, merchantReference };
  });
  const { order, payment, merchantReference } = started;

  try {
    const result = await provider.initiate({
      merchantReference,
      amount: Number(order.total),
      currency: order.currency,
      phone,
      network: detectNetwork(phone),
      description: `Vana Power Mart order ${order.orderNumber}`,
    });
    return applyPaymentResult(payment.id, result);
  } catch (error) {
    return applyPaymentResult(payment.id, {
      status: "FAILED",
      failureReason: error instanceof Error ? error.message : "Could not reach the payment gateway.",
    });
  }
}

// Apply a gateway result to a payment and its order. Safe to call repeatedly
// (polling, webhook retries): a payment only moves out of PENDING once.
export async function applyPaymentResult(paymentId: string, result: GatewayResult) {
  const outcome = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });

    if (payment.status !== "PENDING") return { payment, changed: false as const };

    // Store the gateway's reference even while pending.
    if (result.status === "PENDING") {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          providerReference: result.providerReference ?? payment.providerReference,
          rawResponse: result.raw === undefined ? undefined : (JSON.parse(JSON.stringify(result.raw)) as Prisma.InputJsonValue),
        },
      });
      return { payment: updated, changed: false as const };
    }

    let status = result.status;
    let failureReason = result.failureReason ?? null;

    // Never accept a payment for less than was asked.
    if (status === "PAID" && result.amount !== undefined && result.amount + 0.001 < Number(payment.amount)) {
      status = "FAILED";
      failureReason = `Amount mismatch: received ${result.amount}, expected ${payment.amount}`;
    }

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status,
        providerReference: result.providerReference ?? payment.providerReference,
        failureReason,
        verifiedAt: status === "PAID" ? new Date() : null,
        rawResponse: result.raw === undefined ? undefined : (JSON.parse(JSON.stringify(result.raw)) as Prisma.InputJsonValue),
      },
    });

    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });

    if (status === "PAID" && order.paymentStatus !== "PAID") {
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" } });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: order.status,
          paymentStatus: "PAID",
          note: `Mobile money payment confirmed (${updated.providerReference ?? updated.merchantReference})`,
          actor: "payment-gateway",
        },
      });
    } else if (status === "FAILED" && order.paymentStatus !== "PAID") {
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: order.status,
          paymentStatus: "FAILED",
          note: `Mobile money payment failed${failureReason ? `: ${failureReason}` : ""}`,
          actor: "payment-gateway",
        },
      });
    }

    return { payment: updated, changed: true as const, orderId: order.id, status };
  });

  if (outcome.changed) {
    await notifyOrder(outcome.orderId, outcome.status === "PAID" ? "PAYMENT_RECEIVED" : "PAYMENT_FAILED");
  }

  return outcome.payment;
}

// Ask the gateway about a pending payment (used by the "waiting" page).
export async function refreshPayment(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.status !== "PENDING" || payment.method !== "mobile-money") return payment;

  const provider = payment.provider === "simulator" ? simulator : payment.provider === "gateway" ? gateway : null;
  if (!provider) return payment;

  try {
    const result = await provider.checkStatus(payment.merchantReference, payment.providerReference);
    return applyPaymentResult(payment.id, result);
  } catch (error) {
    console.error("Payment status check failed:", error);
    return payment;
  }
}

export function parseGatewayWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
  return gateway.parseWebhook(rawBody, headers);
}
