import { Router } from "express";
import { randomBytes } from "node:crypto";
import { Prisma } from "../generated/prisma/client.js";
import { ReturnStatus } from "../generated/prisma/enums.js";
import { documentTokenValid } from "../lib/documents.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, type AuthenticatedAdminRequest } from "../middleware/requireAdmin.js";
import { ValidationError, readBoolean, readText } from "../lib/validation.js";
import { readMoneyValue, sendError } from "../lib/http.js";
import { getSettings } from "../lib/settings.js";
import { notifyOrder } from "../lib/notify.js";
import { recordStockMovement } from "../lib/stock.js";
import { audit } from "../lib/audit.js";
import { normalisePhone } from "./orders.js";
import { limitOrderLookup } from "../middleware/rateLimits.js";

const returnsRouter = Router();

const RETURN_REASONS = [
  "Damaged on arrival",
  "Wrong item delivered",
  "Item does not work",
  "Missing parts",
  "Not as described",
  "Changed my mind",
];

// POST /api/returns — customer requests a return (order number + phone).
returnsRouter.post("/", limitOrderLookup, async (req, res) => {
  try {
    const body = req.body ?? {};
    const orderNumber = readText(body.orderNumber, "Order number", { required: true, max: 40 })!.toUpperCase();
    // From an SMS link the token proves the order; otherwise the phone does.
    const viaLink = documentTokenValid(orderNumber, body.t);
    const phone = viaLink ? null : normalisePhone(body.phone);
    const reason = readText(body.reason, "Reason", { required: true, max: 100 })!;
    if (!RETURN_REASONS.includes(reason)) throw new ValidationError("Choose a reason for the return.");
    const details = readText(body.details, "Details", { max: 2000 });

    const order = await prisma.order.findUnique({ where: { orderNumber }, include: { returnRequests: true } });
    if (!order || (!viaLink && order.customerPhone !== phone)) throw new ValidationError("We couldn't find that order.", 404);
    if (order.status !== "DELIVERED" || !order.deliveredAt) {
      throw new ValidationError("Returns can be requested once an order has been delivered.");
    }

    const settings = await getSettings();
    const deadline = order.deliveredAt.getTime() + settings.returnWindowDays * 86_400_000;
    if (Date.now() > deadline) {
      throw new ValidationError(`Returns must be requested within ${settings.returnWindowDays} days of delivery.`);
    }
    if (order.returnRequests.some((request) => request.status !== "REJECTED")) {
      throw new ValidationError("A return has already been requested for this order. We'll be in touch.");
    }

    const request = await prisma.returnRequest.create({
      data: { orderId: order.id, customerId: order.customerId, reason, details },
    });
    void notifyOrder(order.id, "RETURN_UPDATE", "we received your return request and will call you to arrange collection.");
    res.status(201).json({ success: true, data: { id: request.id, status: request.status } });
  } catch (error) {
    sendError(res, error, "Unable to submit the return request.");
  }
});

returnsRouter.get("/reasons", (_req, res) => {
  res.json({ success: true, data: RETURN_REASONS });
});

// ---------- Admin ----------

returnsRouter.get("/admin", requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status ?? "");
    const returns = await prisma.returnRequest.findMany({
      where: (Object.values(ReturnStatus) as string[]).includes(status) ? { status: status as ReturnStatus } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        order: {
          select: {
            id: true, orderNumber: true, total: true, paymentStatus: true, deliveredAt: true,
            customerName: true, customerPhone: true,
            items: { select: { id: true, productId: true, productName: true, quantity: true, unitPrice: true } },
          },
        },
      },
    });
    res.json({ success: true, data: returns });
  } catch (error) {
    sendError(res, error, "Unable to load returns.");
  }
});

const MESSAGES: Partial<Record<ReturnStatus, string>> = {
  APPROVED: "your return is approved. We will call you to arrange collection.",
  REJECTED: "we could not accept your return. We will call you to explain.",
  RECEIVED: "we have received the returned item and are checking it.",
  REFUNDED: "your refund has been sent.",
};

// PATCH /api/returns/admin/:id — move a return through its steps.
// RECEIVED with restock: true puts the items back into sellable stock.
// REFUNDED records a refund payment and marks the order refunded if in full.
returnsRouter.patch("/admin/:id", requireAdmin, async (req: AuthenticatedAdminRequest, res) => {
  try {
    const id = String(req.params.id);
    const body = req.body ?? {};
    const actor = req.admin!.email;
    const status = body.status as ReturnStatus | undefined;
    if (status !== undefined && !(Object.values(ReturnStatus) as string[]).includes(status)) {
      throw new ValidationError("Choose a valid return status.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.returnRequest.findUnique({ where: { id }, include: { order: { include: { items: true } } } });
      if (!existing) throw new ValidationError("Return not found.", 404);
      if (existing.status === "REFUNDED" && status && status !== "REFUNDED") {
        throw new ValidationError("This return is already refunded.");
      }

      const data: Prisma.ReturnRequestUpdateInput = {};
      if (body.adminNote !== undefined) data.adminNote = readText(body.adminNote, "Note", { max: 2000 });
      if (body.refundMethod !== undefined) data.refundMethod = readText(body.refundMethod, "Refund method", { max: 80 });
      if (body.refundAmount !== undefined) data.refundAmount = readMoneyValue(body.refundAmount, "Refund amount");
      if (status) data.status = status;

      if (status === "RECEIVED" && existing.status !== "RECEIVED" && body.restock !== undefined && readBoolean(body.restock, "Restock")) {
        for (const item of existing.order.items) {
          await tx.inventory.updateMany({ where: { productId: item.productId }, data: { quantity: { increment: item.quantity } } });
          await recordStockMovement(tx, item.productId, item.quantity, "RETURN", { orderId: existing.orderId, actor, note: "Return received" });
        }
      }

      if (status === "REFUNDED" && existing.status !== "REFUNDED") {
        const amount = (data.refundAmount as Prisma.Decimal | null | undefined) ?? existing.refundAmount ?? existing.order.total;
        if (amount.greaterThan(existing.order.total)) throw new ValidationError("Refund can't be more than the order total.");
        data.refundAmount = amount;
        await tx.payment.create({
          data: {
            orderId: existing.orderId,
            method: "refund",
            provider: "manual",
            amount,
            status: "REFUNDED",
            merchantReference: `${existing.order.orderNumber}-REFUND-${randomBytes(3).toString("hex").toUpperCase()}`,
            verifiedAt: new Date(),
            rawResponse: { recordedBy: actor, refundMethod: body.refundMethod ?? existing.refundMethod ?? null },
          },
        });
        if (amount.greaterThanOrEqualTo(existing.order.total)) {
          await tx.order.update({ where: { id: existing.orderId }, data: { paymentStatus: "REFUNDED" } });
        }
        await tx.orderStatusHistory.create({
          data: { orderId: existing.orderId, status: existing.order.status, paymentStatus: amount.greaterThanOrEqualTo(existing.order.total) ? "REFUNDED" : null, note: `Refund of UGX ${amount.toString()} recorded`, actor },
        });
      }

      return tx.returnRequest.update({ where: { id }, data });
    });

    await audit(actor, "return.update", "ReturnRequest", id, body);
    if (status && MESSAGES[status]) void notifyOrder(updated.orderId, "RETURN_UPDATE", MESSAGES[status]);
    res.json({ success: true, data: updated });
  } catch (error) {
    sendError(res, error, "Unable to update the return.");
  }
});

export default returnsRouter;
