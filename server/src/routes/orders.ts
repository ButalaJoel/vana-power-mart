import { Router, type Response } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client.js";
import { OrderStatus, PaymentStatus, ProcurementStatus } from "../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, type AuthenticatedAdminRequest } from "../middleware/requireAdmin.js";
import { optionalCustomer, type CustomerRequest } from "../middleware/customerAuth.js";
import { ValidationError, readInteger, readText } from "../lib/validation.js";
import { effectiveUnitPrice, voucherDiscount } from "../lib/pricing.js";
import { getSettings } from "../lib/settings.js";
import { recordStockMovement } from "../lib/stock.js";
import { eventForStatus, notifyOrder } from "../lib/notify.js";
import { sendSms } from "../lib/sms.js";
import { mobileMoneyEnabled, startMobileMoneyPayment } from "../lib/payments.js";
import { audit } from "../lib/audit.js";
import { limitOrderLookup, limitOrders } from "../middleware/rateLimits.js";
import {
  buildOrderDocument,
  documentTokenValid,
  documentUrl,
  loadDocumentOrder,
  readDocumentType,
} from "../lib/documents.js";

const ordersRouter = Router();

const MAX_LINES = 50;
const MAX_QUANTITY_PER_LINE = 100;

// Allow extra time to obtain a pooled connection (see the earlier P2028 issue).
const TRANSACTION_OPTIONS = { maxWait: 10000, timeout: 20000 };

const PAYMENT_METHODS: Record<string, string> = {
  "cash-on-delivery": "Cash on delivery",
  "mobile-money": "Mobile money",
  "bank-transfer": "Bank transfer",
};

const DELIVERY_METHODS: Record<string, string> = {
  delivery: "Home delivery",
  collection: "Store collection",
};

const adminOrderInclude = {
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  deliveryZone: true,
  voucher: { select: { id: true, code: true } },
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      product: { select: { id: true, slug: true, imageUrls: true, sku: true } },
      variant: { select: { id: true, sku: true, options: true } },
      procurement: { include: { supplier: { select: { id: true, name: true, phone: true, deliversDirect: true } } } },
    },
  },
  payments: { orderBy: { createdAt: "desc" as const } },
  statusHistory: { orderBy: { createdAt: "asc" as const } },
  notifications: { orderBy: { createdAt: "desc" as const } },
  returnRequests: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.OrderInclude;

const publicOrderInclude = {
  customer: { select: { firstName: true } },
  deliveryZone: { select: { name: true, estimatedTime: true } },
  items: {
    orderBy: { createdAt: "asc" as const },
    include: { product: { select: { slug: true, imageUrls: true } } },
  },
  payments: { orderBy: { createdAt: "desc" as const } },
  statusHistory: { orderBy: { createdAt: "asc" as const } },
  returnRequests: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.OrderInclude;

type PublicOrder = Prisma.OrderGetPayload<{ include: typeof publicOrderInclude }>;
type AdminOrder = Prisma.OrderGetPayload<{ include: typeof adminOrderInclude }>;

// Thrown inside the transaction when products, stock or vouchers fail checks.
class OrderConflictError extends Error {}

// Stock rule: an order holds stock in every status except these two.
const NON_STOCK_STATUSES = new Set<string>(["AWAITING_STOCK", "CANCELLED"]);

type Tx = Prisma.TransactionClient;
type StockLine = { productId: string; quantity: number; productName: string };

async function deductStock(tx: Tx, lines: StockLine[], orderId: string | null, actor: string) {
  for (const line of lines) {
    const updated = await tx.$executeRaw`
      UPDATE "Inventory"
      SET "quantity" = "quantity" - ${line.quantity}, "updatedAt" = NOW()
      WHERE "productId" = ${line.productId}
        AND "quantity" - "reservedQuantity" >= ${line.quantity}
    `;
    if (updated !== 1) return line.productName;
    await recordStockMovement(tx, line.productId, -line.quantity, "ORDER", { orderId, actor });
  }
  return null;
}

async function returnStock(tx: Tx, lines: StockLine[], orderId: string, actor: string, note?: string) {
  for (const line of lines) {
    await tx.inventory.updateMany({
      where: { productId: line.productId },
      data: { quantity: { increment: line.quantity } },
    });
    await recordStockMovement(tx, line.productId, line.quantity, "CANCELLATION", { orderId, actor, note });
  }
}

function createOrderNumber(): string {
  const now = new Date();
  const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  return `VPM-${date}-${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
}

export function normalisePhone(value: unknown, field = "Phone number"): string {
  const text = readText(value, field, { required: true, max: 30 })!;
  const digits = text.replace(/[\s\-()]/g, "");
  let local: string | null = null;
  if (/^\+256\d{9}$/.test(digits)) local = digits.slice(4);
  else if (/^256\d{9}$/.test(digits)) local = digits.slice(3);
  else if (/^0\d{9}$/.test(digits)) local = digits.slice(1);
  else if (/^\d{9}$/.test(digits)) local = digits;
  // Ugandan numbers start with 7 (mobile) or 2, 3, 4 (landlines) after the 0.
  if (!local || !/^[2347]/.test(local)) {
    throw new ValidationError(`Enter a valid Ugandan ${field.toLowerCase()}, e.g. 0772 123 456.`);
  }
  return `+256${local}`;
}

function readEmail(value: unknown): string | null {
  const email = readText(value, "Email", { max: 200 });
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("Enter a valid email address.");
  return email.toLowerCase();
}

interface RequestedLine {
  productId: string;
  variantId: string | null;
  quantity: number;
}

// Unconfirmed, unpaid orders a single phone number may have open at once.
const MAX_OPEN_UNPAID_PER_PHONE = 3;

function parseItems(value: unknown): RequestedLine[] {
  if (!Array.isArray(value) || value.length === 0) throw new ValidationError("Your cart is empty.");
  if (value.length > MAX_LINES) throw new ValidationError(`An order can contain at most ${MAX_LINES} products.`);

  const merged = new Map<string, RequestedLine>();
  for (const raw of value) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const productId = readText(item.productId, "Product", { required: true, max: 200 })!;
    const variantId = readText(item.variantId, "Variant", { max: 200 });
    const quantity = readInteger(item.quantity, "Quantity", { min: 1, max: MAX_QUANTITY_PER_LINE });
    const key = `${productId}::${variantId ?? ""}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += quantity;
      if (existing.quantity > MAX_QUANTITY_PER_LINE) {
        throw new ValidationError(`You can order at most ${MAX_QUANTITY_PER_LINE} of one product.`);
      }
    } else {
      merged.set(key, { productId, variantId, quantity });
    }
  }
  return [...merged.values()];
}

function handleError(error: unknown, res: Response, fallback: string) {
  if (error instanceof ValidationError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof OrderConflictError) {
    res.status(409).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    res.status(404).json({ success: false, message: "Order not found." });
    return;
  }
  console.error(fallback, error);
  res.status(500).json({ success: false, message: fallback });
}

// What the customer sees: no internal notes, costs or other customers' data.
function toPublicOrder(order: PublicOrder, settings?: { returnWindowDays: number }) {
  const latestPayment = order.payments[0];
  const windowDays = settings?.returnWindowDays ?? 7;
  const returnDeadline = order.deliveredAt
    ? new Date(order.deliveredAt.getTime() + windowDays * 86_400_000)
    : null;

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    deliveryMethod: order.deliveryMethod,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    deliveryFee: order.deliveryFee,
    total: order.total,
    currency: order.currency,
    deliveryArea: order.deliveryArea,
    deliveryZone: order.deliveryZone,
    customerFirstName: (order.customerName ?? order.customer.firstName).split(" ")[0],
    createdAt: order.createdAt,
    dispatchedAt: order.dispatchedAt,
    deliveredAt: order.deliveredAt,
    // Rider details are shared only once the order is on its way.
    rider:
      order.status === "OUT_FOR_DELIVERY" && order.deliveryAssignee
        ? { name: order.deliveryAssignee, phone: order.deliveryAssigneePhone }
        : null,
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      productSlug: item.product.slug,
      imageUrl: item.product.imageUrls[0] ?? null,
    })),
    timeline: order.statusHistory.map((entry) => ({
      status: entry.status,
      paymentStatus: entry.paymentStatus,
      at: entry.createdAt,
    })),
    payment: latestPayment
      ? {
          status: latestPayment.status,
          method: latestPayment.method,
          reference: latestPayment.merchantReference,
          failureReason: latestPayment.failureReason,
        }
      : null,
    returnEligible:
      order.status === "DELIVERED" &&
      returnDeadline !== null &&
      returnDeadline > new Date() &&
      !order.returnRequests.some((request) => request.status !== "REJECTED"),
    returnDeadline,
    returns: order.returnRequests.map((request) => ({
      status: request.status,
      reason: request.reason,
      createdAt: request.createdAt,
    })),
  };
}

// Margin on an order. Costs are only complete once every line has a cost.
function orderProfit(order: AdminOrder) {
  const revenue = Number(order.subtotal) - Number(order.discountAmount) + Number(order.deliveryFee);
  let goodsCost = 0;
  let costedLines = 0;
  for (const item of order.items) {
    if (item.procurement?.unitCost !== null && item.procurement?.unitCost !== undefined) {
      goodsCost += Number(item.procurement.unitCost) * item.quantity;
      costedLines++;
    }
  }
  const deliveryCost = Number(order.deliveryCost ?? 0);
  const grossProfit = revenue - goodsCost - deliveryCost;
  return {
    revenue,
    goodsCost,
    deliveryCost,
    grossProfit,
    marginPercent: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : null,
    costComplete: costedLines === order.items.length && order.deliveryCost !== null,
  };
}

function toAdminOrder(order: AdminOrder) {
  return { ...order, profit: orderProfit(order) };
}

// ---------------------------------------------------------------------------
// Customer: price preview and order placement
// ---------------------------------------------------------------------------

// POST /api/orders — the browser sends product IDs and quantities only.
ordersRouter.post("/", limitOrders, optionalCustomer, async (req: CustomerRequest, res) => {
  try {
    const body = req.body ?? {};
    const idempotencyKey = readText(body.idempotencyKey, "Request key", { max: 100 });

    // A retried submit returns the order already created.
    if (idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey },
        include: publicOrderInclude,
      });
      if (existing) {
        res.status(200).json({ success: true, data: toPublicOrder(existing), duplicate: true });
        return;
      }
    }

    // Hidden form field people never see; only bots fill it in.
    if (typeof body.website === "string" && body.website.trim()) {
      res.status(400).json({ success: false, message: "Unable to place this order. Please call us." });
      return;
    }

    const customerInput = (body.customer ?? {}) as Record<string, unknown>;
    const firstName = readText(customerInput.firstName, "First name", { required: true, max: 80 })!;
    const lastName = readText(customerInput.lastName, "Last name", { max: 80 }) ?? "";
    const phone = req.customer?.phone ?? normalisePhone(customerInput.phone);
    const email = readEmail(customerInput.email);

    const deliveryMethod = String(body.deliveryMethod ?? "delivery");
    if (!DELIVERY_METHODS[deliveryMethod]) throw new ValidationError("Choose a valid delivery method.");

    const paymentMethod = String(body.paymentMethod ?? "cash-on-delivery");
    if (!PAYMENT_METHODS[paymentMethod]) throw new ValidationError("Choose a valid payment method.");
    if (paymentMethod === "mobile-money" && !mobileMoneyEnabled()) {
      throw new ValidationError("Mobile money is not available right now. Please choose another payment method.");
    }
    const paymentPhone =
      paymentMethod === "mobile-money"
        ? normalisePhone(body.paymentPhone ?? customerInput.phone ?? phone, "Mobile money number")
        : null;

    const isDelivery = deliveryMethod === "delivery";
    const deliveryZoneId = isDelivery ? readText(body.deliveryZoneId, "Delivery zone", { max: 100 }) : null;
    const deliveryArea = readText(body.deliveryArea, "District / area", { required: isDelivery, max: 120 });
    const deliveryAddress = isDelivery
      ? readText(body.deliveryAddress, "Delivery address", { required: true, max: 500 })!
      : "Store collection";
    const instructions = readText(body.customerNotes, "Delivery instructions", { max: 1000 });
    const voucherCode = readText(body.voucherCode, "Voucher code", { max: 40 })?.toUpperCase() ?? null;

    const lines = parseItems(body.items);
    const settings = await getSettings();

    // Fake-order guard: a phone can only have a few new, unpaid orders at once.
    const openUnpaid = await prisma.order.count({
      where: {
        customerPhone: phone,
        status: { in: ["PENDING", "AWAITING_STOCK"] },
        paymentStatus: { not: "PAID" },
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60_000) },
      },
    });
    if (openUnpaid >= MAX_OPEN_UNPAID_PER_PHONE) {
      throw new ValidationError(
        `This phone number already has ${openUnpaid} orders waiting for confirmation. Please call us on ${settings.storePhone || "our store line"} to add more.`,
        429,
      );
    }

    const newOrderId = randomUUID();

    const order = await prisma.$transaction(async (tx) => {
      const identifiers = lines.map((line) => line.productId);
      const products = await tx.product.findMany({
        where: { OR: [{ id: { in: identifiers } }, { slug: { in: identifiers } }] },
        include: {
          category: { select: { isActive: true } },
          inventory: true,
          variants: { orderBy: { createdAt: "asc" } },
        },
      });

      const orderItems: Prisma.OrderItemCreateWithoutOrderInput[] = [];
      const stockLines: StockLine[] = [];
      let subtotal = new Prisma.Decimal(0);
      const now = new Date();

      for (const line of lines) {
        const product = products.find((item) => item.id === line.productId || item.slug === line.productId);
        if (!product || !product.isActive || !product.category.isActive) {
          throw new OrderConflictError("One of the products in your cart is no longer available. Please review your cart.");
        }

        const activeVariants = product.variants.filter((variant) => variant.isActive);
        let variant = null as (typeof activeVariants)[number] | null;
        if (line.variantId) {
          variant = activeVariants.find((item) => item.id === line.variantId) ?? null;
          if (!variant) throw new OrderConflictError(`The selected option for "${product.name}" is no longer available.`);
        } else {
          variant = activeVariants[0] ?? null;
        }

        const unitPrice = effectiveUnitPrice(product, variant, now);
        stockLines.push({ productId: product.id, quantity: line.quantity, productName: product.name });
        subtotal = subtotal.add(unitPrice.mul(line.quantity));
        orderItems.push({
          product: { connect: { id: product.id } },
          ...(variant ? { variant: { connect: { id: variant.id } } } : {}),
          quantity: line.quantity,
          unitPrice,
          productName: product.name,
          procurement: { create: {} },
        });
      }

      // Voucher: validated and counted inside the transaction.
      let discount = new Prisma.Decimal(0);
      let voucherId: string | null = null;
      if (voucherCode) {
        const voucher = await tx.voucher.findUnique({ where: { code: voucherCode } });
        if (!voucher) throw new ValidationError("That voucher code was not found.");
        const result = voucherDiscount(voucher, subtotal, now);
        if ("error" in result) throw new ValidationError(result.error);
        discount = result.discount;
        voucherId = voucher.id;
        const claimed = await tx.$executeRaw`
          UPDATE "Voucher" SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
          WHERE "id" = ${voucher.id} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
        `;
        if (claimed !== 1) throw new ValidationError("This voucher has been fully used.");
      }

      // Delivery fee from the chosen zone; free above the threshold.
      let deliveryFee = new Prisma.Decimal(0);
      let zoneName: string | null = null;
      if (isDelivery) {
        const activeZones = await tx.deliveryZone.count({ where: { isActive: true } });
        if (activeZones > 0) {
          if (!deliveryZoneId) throw new ValidationError("Choose your delivery area.");
          const zone = await tx.deliveryZone.findFirst({ where: { id: deliveryZoneId, isActive: true } });
          if (!zone) throw new ValidationError("That delivery area is no longer available. Please choose another.");
          deliveryFee = zone.fee;
          zoneName = zone.name;
        }
        const afterDiscount = subtotal.sub(discount);
        if (settings.freeDeliveryThreshold !== null && afterDiscount.greaterThanOrEqualTo(settings.freeDeliveryThreshold)) {
          deliveryFee = new Prisma.Decimal(0);
        }
      }

      // Stock: take it now if everything is available; otherwise accept the
      // order as AWAITING_STOCK without touching inventory.
      await tx.$executeRaw`SAVEPOINT stock_check`;
      const shortProduct = await deductStock(tx, stockLines, newOrderId, "checkout");
      let status: OrderStatus = "PENDING";
      if (shortProduct) {
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT stock_check`;
        status = "AWAITING_STOCK";
      } else {
        await tx.$executeRaw`RELEASE SAVEPOINT stock_check`;
      }

      // Customer record: logged-in customers use their account. Guests are
      // matched by phone, but an account holder's details are never
      // overwritten by a guest checkout; this order keeps its own copy.
      let customerId = req.customer?.id ?? null;
      if (!customerId) {
        let customer = await tx.customer.findUnique({ where: { phone } });
        if (!customer && email) customer = await tx.customer.findUnique({ where: { email } });
        if (customer) {
          if (!customer.passwordHash) {
            const emailTaken = email && email !== customer.email ? await tx.customer.findUnique({ where: { email } }) : null;
            await tx.customer.update({
              where: { id: customer.id },
              data: { firstName, lastName, ...(email && !emailTaken ? { email } : {}) },
            });
          }
          customerId = customer.id;
        } else {
          const emailTaken = email ? await tx.customer.findUnique({ where: { email } }) : null;
          customer = await tx.customer.create({
            data: { firstName, lastName, phone, email: emailTaken ? null : email },
          });
          customerId = customer.id;
        }
      }

      const total = Prisma.Decimal.max(subtotal.sub(discount).add(deliveryFee), 0);

      const created = await tx.order.create({
        data: {
          id: newOrderId,
          orderNumber: createOrderNumber(),
          status,
          customer: { connect: { id: customerId } },
          customerName: `${firstName} ${lastName}`.trim(),
          customerPhone: phone,
          customerEmail: email,
          subtotal,
          discountAmount: discount,
          deliveryFee,
          total,
          currency: "UGX",
          deliveryMethod,
          paymentMethod,
          ...(deliveryZoneId && zoneName ? { deliveryZone: { connect: { id: deliveryZoneId } } } : {}),
          ...(voucherId ? { voucher: { connect: { id: voucherId } } } : {}),
          deliveryAddress,
          deliveryArea: deliveryArea ?? zoneName,
          customerNotes: instructions,
          idempotencyKey,
          items: { create: orderItems },
          statusHistory: {
            create: {
              status,
              paymentStatus: "UNPAID",
              note: status === "AWAITING_STOCK" ? "Order placed; some items need restocking" : "Order placed",
              actor: req.customer ? `customer:${req.customer.phone}` : "customer",
            },
          },
        },
      });

      return created;
    }, TRANSACTION_OPTIONS);

    // After the order is safely saved: messages and (optionally) payment.
    void notifyOrder(order.id, "PLACED");

    let paymentError: string | null = null;
    if (paymentMethod === "mobile-money" && paymentPhone) {
      try {
        await startMobileMoneyPayment(order.id, paymentPhone);
      } catch (error) {
        paymentError = error instanceof Error ? error.message : "Could not start the payment.";
      }
    }

    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: publicOrderInclude });
    res.status(201).json({
      success: true,
      data: { ...toPublicOrder(saved, settings), documents: orderDocumentLinks(saved.orderNumber) },
      paymentError,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ success: false, message: "This order was already submitted. Please check your orders." });
      return;
    }
    handleError(error, res, "Unable to place your order right now. Please try again.");
  }
});

// GET /api/orders/lookup/:orderNumber — order confirmation page (no contact details).
ordersRouter.get("/lookup/:orderNumber", limitOrderLookup, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: String(req.params.orderNumber) },
      include: publicOrderInclude,
    });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }
    res.json({ success: true, data: toPublicOrder(order, await getSettings()) });
  } catch (error) {
    handleError(error, res, "Unable to retrieve the order.");
  }
});

// Share links for an order's invoice and delivery note.
function orderDocumentLinks(orderNumber: string) {
  return { invoice: documentUrl(orderNumber, "invoice"), deliveryNote: documentUrl(orderNumber, "delivery-note") };
}

function sendPdf(res: Response, buffer: Buffer, fileName: string, download: boolean) {
  res
    .type("application/pdf")
    .set("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${fileName}"`)
    .set("Cache-Control", "private, no-store")
    .send(buffer);
}

// GET /api/orders/document/:orderNumber?type=invoice|delivery-note&t=<link token>
// For customers: opened from the SMS link, the tracking page or WhatsApp.
// Also accepts &phone=<order phone> instead of the token.
ordersRouter.get("/document/:orderNumber", limitOrderLookup, async (req, res) => {
  try {
    const orderNumber = String(req.params.orderNumber).toUpperCase();
    const order = await loadDocumentOrder({ orderNumber });

    let allowed = Boolean(order) && documentTokenValid(orderNumber, req.query.t);
    if (order && !allowed && req.query.phone) {
      try {
        allowed = normalisePhone(req.query.phone) === order.customerPhone;
      } catch {
        allowed = false;
      }
    }
    if (!order || !allowed) {
      res.status(404).json({ success: false, message: "Document not found. Check the link or call us." });
      return;
    }

    const { buffer, fileName } = await buildOrderDocument(order, readDocumentType(req.query.type));
    sendPdf(res, buffer, fileName, req.query.download === "1");
  } catch (error) {
    handleError(error, res, "Unable to create the document.");
  }
});

// GET /api/orders/track?orderNumber=...&phone=... — tracking needs both.
ordersRouter.get("/track", limitOrderLookup, async (req, res) => {
  try {
    const orderNumber = readText(req.query.orderNumber, "Order number", { required: true, max: 40 })!.toUpperCase();
    // Links in our SMS carry a token instead of the phone number.
    const viaLink = documentTokenValid(orderNumber, req.query.t);
    const phone = viaLink ? null : normalisePhone(req.query.phone);
    const order = await prisma.order.findUnique({ where: { orderNumber }, include: publicOrderInclude });

    if (!order || (!viaLink && (order.customerPhone ?? "") !== phone)) {
      res.status(404).json({ success: false, message: "We couldn't find an order with that number and phone." });
      return;
    }
    res.json({ success: true, data: { ...toPublicOrder(order, await getSettings()), documents: orderDocumentLinks(order.orderNumber) } });
  } catch (error) {
    handleError(error, res, "Unable to retrieve the order.");
  }
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const ORDER_STATUSES = Object.values(OrderStatus) as string[];
const PAYMENT_STATUSES = Object.values(PaymentStatus) as string[];
const PROCUREMENT_STATUSES = Object.values(ProcurementStatus) as string[];

// GET /api/orders/admin/summary — dashboard figures.
ordersRouter.get("/admin/summary", requireAdmin, async (_req, res) => {
  try {
    const [byStatus, revenue, customers, lowStock, pendingProcurement, openReturns] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.order.aggregate({
        where: { status: { not: "CANCELLED" } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.customer.count(),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Inventory" i JOIN "Product" p ON p."id" = i."productId"
        WHERE p."isActive" = true AND i."quantity" - i."reservedQuantity" <= i."reorderLevel"
      `,
      prisma.procurement.count({
        where: {
          status: { in: ["PENDING", "REQUESTED"] },
          orderItem: { order: { status: { notIn: ["CANCELLED", "DELIVERED"] } } },
        },
      }),
      prisma.returnRequest.count({ where: { status: { in: ["REQUESTED", "APPROVED", "RECEIVED"] } } }),
    ]);

    res.json({
      success: true,
      data: {
        ordersByStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
        activeOrderCount: revenue._count._all,
        revenue: revenue._sum.total ?? 0,
        customerCount: customers,
        lowStockCount: Number(lowStock[0]?.count ?? 0),
        pendingProcurement,
        openReturns,
      },
    });
  } catch (error) {
    handleError(error, res, "Unable to load the order summary.");
  }
});

// GET /api/orders — admin order list.
ordersRouter.get("/", requireAdmin, async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const paymentStatus = String(req.query.paymentStatus ?? "").trim();
    const requestedPage = Number(req.query.page ?? 1);
    const requestedLimit = Number(req.query.limit ?? 20);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 20;

    const where: Prisma.OrderWhereInput = {
      ...(ORDER_STATUSES.includes(status) ? { status: status as OrderStatus } : {}),
      ...(PAYMENT_STATUSES.includes(paymentStatus) ? { paymentStatus: paymentStatus as PaymentStatus } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: "insensitive" } },
              { customerName: { contains: search, mode: "insensitive" } },
              { customerPhone: { contains: search.replace(/\s/g, "").replace(/^0/, "") } },
              { customer: { firstName: { contains: search, mode: "insensitive" } } },
              { customer: { lastName: { contains: search, mode: "insensitive" } } },
              { customer: { phone: { contains: search.replace(/\s/g, "").replace(/^0/, "") } } },
              { customer: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: adminOrderInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: orders.map(toAdminOrder),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    handleError(error, res, "Unable to retrieve orders.");
  }
});

// GET /api/orders/:id/document?type=invoice|delivery-note — staff print or share.
ordersRouter.get("/:id/document", requireAdmin, async (req: AuthenticatedAdminRequest, res) => {
  try {
    const id = String(req.params.id);
    const order = (await loadDocumentOrder({ id })) ?? (await loadDocumentOrder({ orderNumber: id }));
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }
    const type = readDocumentType(req.query.type);
    const { buffer, fileName } = await buildOrderDocument(order, type);
    void audit(req.admin!.email, "order.document", "Order", order.id, { type, orderNumber: order.orderNumber });
    sendPdf(res, buffer, fileName, req.query.download === "1");
  } catch (error) {
    handleError(error, res, "Unable to create the document.");
  }
});

// GET /api/orders/:id/document-links — share links staff can send on WhatsApp.
ordersRouter.get("/:id/document-links", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findFirst({ where: { OR: [{ id }, { orderNumber: id }] }, select: { orderNumber: true } });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }
    res.json({ success: true, data: orderDocumentLinks(order.orderNumber) });
  } catch (error) {
    handleError(error, res, "Unable to create the links.");
  }
});

// GET /api/orders/:id — admin order details.
ordersRouter.get("/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: adminOrderInclude,
    });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }
    res.json({ success: true, data: toAdminOrder(order) });
  } catch (error) {
    handleError(error, res, "Unable to retrieve the order.");
  }
});

function readMoney(value: unknown, field: string): Prisma.Decimal | null {
  if (value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000) {
    throw new ValidationError(`${field} must be 0 or more.`);
  }
  return new Prisma.Decimal(Math.round(number));
}

// PATCH /api/orders/:id — status, payment status and fulfilment details.
ordersRouter.patch("/:id", requireAdmin, async (req: AuthenticatedAdminRequest, res) => {
  try {
    const id = String(req.params.id);
    const body = req.body ?? {};
    const actor = req.admin!.email;

    const status = body.status as string | undefined;
    const paymentStatus = body.paymentStatus as string | undefined;
    if (status !== undefined && !ORDER_STATUSES.includes(status)) throw new ValidationError("Choose a valid order status.");
    if (paymentStatus !== undefined && !PAYMENT_STATUSES.includes(paymentStatus)) throw new ValidationError("Choose a valid payment status.");

    const details: Prisma.OrderUpdateInput = {};
    if (body.fulfilledBy !== undefined) {
      const value = body.fulfilledBy === null || body.fulfilledBy === "" ? null : String(body.fulfilledBy);
      if (value !== null && !["VANA", "SUPPLIER", "COURIER"].includes(value)) throw new ValidationError("Choose who delivers this order.");
      details.fulfilledBy = value;
    }
    if (body.deliveryAssignee !== undefined) details.deliveryAssignee = readText(body.deliveryAssignee, "Rider / courier name", { max: 120 });
    if (body.deliveryAssigneePhone !== undefined) {
      details.deliveryAssigneePhone = body.deliveryAssigneePhone ? normalisePhone(body.deliveryAssigneePhone, "Rider phone") : null;
    }
    if (body.deliveryCost !== undefined) details.deliveryCost = readMoney(body.deliveryCost, "Delivery cost");
    if (body.deliveryProof !== undefined) details.deliveryProof = readText(body.deliveryProof, "Proof of delivery", { max: 1000 });
    if (body.internalNotes !== undefined) details.internalNotes = readText(body.internalNotes, "Internal notes", { max: 4000 });
    if (body.cancellationReason !== undefined) details.cancellationReason = readText(body.cancellationReason, "Cancellation reason", { max: 500 });
    const note = readText(body.note, "Note", { max: 500 });

    if (status === undefined && paymentStatus === undefined && Object.keys(details).length === 0) {
      throw new ValidationError("Nothing to update.");
    }

    const { order, statusChanged, paidNow } = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!existing) throw new ValidationError("Order not found.", 404);

      if (existing.status === "CANCELLED" && status !== undefined && status !== "CANCELLED") {
        throw new OrderConflictError("A cancelled order cannot be reopened. Ask the customer to place a new order.");
      }
      if (status === "CANCELLED" && existing.status !== "CANCELLED" && !details.cancellationReason && !existing.cancellationReason) {
        throw new ValidationError("Give a reason for cancelling. The customer is told by SMS.");
      }

      const lines: StockLine[] = existing.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        productName: item.productName,
      }));

      const changingStatus = status !== undefined && status !== existing.status;
      if (changingStatus) {
        const heldStock = !NON_STOCK_STATUSES.has(existing.status);
        const willHoldStock = !NON_STOCK_STATUSES.has(status!);
        if (heldStock && !willHoldStock) {
          await returnStock(tx, lines, existing.id, actor, status === "CANCELLED" ? "Order cancelled" : "Moved to awaiting stock");
        } else if (!heldStock && willHoldStock) {
          await tx.$executeRaw`SAVEPOINT leave_awaiting`;
          const shortProduct = await deductStock(tx, lines, existing.id, actor);
          if (shortProduct) {
            await tx.$executeRaw`ROLLBACK TO SAVEPOINT leave_awaiting`;
            throw new OrderConflictError(
              `Not enough stock of "${shortProduct}" yet. Update its stock in Inventory first, or keep the order as Awaiting Stock.`,
            );
          }
          await tx.$executeRaw`RELEASE SAVEPOINT leave_awaiting`;
        }
        if (status === "OUT_FOR_DELIVERY" && !existing.dispatchedAt) details.dispatchedAt = new Date();
        if (status === "DELIVERED" && !existing.deliveredAt) details.deliveredAt = new Date();
      }

      const paymentChanging = paymentStatus !== undefined && paymentStatus !== existing.paymentStatus;

      // A manual "Paid" (cash, bank transfer) is recorded as a payment.
      if (paymentChanging && paymentStatus === "PAID") {
        await tx.payment.create({
          data: {
            orderId: existing.id,
            method: existing.paymentMethod === "mobile-money" ? "mobile-money" : existing.paymentMethod === "bank-transfer" ? "bank-transfer" : "cash",
            provider: "manual",
            amount: existing.total,
            status: "PAID",
            merchantReference: `${existing.orderNumber}-MANUAL-${randomBytes(3).toString("hex").toUpperCase()}`,
            verifiedAt: new Date(),
            failureReason: null,
            rawResponse: { recordedBy: actor },
          },
        });
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          ...details,
          ...(changingStatus ? { status: status as OrderStatus } : {}),
          ...(paymentChanging ? { paymentStatus: paymentStatus as PaymentStatus } : {}),
        },
        include: adminOrderInclude,
      });

      if (changingStatus || paymentChanging || note) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            status: updated.status,
            paymentStatus: paymentChanging ? (paymentStatus as PaymentStatus) : null,
            note: note ?? (status === "CANCELLED" ? updated.cancellationReason : null),
            actor,
          },
        });
      }

      return { order: updated, statusChanged: changingStatus, paidNow: paymentChanging && paymentStatus === "PAID" };
    }, TRANSACTION_OPTIONS);

    await audit(actor, "order.update", "Order", id, { status, paymentStatus, ...body });

    if (statusChanged) {
      const event = eventForStatus(order.status);
      if (event) void notifyOrder(order.id, event);
    }
    if (paidNow) void notifyOrder(order.id, "PAYMENT_RECEIVED");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id }, include: adminOrderInclude });
    res.json({ success: true, data: toAdminOrder(fresh) });
  } catch (error) {
    handleError(error, res, "Unable to update the order.");
  }
});

// PATCH /api/orders/items/:itemId/procurement — source an order line.
ordersRouter.patch("/items/:itemId/procurement", requireAdmin, async (req: AuthenticatedAdminRequest, res) => {
  try {
    const itemId = String(req.params.itemId);
    const body = req.body ?? {};
    const item = await prisma.orderItem.findUnique({ where: { id: itemId }, include: { procurement: true } });
    if (!item) throw new ValidationError("Order item not found.", 404);

    const data: Prisma.ProcurementUncheckedUpdateInput = {};

    if (body.supplierId !== undefined) {
      const supplierId = body.supplierId ? String(body.supplierId) : null;
      if (supplierId) {
        const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
        if (!supplier) throw new ValidationError("Supplier not found.");
        // Default the cost to that supplier's wholesale price for this product.
        if (body.unitCost === undefined) {
          const link = await prisma.supplierProduct.findUnique({
            where: { supplierId_productId: { supplierId, productId: item.productId } },
          });
          if (link) data.unitCost = link.wholesalePrice;
        }
      }
      data.supplierId = supplierId;
    }
    if (body.unitCost !== undefined) data.unitCost = readMoney(body.unitCost, "Unit cost");
    if (body.notes !== undefined) data.notes = readText(body.notes, "Notes", { max: 1000 });
    if (body.status !== undefined) {
      if (!PROCUREMENT_STATUSES.includes(String(body.status))) throw new ValidationError("Choose a valid procurement status.");
      data.status = body.status as ProcurementStatus;
      if (body.status === "CONFIRMED" && !item.procurement?.confirmedAt) data.confirmedAt = new Date();
      if (["RECEIVED", "COLLECTED", "SUPPLIER_DISPATCHED"].includes(body.status) && !item.procurement?.receivedAt) {
        data.receivedAt = new Date();
      }
    }

    const procurement = await prisma.procurement.upsert({
      where: { orderItemId: itemId },
      create: { ...(data as Prisma.ProcurementUncheckedCreateInput), orderItemId: itemId },
      update: data,
      include: { supplier: { select: { id: true, name: true, phone: true, deliversDirect: true } } },
    });

    await audit(req.admin!.email, "procurement.update", "OrderItem", itemId, body);
    res.json({ success: true, data: procurement });
  } catch (error) {
    handleError(error, res, "Unable to update procurement.");
  }
});

// POST /api/orders/:id/sms — send a custom SMS to the order's customer.
ordersRouter.post("/:id/sms", requireAdmin, async (req: AuthenticatedAdminRequest, res) => {
  try {
    const id = String(req.params.id);
    const message = readText(req.body?.message, "Message", { required: true, max: 459 })!;
    const order = await prisma.order.findUnique({ where: { id }, include: { customer: true } });
    if (!order) throw new ValidationError("Order not found.", 404);

    const result = await sendSms(order.customerPhone ?? order.customer.phone, message, order.id);
    await audit(req.admin!.email, "order.sms", "Order", id, { message, status: result.status });
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(error, res, "Unable to send the message.");
  }
});

export default ordersRouter;
