import { Router } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, type AuthenticatedAdminRequest } from "../middleware/requireAdmin.js";
import { ValidationError, readBoolean, readText } from "../lib/validation.js";
import { readDate, readMoneyValue, readOptionalInt, sendError } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { getSettings } from "../lib/settings.js";

// Suppliers and what each supplier offers for our products.
const suppliersRouter = Router();
suppliersRouter.use(requireAdmin);

function readSupplier(body: Record<string, unknown>, partial: boolean): Prisma.SupplierUncheckedCreateInput {
  const data: Record<string, unknown> = {};
  if (!partial || body.name !== undefined) data.name = readText(body.name, "Supplier name", { required: true, max: 150 });
  if (body.contactPerson !== undefined) data.contactPerson = readText(body.contactPerson, "Contact person", { max: 120 });
  if (body.phone !== undefined) data.phone = readText(body.phone, "Phone", { max: 40 });
  if (body.email !== undefined) data.email = readText(body.email, "Email", { max: 200 });
  if (body.location !== undefined) data.location = readText(body.location, "Location", { max: 200 });
  if (body.notes !== undefined) data.notes = readText(body.notes, "Notes", { max: 4000 });
  if (body.deliversDirect !== undefined) data.deliversDirect = readBoolean(body.deliversDirect, "Delivers direct");
  if (body.leadTimeDays !== undefined) data.leadTimeDays = readOptionalInt(body.leadTimeDays, "Lead time (days)", 0, 365);
  if (body.isActive !== undefined) data.isActive = readBoolean(body.isActive, "Active");
  return data as Prisma.SupplierUncheckedCreateInput;
}

// GET /api/suppliers
suppliersRouter.get("/", async (_req, res) => {
  try {
    const settings = await getSettings();
    const staleBefore = new Date(Date.now() - settings.stockConfirmationDays * 86_400_000);

    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { products: true, procurements: true } },
        products: { select: { confirmedAt: true } },
      },
    });

    res.json({
      success: true,
      data: suppliers.map(({ products, ...supplier }) => ({
        ...supplier,
        staleConfirmations: products.filter((item) => !item.confirmedAt || item.confirmedAt < staleBefore).length,
        lastConfirmedAt: products.reduce<Date | null>(
          (latest, item) => (item.confirmedAt && (!latest || item.confirmedAt > latest) ? item.confirmedAt : latest),
          null,
        ),
      })),
    });
  } catch (error) {
    sendError(res, error, "Unable to load suppliers.");
  }
});

// GET /api/suppliers/:id — with the products they supply.
suppliersRouter.get("/:id", async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: String(req.params.id) },
      include: {
        products: {
          orderBy: { product: { name: "asc" } },
          include: { product: { select: { id: true, name: true, sku: true, price: true, isActive: true, imageUrls: true } } },
        },
      },
    });
    if (!supplier) throw new ValidationError("Supplier not found.", 404);
    res.json({ success: true, data: supplier });
  } catch (error) {
    sendError(res, error, "Unable to load the supplier.");
  }
});

suppliersRouter.post("/", async (req: AuthenticatedAdminRequest, res) => {
  try {
    const supplier = await prisma.supplier.create({ data: readSupplier(req.body ?? {}, false) });
    await audit(req.admin!.email, "supplier.create", "Supplier", supplier.id, { name: supplier.name });
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    sendError(res, error, "Unable to create the supplier.");
  }
});

suppliersRouter.put("/:id", async (req: AuthenticatedAdminRequest, res) => {
  try {
    const id = String(req.params.id);
    const supplier = await prisma.supplier.update({ where: { id }, data: readSupplier(req.body ?? {}, true) });
    await audit(req.admin!.email, "supplier.update", "Supplier", id, req.body);
    res.json({ success: true, data: supplier });
  } catch (error) {
    sendError(res, error, "Unable to update the supplier.");
  }
});

// ---------- Supplier offers (price and stock per product) ----------

// PUT /api/suppliers/:id/products/:productId — create or update an offer.
// Sending availableQuantity (or confirm: true) stamps a fresh confirmation date.
suppliersRouter.put("/:id/products/:productId", async (req: AuthenticatedAdminRequest, res) => {
  try {
    const supplierId = String(req.params.id);
    const productId = String(req.params.productId);
    const body = req.body ?? {};

    const [supplier, product] = await Promise.all([
      prisma.supplier.findUnique({ where: { id: supplierId } }),
      prisma.product.findUnique({ where: { id: productId } }),
    ]);
    if (!supplier) throw new ValidationError("Supplier not found.", 404);
    if (!product) throw new ValidationError("Product not found.", 404);

    const existing = await prisma.supplierProduct.findUnique({
      where: { supplierId_productId: { supplierId, productId } },
    });

    const data: Prisma.SupplierProductUncheckedUpdateInput = {};
    if (body.wholesalePrice !== undefined || !existing) {
      data.wholesalePrice = readMoneyValue(body.wholesalePrice, "Wholesale price", { required: true })!;
    }
    if (body.availableQuantity !== undefined) {
      data.availableQuantity = readOptionalInt(body.availableQuantity, "Available quantity") ?? 0;
    }
    if (body.supplierSku !== undefined) data.supplierSku = readText(body.supplierSku, "Supplier SKU", { max: 80 });
    if (body.leadTimeDays !== undefined) data.leadTimeDays = readOptionalInt(body.leadTimeDays, "Lead time (days)", 0, 365);
    if (body.notes !== undefined) data.notes = readText(body.notes, "Notes", { max: 1000 });
    if (body.isPreferred !== undefined) data.isPreferred = readBoolean(body.isPreferred, "Preferred");

    if (body.confirmedAt !== undefined) {
      data.confirmedAt = readDate(body.confirmedAt, "Confirmation date");
    } else if (body.availableQuantity !== undefined || body.confirm === true || !existing) {
      data.confirmedAt = new Date();
    }

    const offer = await prisma.$transaction(async (tx) => {
      // Only one preferred supplier per product.
      if (data.isPreferred === true) {
        await tx.supplierProduct.updateMany({ where: { productId, NOT: { supplierId } }, data: { isPreferred: false } });
      }
      return tx.supplierProduct.upsert({
        where: { supplierId_productId: { supplierId, productId } },
        create: { ...(data as Prisma.SupplierProductUncheckedCreateInput), supplierId, productId },
        update: data,
        include: { supplier: { select: { id: true, name: true } }, product: { select: { id: true, name: true } } },
      });
    });

    await audit(req.admin!.email, "supplierProduct.upsert", "SupplierProduct", offer.id, body);
    res.json({ success: true, data: offer });
  } catch (error) {
    sendError(res, error, "Unable to save the supplier price.");
  }
});

// DELETE /api/suppliers/:id/products/:productId
suppliersRouter.delete("/:id/products/:productId", async (req: AuthenticatedAdminRequest, res) => {
  try {
    const supplierId = String(req.params.id);
    const productId = String(req.params.productId);
    await prisma.supplierProduct.delete({ where: { supplierId_productId: { supplierId, productId } } });
    await audit(req.admin!.email, "supplierProduct.delete", "SupplierProduct", `${supplierId}:${productId}`);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error, "Unable to remove the supplier price.");
  }
});

export default suppliersRouter;
