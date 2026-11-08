
import { Router } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, type AuthenticatedAdminRequest } from "../middleware/requireAdmin.js";
import { recordStockMovement } from "../lib/stock.js";

const productsRouter = Router();

const MAX_IMAGES = 8;

// Allow extra time to obtain a pooled connection (see the earlier P2028 issue).
const TRANSACTION_OPTIONS = { maxWait: 10000, timeout: 20000 };

const productInclude = {
  category: true,
  inventory: true,
  variants: {
    where: { isActive: true },
    orderBy: { createdAt: "asc" as const },
    include: { inventory: true },
  },
} satisfies Prisma.ProductInclude;

// The admin sees inactive variants too, so editing a deactivated product
// still shows its model number and price.
const adminProductInclude = {
  category: true,
  inventory: true,
  variants: {
    orderBy: { createdAt: "asc" as const },
    include: { inventory: true },
  },
  supplierProducts: {
    orderBy: { wholesalePrice: "asc" as const },
    include: { supplier: { select: { id: true, name: true, isActive: true } } },
  },
} satisfies Prisma.ProductInclude;

// Flash-sale fields from the admin form. Returns only the keys that were sent.
function parseSale(body: Record<string, unknown>) {
  const data: { salePrice?: Prisma.Decimal | null; saleStartsAt?: Date | null; saleEndsAt?: Date | null } = {};
  if (body.salePrice !== undefined) {
    if (body.salePrice === null || body.salePrice === "") data.salePrice = null;
    else {
      const value = Number(body.salePrice);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Sale price must be greater than 0.");
      data.salePrice = new Prisma.Decimal(Math.round(value));
    }
  }
  for (const key of ["saleStartsAt", "saleEndsAt"] as const) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === "") data[key] = null;
    else {
      const date = new Date(String(body[key]));
      if (Number.isNaN(date.getTime())) throw new Error("Sale dates must be valid dates.");
      data[key] = date;
    }
  }
  if (data.saleStartsAt && data.saleEndsAt && data.saleEndsAt <= data.saleStartsAt) {
    throw new Error("Sale end must be after the sale start.");
  }
  return data;
}

// Average rating and count per product, for listing cards.
async function ratingsFor(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, { average: number; count: number }>();
  const rows = await prisma.review.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, isVisible: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.productId, { average: Math.round((row._avg.rating ?? 0) * 10) / 10, count: row._count._all }]));
}

// Read an optional stock number from the admin form.
function parseStock(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  const number = Number(value);

  if (!Number.isInteger(number) || number < 0 || number > 1000000) {
    throw new Error(`${field} must be a whole number of 0 or more.`);
  }

  return number;
}

// ---------- Validation helpers ----------

function createSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parsePrice(value: unknown, required = true): string | null {
  if (value === null || value === undefined || value === "") {
    if (!required) return null;
    throw new Error("Selling price is required.");
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error("Enter a valid price greater than zero.");
  }

  if (number > 9999999999.99) {
    throw new Error("Price exceeds the supported limit.");
  }

  return number.toFixed(2);
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;

  throw new Error("Boolean fields must be true or false.");
}

function parseText(
  value: unknown,
  field: string,
  maxLength = 500,
  required = false,
): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`${field} is required.`);
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be text.`);
  }

  const result = value.trim();

  if (required && !result) {
    throw new Error(`${field} is required.`);
  }

  if (result.length > maxLength) {
    throw new Error(`${field} must not exceed ${maxLength} characters.`);
  }

  return result || null;
}

function parseImageUrls(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_IMAGES) {
    throw new Error(`Product images must be an array of up to ${MAX_IMAGES} URLs.`);
  }

  for (const url of value) {
    if (typeof url !== "string") {
      throw new Error("Every product image must be a URL.");
    }

    // Seeded products use images bundled with the storefront (e.g. "/products/x.jpg").
    if (url.startsWith("/") && !url.startsWith("//") && url.length <= 500) {
      continue;
    }

    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      throw new Error("One or more product image URLs are invalid.");
    }

    if (parsed.protocol !== "https:") {
      throw new Error("Product image URLs must use HTTPS.");
    }
  }

  return value as string[];
}

function parseJsonObject(
  value: unknown,
  field: string,
): Prisma.InputJsonValue {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(`${field} must be a JSON object.`);
  }

  return value as Prisma.InputJsonValue;
}

function handleRouteError(
  error: unknown,
  res: import("express").Response,
  fallbackMessage: string,
) {
  if (error instanceof Error) {
    if (
      error.message.includes("price") ||
      error.message.includes("Price") ||
      error.message.includes("SKU") ||
      error.message.includes("category") ||
      error.message.includes("Category") ||
      error.message.includes("image") ||
      error.message.includes("Image") ||
      error.message.includes("required") ||
      error.message.includes("Boolean") ||
      error.message.includes("characters") ||
      error.message.includes("HTTPS") ||
      error.message.includes("JSON") ||
      error.message.includes("text") ||
      error.message.includes("Stock") ||
      error.message.includes("Sale") ||
      error.message.includes("Reorder") ||
      error.message.includes("whole number")
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    res.status(409).json({
      success: false,
      message: "That SKU or product identifier already exists.",
    });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    res.status(404).json({
      success: false,
      message: "The requested product or related record was not found.",
    });
    return;
  }

  console.error(fallbackMessage, error);

  res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
}

// ---------- Public catalogue ----------

// GET /api/products
productsRouter.get("/", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const categorySlug = String(req.query.category ?? "").trim();

    const requestedPage = Number(req.query.page ?? 1);
    const requestedLimit = Number(req.query.limit ?? 20);

    const page =
      Number.isInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 20;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      // Products in deactivated categories are hidden from the storefront.
      // A parent category also shows its subcategories' products.
      category: categorySlug
        ? { isActive: true, OR: [{ slug: categorySlug }, { parent: { slug: categorySlug, isActive: true } }] }
        : { isActive: true },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const sort = String(req.query.sort ?? "newest");
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === "price-asc"
        ? { price: "asc" }
        : sort === "price-desc"
          ? { price: "desc" }
          : sort === "name"
            ? { name: "asc" }
            : { createdAt: "desc" };

    const [products, total] = await Promise.all([
  prisma.product.findMany({
    where,
    include: productInclude,
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
  }),
  prisma.product.count({ where }),
]);

    const ratings = await ratingsFor(products.map((product) => product.id));

    res.json({
      success: true,
      data: products.map((product) => ({ ...product, rating: ratings.get(product.id) ?? null })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch products:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve products.",
    });
  }
});

// ---------- Admin: full catalogue ----------

// GET /api/products/admin/all
// Every product, including inactive ones and inactive variants.
// Registered before "/:identifier" so "admin" is not treated as a slug.
// The admin Products page filters and paginates this list locally.
productsRouter.get("/admin/all", requireAdmin, async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: adminProductInclude,
      orderBy: { createdAt: "desc" },
      take: 2000,
    });

    res.json({ success: true, data: products });
  } catch (error) {
    handleRouteError(error, res, "Unable to retrieve products.");
  }
});

// GET /api/products/:identifier
productsRouter.get("/:identifier", async (req, res) => {
  try {
    const identifier = String(req.params.identifier);

    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        OR: [{ id: identifier }, { slug: identifier }],
      },
      include: productInclude,
    });

    if (!product || !product.category.isActive) {
      res.status(404).json({
        success: false,
        message: "Product not found.",
      });
      return;
    }

    const ratings = await ratingsFor([product.id]);

    res.json({
      success: true,
      data: { ...product, rating: ratings.get(product.id) ?? null },
    });
  } catch (error) {
    console.error("Failed to fetch product details:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve product details.",
    });
  }
});

// ---------- Admin: create product ----------

// POST /api/products
productsRouter.post("/", requireAdmin, async (req, res) => {
  try {
    const body = req.body ?? {};

    const name = parseText(body.name, "Product name", 200, true)!;
    const sku = parseText(body.sku, "SKU", 100, true)!;
    const categoryId = parseText(body.categoryId, "Category", 100, true)!;

    const description = parseText(body.description, "Description", 5000);
    const modelNumber = parseText(body.modelNumber, "Model number", 150);

    const price = parsePrice(body.price)!;
    const compareAtPrice = parsePrice(body.compareAtPrice, false);

    if (compareAtPrice && Number(compareAtPrice) <= Number(price)) {
      throw new Error("Compare-at price must be greater than the selling price.");
    }

    const imageUrls =
      body.imageUrls === undefined ? [] : parseImageUrls(body.imageUrls);

    const specifications = parseJsonObject(
      body.specifications ?? {},
      "Specifications",
    );

    const options = parseJsonObject(body.options ?? {}, "Variant options");

    const isActive = parseBoolean(body.isActive, true);
    const isFeatured = parseBoolean(body.isFeatured, false);

    const stockQuantity = parseStock(body.stockQuantity, "Stock quantity") ?? 0;
    const reorderLevel = parseStock(body.reorderLevel, "Reorder level") ?? 2;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    });

    if (!category || !category.isActive) {
      res.status(400).json({
        success: false,
        message: "Select an active category.",
      });
      return;
    }

    const slugBase = createSlug(name);

    if (!slugBase) {
      res.status(400).json({
        success: false,
        message: "Enter a valid product name.",
      });
      return;
    }

    // The suffix keeps different products with the same name unique.
    const slug = `${slugBase}-${cryptoRandomSuffix()}`;

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name,
          slug,
          sku,
          description,
          price: new Prisma.Decimal(price),
          compareAtPrice: compareAtPrice
            ? new Prisma.Decimal(compareAtPrice)
            : null,
          imageUrls,
          specifications,
          isActive,
          isFeatured,
          categoryId,
          ...parseSale(body),
        },
      });

      const variant = await tx.productVariant.create({
        data: {
          productId: created.id,
          sku,
          modelNumber,
          price: new Prisma.Decimal(price),
          compareAtPrice: compareAtPrice
            ? new Prisma.Decimal(compareAtPrice)
            : null,
          options,
          specifications,
          isActive,
        },
      });

      // One inventory row is linked to both the product and its first variant.
      await tx.inventory.create({
        data: {
          productId: created.id,
          variantId: variant.id,
          quantity: stockQuantity,
          reservedQuantity: 0,
          reorderLevel,
        },
      });

      await recordStockMovement(tx, created.id, stockQuantity, "OPENING", {
        note: "Stock when the product was created",
        actor: (req as AuthenticatedAdminRequest).admin?.email,
      });

      return tx.product.findUniqueOrThrow({
        where: { id: created.id },
        include: adminProductInclude,
      });
    }, TRANSACTION_OPTIONS);

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    handleRouteError(error, res, "Unable to create product.");
  }
});

// ---------- Admin: update product ----------

// PUT /api/products/:id
productsRouter.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const body = req.body ?? {};

    const existing = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: "Product not found.",
      });
      return;
    }

    const data: Prisma.ProductUpdateInput = {};

    if (body.name !== undefined) {
      const name = parseText(body.name, "Product name", 200, true)!;
      data.name = name;

      // Keep the existing URL unless the product was actually renamed,
      // so storefront links and saved carts keep working.
      if (name !== existing.name) {
        data.slug = `${createSlug(name)}-${cryptoRandomSuffix()}`;
      }
    }

    if (body.description !== undefined) {
      data.description = parseText(body.description, "Description", 5000);
    }

    if (body.sku !== undefined) {
      data.sku = parseText(body.sku, "SKU", 100, true)!;
    }

    if (body.categoryId !== undefined) {
      const categoryId = parseText(body.categoryId, "Category", 100, true)!;
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true, isActive: true },
      });

      if (!category || !category.isActive) {
        res.status(400).json({
          success: false,
          message: "Select an active category.",
        });
        return;
      }

      data.category = { connect: { id: categoryId } };
    }

    let price: string | undefined;
    let compareAtPrice: string | null | undefined;

    if (body.price !== undefined) {
      price = parsePrice(body.price)!;
      data.price = new Prisma.Decimal(price);
    }

    if (body.compareAtPrice !== undefined) {
      compareAtPrice = parsePrice(body.compareAtPrice, false);
      data.compareAtPrice = compareAtPrice
        ? new Prisma.Decimal(compareAtPrice)
        : null;
    }

    const effectivePrice = price ?? existing.price.toString();
    const effectiveCompareAt =
      compareAtPrice === undefined
        ? existing.compareAtPrice?.toString() ?? null
        : compareAtPrice;

    if (
      effectiveCompareAt &&
      Number(effectiveCompareAt) <= Number(effectivePrice)
    ) {
      throw new Error("Compare-at price must be greater than the selling price.");
    }

    if (body.imageUrls !== undefined) {
      data.imageUrls = parseImageUrls(body.imageUrls);
    }

    if (body.specifications !== undefined) {
      data.specifications = parseJsonObject(
        body.specifications,
        "Specifications",
      );
    }

    if (body.isActive !== undefined) {
      data.isActive = parseBoolean(body.isActive, existing.isActive);
    }

    if (body.isFeatured !== undefined) {
      data.isFeatured = parseBoolean(body.isFeatured, existing.isFeatured);
    }

    Object.assign(data, parseSale(body));

    const stockQuantity = parseStock(body.stockQuantity, "Stock quantity");
    const reorderLevel = parseStock(body.reorderLevel, "Reorder level");

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data,
      });

      // Keep the default sellable variant aligned with the product-level
      // price and SKU while preserving other variants' individual values.
      const primaryVariant = existing.variants[0];

      if (primaryVariant) {
        const variantData: Prisma.ProductVariantUpdateInput = {};

        if (body.sku !== undefined) {
          variantData.sku = parseText(body.sku, "SKU", 100, true)!;
        }

        if (body.price !== undefined) {
          variantData.price = new Prisma.Decimal(price!);
        }

        if (body.compareAtPrice !== undefined) {
          variantData.compareAtPrice = compareAtPrice
            ? new Prisma.Decimal(compareAtPrice)
            : null;
        }

        if (body.modelNumber !== undefined) {
          variantData.modelNumber = parseText(
            body.modelNumber,
            "Model number",
            150,
          );
        }

        if (body.options !== undefined) {
          variantData.options = parseJsonObject(body.options, "Variant options");
        }

        if (body.specifications !== undefined) {
          variantData.specifications = parseJsonObject(
            body.specifications,
            "Specifications",
          );
        }

        if (body.isActive !== undefined) {
          variantData.isActive = parseBoolean(
            body.isActive,
            primaryVariant.isActive,
          );
        }

        if (Object.keys(variantData).length > 0) {
          await tx.productVariant.update({
            where: { id: primaryVariant.id },
            data: variantData,
          });
        }
      } else if (body.price !== undefined || body.sku !== undefined) {
        // A product without variants gets a default sellable variant.
        const variant = await tx.productVariant.create({
          data: {
            productId: id,
            sku: body.sku !== undefined
              ? parseText(body.sku, "SKU", 100, true)!
              : existing.sku,
            modelNumber:
              body.modelNumber === undefined
                ? null
                : parseText(body.modelNumber, "Model number", 150),
            price: new Prisma.Decimal(effectivePrice),
            compareAtPrice: effectiveCompareAt
              ? new Prisma.Decimal(effectiveCompareAt)
              : null,
            options: body.options === undefined
              ? {}
              : parseJsonObject(body.options, "Variant options"),
            specifications: body.specifications === undefined
              ? (existing.specifications as Prisma.InputJsonValue) ?? {}
              : parseJsonObject(body.specifications, "Specifications"),
            isActive:
              body.isActive === undefined
                ? existing.isActive
                : parseBoolean(body.isActive, existing.isActive),
          },
        });

        // Connect a newly created default variant to the existing product
        // inventory, if one exists and has not already been linked.
        const inventory = await tx.inventory.findUnique({
          where: { productId: id },
        });

        if (inventory && !inventory.variantId) {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { variantId: variant.id },
          });
        }
      }

      // Keep the legacy product inventory and its variant stock status intact.
      if (body.isActive !== undefined) {
        const active = parseBoolean(body.isActive, existing.isActive);

        await tx.productVariant.updateMany({
          where: { productId: id },
          data: { isActive: active },
        });
      }

      // Update stock on the product's single inventory record.
      if (stockQuantity !== undefined || reorderLevel !== undefined) {
        const inventory = await tx.inventory.findUnique({
          where: { productId: id },
        });

        if (inventory) {
          if (
            stockQuantity !== undefined &&
            stockQuantity < inventory.reservedQuantity
          ) {
            throw new Error(
              `Stock quantity cannot be lower than the ${inventory.reservedQuantity} unit(s) currently reserved.`,
            );
          }

          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              ...(stockQuantity !== undefined ? { quantity: stockQuantity } : {}),
              ...(reorderLevel !== undefined ? { reorderLevel } : {}),
            },
          });

          if (stockQuantity !== undefined && stockQuantity !== inventory.quantity) {
            await recordStockMovement(tx, id, stockQuantity - inventory.quantity, "ADJUSTMENT", {
              note: "Changed in the product form",
              actor: (req as AuthenticatedAdminRequest).admin?.email,
            });
          }
        } else {
          const firstVariant = await tx.productVariant.findFirst({
            where: { productId: id },
            orderBy: { createdAt: "asc" },
          });

          await tx.inventory.create({
            data: {
              productId: id,
              variantId: firstVariant?.id ?? null,
              quantity: stockQuantity ?? 0,
              reorderLevel: reorderLevel ?? 2,
            },
          });
        }
      }
    }, TRANSACTION_OPTIONS);

    const updated = await prisma.product.findUnique({
      where: { id },
      include: adminProductInclude,
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    handleRouteError(error, res, "Unable to update product.");
  }
});

// ---------- Admin: soft-delete product ----------

// DELETE /api/products/:id
productsRouter.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found.",
      });
      return;
    }

    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: { isActive: false },
      }),
      prisma.productVariant.updateMany({
        where: { productId: id },
        data: { isActive: false },
      }),
    ]);

    res.json({
      success: true,
      message: "Product deactivated successfully.",
    });
  } catch (error) {
    handleRouteError(error, res, "Unable to deactivate product.");
  }
});

function cryptoRandomSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export default productsRouter;
