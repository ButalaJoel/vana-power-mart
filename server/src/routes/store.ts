import { Router } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, type AuthenticatedAdminRequest } from "../middleware/requireAdmin.js";
import { ValidationError, readBoolean, readText } from "../lib/validation.js";
import { readDate, readMoneyValue, readOptionalInt, sendError } from "../lib/http.js";
import { DEFAULT_SETTINGS, getSettings, saveSettings, type StoreSettings } from "../lib/settings.js";
import { voucherDiscount } from "../lib/pricing.js";
import { mobileMoneyEnabled } from "../lib/payments.js";
import { smsConfigured, toInternationalPhone } from "../lib/sms.js";
import { audit } from "../lib/audit.js";
import { limitVoucherChecks } from "../middleware/rateLimits.js";

// Store configuration: public checkout settings, delivery zones, vouchers,
// store settings and the audit log.
const storeRouter = Router();

// ---------- Public ----------

// GET /api/store/config — what the checkout page needs.
storeRouter.get("/config", async (_req, res) => {
  try {
    const [settings, zones] = await Promise.all([
      getSettings(),
      prisma.deliveryZone.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    ]);
    res.json({
      success: true,
      data: {
        storeName: settings.storeName,
        storePhone: settings.storePhone,
        collectionAddress: settings.collectionAddress,
        freeDeliveryThreshold: settings.freeDeliveryThreshold,
        returnWindowDays: settings.returnWindowDays,
        mobileMoneyEnabled: mobileMoneyEnabled(),
        paymentTestMode: process.env.PAYMENT_PROVIDER === "simulator",
        deliveryZones: zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          fee: Number(zone.fee),
          estimatedTime: zone.estimatedTime,
        })),
      },
    });
  } catch (error) {
    sendError(res, error, "Unable to load store settings.");
  }
});

// POST /api/store/vouchers/check — preview a voucher at checkout.
storeRouter.post("/vouchers/check", limitVoucherChecks, async (req, res) => {
  try {
    const code = readText(req.body?.code, "Voucher code", { required: true, max: 40 })!.toUpperCase();
    const subtotal = readMoneyValue(req.body?.subtotal, "Subtotal", { required: true })!;
    const voucher = await prisma.voucher.findUnique({ where: { code } });
    if (!voucher) throw new ValidationError("That voucher code was not found.");
    const result = voucherDiscount(voucher, subtotal);
    if ("error" in result) throw new ValidationError(result.error);
    res.json({ success: true, data: { code, discount: Number(result.discount), description: voucher.description } });
  } catch (error) {
    sendError(res, error, "Unable to check the voucher.");
  }
});

// ---------- Admin: delivery zones ----------

function readZone(body: Record<string, unknown>, partial: boolean) {
  const data: Prisma.DeliveryZoneUncheckedCreateInput = {} as Prisma.DeliveryZoneUncheckedCreateInput;
  if (!partial || body.name !== undefined) data.name = readText(body.name, "Zone name", { required: true, max: 100 })!;
  if (!partial || body.fee !== undefined) data.fee = readMoneyValue(body.fee, "Delivery fee", { required: true })!;
  if (body.estimatedTime !== undefined) data.estimatedTime = readText(body.estimatedTime, "Estimated time", { max: 80 });
  if (body.isActive !== undefined) data.isActive = readBoolean(body.isActive, "Active");
  if (body.sortOrder !== undefined) data.sortOrder = readOptionalInt(body.sortOrder, "Sort order", 0, 1000) ?? 0;
  return data;
}

// GET /api/store/sitemap.xml — every live page for search engines.
// Point https://your-domain/sitemap.xml here (a rewrite on your host).
storeRouter.get("/sitemap.xml", async (_req, res) => {
  try {
    const site = (process.env.PUBLIC_SITE_URL ?? "http://localhost:5173").replace(/\/$/, "");
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, category: { isActive: true } },
        select: { slug: true, updatedAt: true },
      }),
      prisma.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    ]);
    const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const entry = (path: string, updated?: Date) =>
      `  <url><loc>${escape(site + path)}</loc>${updated ? `<lastmod>${updated.toISOString().slice(0, 10)}</lastmod>` : ""}</url>`;
    const urls = [
      entry("/"),
      entry("/products"),
      ...categories.map((category) => entry(`/categories/${encodeURIComponent(category.slug)}`, category.updatedAt)),
      ...products.map((product) => entry(`/products/${encodeURIComponent(product.slug)}`, product.updatedAt)),
      entry("/contact"),
      entry("/privacy"),
      entry("/terms"),
    ];
    res
      .type("application/xml")
      .set("Cache-Control", "public, max-age=3600")
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
  } catch (error) {
    sendError(res, error, "Unable to build the sitemap.");
  }
});

storeRouter.get("/delivery-zones", requireAdmin, async (_req, res) => {
  try {
    const zones = await prisma.deliveryZone.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { orders: true } } },
    });
    res.json({ success: true, data: zones });
  } catch (error) {
    sendError(res, error, "Unable to load delivery zones.");
  }
});

storeRouter.post("/delivery-zones", requireAdmin, async (req: AuthenticatedAdminRequest, res) => {
  try {
    const zone = await prisma.deliveryZone.create({ data: readZone(req.body ?? {}, false) });
    await audit(req.admin!.email, "deliveryZone.create", "DeliveryZone", zone.id, req.body);
    res.status(201).json({ success: true, data: zone });
  } catch (error) {
    sendError(res, error, "Unable to create the zone.", "A zone with that name already exists.");
  }
});

storeRouter.put("/delivery-zones/:id", requireAdmin, async (req: AuthenticatedAdminRequest, res) => {
  try {
    const id = String(req.params.id);
    const zone = await prisma.deliveryZone.update({ where: { id }, data: readZone(req.body ?? {}, true) });
    await audit(req.admin!.email, "deliveryZone.update", "DeliveryZone", id, req.body);
    res.json({ success: true, data: zone });
  } catch (error) {
    sendError(res, error, "Unable to update the zone.", "A zone with that name already exists.");
  }
});

// ---------- Admin: vouchers ----------

function readVoucher(body: Record<string, unknown>, partial: boolean) {
  const data: Record<string, unknown> = {};
  if (!partial || body.code !== undefined) {
    const code = readText(body.code, "Code", { required: true, max: 40 })!.toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new ValidationError("Codes use 3–40 letters, numbers, - or _.");
    data.code = code;
  }
  if (body.description !== undefined) data.description = readText(body.description, "Description", { max: 300 });
  if (!partial || body.type !== undefined) {
    if (!["PERCENT", "FIXED"].includes(String(body.type))) throw new ValidationError("Choose percent or fixed amount.");
    data.type = body.type;
  }
  if (!partial || body.value !== undefined) {
    const value = readMoneyValue(body.value, "Value", { required: true })!;
    if ((body.type ?? "") === "PERCENT" && value.greaterThan(100)) throw new ValidationError("A percentage can't exceed 100.");
    if (value.lessThanOrEqualTo(0)) throw new ValidationError("Value must be more than 0.");
    data.value = value;
  }
  if (body.minOrderAmount !== undefined) data.minOrderAmount = readMoneyValue(body.minOrderAmount, "Minimum order");
  if (body.maxDiscount !== undefined) data.maxDiscount = readMoneyValue(body.maxDiscount, "Maximum discount");
  if (body.usageLimit !== undefined) data.usageLimit = readOptionalInt(body.usageLimit, "Usage limit", 1, 1_000_000);
  if (body.startsAt !== undefined) data.startsAt = readDate(body.startsAt, "Start date");
  if (body.endsAt !== undefined) data.endsAt = readDate(body.endsAt, "End date");
  if (body.isActive !== undefined) data.isActive = readBoolean(body.isActive, "Active");
  return data as Prisma.VoucherUncheckedCreateInput;
}

storeRouter.get("/vouchers", requireAdmin, async (_req, res) => {
  try {
    res.json({ success: true, data: await prisma.voucher.findMany({ orderBy: { createdAt: "desc" } }) });
  } catch (error) {
    sendError(res, error, "Unable to load vouchers.");
  }
});

storeRouter.post("/vouchers", requireAdmin, async (req: AuthenticatedAdminRequest, res) => {
  try {
    const voucher = await prisma.voucher.create({ data: readVoucher(req.body ?? {}, false) });
    await audit(req.admin!.email, "voucher.create", "Voucher", voucher.id, req.body);
    res.status(201).json({ success: true, data: voucher });
  } catch (error) {
    sendError(res, error, "Unable to create the voucher.", "That voucher code already exists.");
  }
});

storeRouter.put("/vouchers/:id", requireAdmin, async (req: AuthenticatedAdminRequest, res) => {
  try {
    const id = String(req.params.id);
    const voucher = await prisma.voucher.update({ where: { id }, data: readVoucher(req.body ?? {}, true) });
    await audit(req.admin!.email, "voucher.update", "Voucher", id, req.body);
    res.json({ success: true, data: voucher });
  } catch (error) {
    sendError(res, error, "Unable to update the voucher.", "That voucher code already exists.");
  }
});

// ---------- Admin: settings ----------

storeRouter.get("/settings", requireAdmin, async (_req, res) => {
  try {
    res.json({
      success: true,
      data: await getSettings(),
      meta: {
        smsConfigured: smsConfigured(),
        paymentProvider: process.env.PAYMENT_PROVIDER ?? null,
        mobileMoneyEnabled: mobileMoneyEnabled(),
      },
    });
  } catch (error) {
    sendError(res, error, "Unable to load settings.");
  }
});

storeRouter.put("/settings", requireAdmin, async (req: AuthenticatedAdminRequest, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const update: Partial<StoreSettings> = {};

    if (body.storeName !== undefined) update.storeName = readText(body.storeName, "Store name", { required: true, max: 80 })!;
    if (body.storePhone !== undefined) update.storePhone = readText(body.storePhone, "Store phone", { max: 40 }) ?? "";
    if (body.collectionAddress !== undefined) update.collectionAddress = readText(body.collectionAddress, "Collection address", { max: 300 }) ?? "";
    if (body.staffAlertPhones !== undefined) {
      const list = Array.isArray(body.staffAlertPhones) ? body.staffAlertPhones : String(body.staffAlertPhones).split(/[,\n]/);
      const phones = list.map((value) => String(value).trim()).filter(Boolean);
      const invalid = phones.find((value) => !toInternationalPhone(value));
      if (invalid) throw new ValidationError(`"${invalid}" is not a valid Ugandan phone number.`);
      update.staffAlertPhones = phones.map((value) => toInternationalPhone(value)!).slice(0, 10);
    }
    if (body.freeDeliveryThreshold !== undefined) {
      const value = readMoneyValue(body.freeDeliveryThreshold, "Free delivery threshold");
      update.freeDeliveryThreshold = value === null ? null : Number(value);
    }
    if (body.stockConfirmationDays !== undefined) {
      update.stockConfirmationDays = readOptionalInt(body.stockConfirmationDays, "Stock confirmation days", 1, 90) ?? DEFAULT_SETTINGS.stockConfirmationDays;
    }
    if (body.returnWindowDays !== undefined) {
      update.returnWindowDays = readOptionalInt(body.returnWindowDays, "Return window days", 0, 60) ?? DEFAULT_SETTINGS.returnWindowDays;
    }
    if (body.storeEmail !== undefined) update.storeEmail = readText(body.storeEmail, "Store email", { max: 120 }) ?? "";
    if (body.taxId !== undefined) update.taxId = readText(body.taxId, "TIN", { max: 40 }) ?? "";
    if (body.documentNote !== undefined) update.documentNote = readText(body.documentNote, "Document note", { max: 500 }) ?? "";

    const settings = await saveSettings(update);
    await audit(req.admin!.email, "settings.update", "Setting", null, update as Record<string, unknown>);
    res.json({ success: true, data: settings });
  } catch (error) {
    sendError(res, error, "Unable to save settings.");
  }
});

// ---------- Admin: audit log ----------

storeRouter.get("/audit", requireAdmin, async (req, res) => {
  try {
    const entity = String(req.query.entity ?? "").trim();
    const logs = await prisma.auditLog.findMany({
      where: entity ? { entity } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    sendError(res, error, "Unable to load the audit log.");
  }
});

export default storeRouter;
