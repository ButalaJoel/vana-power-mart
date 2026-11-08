import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, type AuthenticatedAdminRequest } from "../middleware/requireAdmin.js";
import { ValidationError, readText } from "../lib/validation.js";
import { readOptionalInt, sendError } from "../lib/http.js";
import { adjustStock } from "../lib/stock.js";
import { getSettings } from "../lib/settings.js";
import { audit } from "../lib/audit.js";

// Admin stock view: sellable stock per product plus what suppliers report.
const inventoryRouter = Router();
inventoryRouter.use(requireAdmin);

// GET /api/inventory
inventoryRouter.get("/", async (_req, res) => {
  try {
    const settings = await getSettings();
    const staleBefore = new Date(Date.now() - settings.stockConfirmationDays * 86_400_000);

    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        category: { select: { name: true } },
        inventory: true,
        variants: { orderBy: { createdAt: "asc" }, take: 1 },
        supplierProducts: { include: { supplier: { select: { id: true, name: true, isActive: true } } } },
      },
    });

    const data = products.map((product) => {
      const offers = product.supplierProducts.filter((offer) => offer.supplier.isActive);
      const fresh = offers.filter((offer) => offer.confirmedAt && offer.confirmedAt >= staleBefore);
      const preferred = offers.find((offer) => offer.isPreferred) ?? null;
      const cheapest = offers.reduce<(typeof offers)[number] | null>(
        (best, offer) => (!best || offer.wholesalePrice.lessThan(best.wholesalePrice) ? offer : best),
        null,
      );
      const sellingPrice = Number(product.variants[0]?.price ?? product.price);
      const costBasis = preferred ?? cheapest;
      const lastConfirmedAt = offers.reduce<Date | null>(
        (latest, offer) => (offer.confirmedAt && (!latest || offer.confirmedAt > latest) ? offer.confirmedAt : latest),
        null,
      );

      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category.name,
        isActive: product.isActive,
        sellingPrice,
        quantity: product.inventory?.quantity ?? 0,
        reservedQuantity: product.inventory?.reservedQuantity ?? 0,
        reorderLevel: product.inventory?.reorderLevel ?? 0,
        supplierCount: offers.length,
        freshSupplierQuantity: fresh.reduce((sum, offer) => sum + offer.availableQuantity, 0),
        lastConfirmedAt,
        stale: offers.length > 0 && fresh.length === 0,
        noSupplier: offers.length === 0,
        preferredSupplier: preferred ? { id: preferred.supplier.id, name: preferred.supplier.name } : null,
        unitCost: costBasis ? Number(costBasis.wholesalePrice) : null,
        unitMargin: costBasis ? sellingPrice - Number(costBasis.wholesalePrice) : null,
        offers: offers.map((offer) => ({
          supplierId: offer.supplier.id,
          supplierName: offer.supplier.name,
          wholesalePrice: Number(offer.wholesalePrice),
          availableQuantity: offer.availableQuantity,
          confirmedAt: offer.confirmedAt,
          isPreferred: offer.isPreferred,
          leadTimeDays: offer.leadTimeDays,
          stale: !offer.confirmedAt || offer.confirmedAt < staleBefore,
        })),
      };
    });

    res.json({ success: true, data, meta: { stockConfirmationDays: settings.stockConfirmationDays } });
  } catch (error) {
    sendError(res, error, "Unable to load inventory.");
  }
});

// POST /api/inventory/:productId/adjust — { set } or { add }, with a note.
inventoryRouter.post("/:productId/adjust", async (req: AuthenticatedAdminRequest, res) => {
  try {
    const productId = String(req.params.productId);
    const body = req.body ?? {};
    const set = readOptionalInt(body.set, "New stock");
    const add = body.add === undefined || body.add === "" ? null : Number(body.add);
    if (set === null && (add === null || !Number.isInteger(add) || add === 0)) {
      throw new ValidationError("Enter the new stock, or a whole number to add or remove.");
    }
    const note = readText(body.note, "Reason", { max: 300 });

    const result = await prisma.$transaction((tx) =>
      adjustStock(tx, productId, set !== null ? { set } : { add: add! }, "ADJUSTMENT", { note, actor: req.admin!.email }),
    );
    await audit(req.admin!.email, "stock.adjust", "Product", productId, { ...body, result });
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && /Stock cannot/.test(error.message)) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    sendError(res, error, "Unable to adjust stock.");
  }
});

// POST /api/inventory/:productId/sync-suppliers — set sellable stock to the
// total of fresh supplier confirmations.
inventoryRouter.post("/:productId/sync-suppliers", async (req: AuthenticatedAdminRequest, res) => {
  try {
    const productId = String(req.params.productId);
    const settings = await getSettings();
    const staleBefore = new Date(Date.now() - settings.stockConfirmationDays * 86_400_000);
    const offers = await prisma.supplierProduct.findMany({
      where: { productId, confirmedAt: { gte: staleBefore }, supplier: { isActive: true } },
    });
    if (offers.length === 0) {
      throw new ValidationError(
        `No supplier has confirmed stock in the last ${settings.stockConfirmationDays} days. Confirm with a supplier first.`,
      );
    }
    const total = offers.reduce((sum, offer) => sum + offer.availableQuantity, 0);
    const result = await prisma.$transaction((tx) =>
      adjustStock(tx, productId, { set: total }, "SUPPLIER_CONFIRMATION", {
        note: `Set from ${offers.length} supplier confirmation(s)`,
        actor: req.admin!.email,
      }),
    );
    await audit(req.admin!.email, "stock.syncSuppliers", "Product", productId, { total });
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && /Stock cannot/.test(error.message)) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    sendError(res, error, "Unable to update stock from suppliers.");
  }
});

// GET /api/inventory/:productId/movements
inventoryRouter.get("/:productId/movements", async (req, res) => {
  try {
    const movements = await prisma.stockMovement.findMany({
      where: { productId: String(req.params.productId) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ success: true, data: movements });
  } catch (error) {
    sendError(res, error, "Unable to load stock history.");
  }
});

export default inventoryRouter;
