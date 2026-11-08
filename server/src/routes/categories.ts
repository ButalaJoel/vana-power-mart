import { Router, type Response } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  ValidationError,
  createSlug,
  readBoolean,
  readText,
} from "../lib/validation.js";

const categoriesRouter = Router();

// ---------- Specification field definitions ----------

// Field types the admin can use for a category's product specifications.
export const SPEC_FIELD_TYPES = [
  "text",
  "number",
  "select",
  "boolean",
  "textarea",
] as const;

export type SpecFieldType = (typeof SPEC_FIELD_TYPES)[number];

export interface SpecificationField {
  key: string;
  label: string;
  type: SpecFieldType;
  required: boolean;
  options?: string[];
  unit?: string;
}

const MAX_SPEC_FIELDS = 40;

// Validate and normalise Category.specificationFields sent by the admin.
function parseSpecificationFields(value: unknown): SpecificationField[] {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw new ValidationError("Specification fields must be a list.");
  }

  if (value.length > MAX_SPEC_FIELDS) {
    throw new ValidationError(
      `A category can have at most ${MAX_SPEC_FIELDS} specification fields.`,
    );
  }

  const seenKeys = new Set<string>();

  return value.map((raw, index) => {
    const position = `Specification field ${index + 1}`;

    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ValidationError(`${position} is invalid.`);
    }

    const field = raw as Record<string, unknown>;
    const label = readText(field.label, `${position} label`, {
      required: true,
      max: 80,
    })!;

    // The key is what gets stored in Product.specifications.
    // Generate it from the label when the admin leaves it blank.
    const keySource =
      readText(field.key, `${position} key`, { max: 80 }) ?? label;
    const key = createSlug(keySource).replace(/-/g, "_");

    if (!key) {
      throw new ValidationError(`${position} needs a valid label.`);
    }

    if (seenKeys.has(key)) {
      throw new ValidationError(
        `Two specification fields use the same key "${key}". Rename one of them.`,
      );
    }
    seenKeys.add(key);

    const type = (field.type ?? "text") as SpecFieldType;
    if (!SPEC_FIELD_TYPES.includes(type)) {
      throw new ValidationError(`${position} has an unsupported type.`);
    }

    const required =
      field.required === undefined
        ? false
        : readBoolean(field.required, `${position} required`);

    const result: SpecificationField = { key, label, type, required };

    if (type === "select") {
      const options = Array.isArray(field.options)
        ? field.options
            .map((option) =>
              typeof option === "string" ? option.trim() : "",
            )
            .filter(Boolean)
        : [];

      const unique = [...new Set(options)];

      if (unique.length === 0) {
        throw new ValidationError(
          `${position} ("${label}") is a dropdown and needs at least one option.`,
        );
      }

      result.options = unique.slice(0, 50);
    }

    const unit = readText(field.unit, `${position} unit`, { max: 20 });
    if (unit && (type === "number" || type === "text")) result.unit = unit;

    return result;
  });
}

// Category images may be uploaded (HTTPS URL) or bundled in /public ("/categories/x.jpg").
function parseImageUrl(value: unknown): string | null {
  const text = readText(value, "Category image", { max: 2000 });
  if (!text) return null;

  if (text.startsWith("/") && !text.startsWith("//")) return text;

  try {
    if (new URL(text).protocol === "https:") return text;
  } catch {
    // Fall through to the error below.
  }

  throw new ValidationError(
    "Category image must be an HTTPS URL or a path starting with /.",
  );
}

// One level of subcategories: the parent must be a top-level category, and a
// category that has subcategories cannot itself become a subcategory.
async function parseParent(value: unknown, selfId?: string): Promise<string | null> {
  if (value === undefined || value === null || value === "") return null;
  const parentId = String(value);
  if (parentId === selfId) throw new ValidationError("A category can't be its own parent.");

  const parent = await prisma.category.findUnique({ where: { id: parentId } });
  if (!parent) throw new ValidationError("The parent category was not found.");
  if (parent.parentId) throw new ValidationError("Subcategories can only be one level deep. Choose a top-level category.");

  if (selfId) {
    const children = await prisma.category.count({ where: { parentId: selfId } });
    if (children > 0) throw new ValidationError("This category has subcategories, so it can't become a subcategory itself.");
  }
  return parentId;
}

function parseSlug(value: unknown, fallbackName: string): string {
  const raw = readText(value, "Slug", { max: 120 });
  const slug = createSlug(raw ?? fallbackName);

  if (!slug) {
    throw new ValidationError("Enter a valid category name or slug.");
  }

  return slug;
}

// ---------- Response helpers ----------

// Add product counts to each category. activeProducts is what customers can see.
async function withProductCounts<T extends { id: string }>(categories: T[]) {
  if (categories.length === 0) return [];

  const ids = categories.map((category) => category.id);

  const [allCounts, activeCounts] = await Promise.all([
    prisma.product.groupBy({
      by: ["categoryId"],
      where: { categoryId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ["categoryId"],
      where: { categoryId: { in: ids }, isActive: true },
      _count: { _all: true },
    }),
  ]);

  const total = new Map(allCounts.map((row) => [row.categoryId, row._count._all]));
  const active = new Map(
    activeCounts.map((row) => [row.categoryId, row._count._all]),
  );

  return categories.map((category) => ({
    ...category,
    productCount: total.get(category.id) ?? 0,
    activeProductCount: active.get(category.id) ?? 0,
  }));
}

function handleError(error: unknown, res: Response, fallback: string) {
  if (error instanceof ValidationError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    res.status(409).json({
      success: false,
      message: "Another category already uses that slug. Choose a different one.",
    });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    res.status(404).json({ success: false, message: "Category not found." });
    return;
  }

  console.error(fallback, error);
  res.status(500).json({ success: false, message: fallback });
}

// ---------- Public ----------

// GET /api/categories — active categories for the storefront.
categoriesRouter.get("/", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    const data = (await withProductCounts(categories)).map(
      ({ productCount: _hidden, ...category }) => category,
    );

    res.json({ success: true, data });
  } catch (error) {
    handleError(error, res, "Unable to retrieve categories.");
  }
});

// ---------- Admin ----------
// Registered before "/:identifier" so "admin" is not treated as a slug.

// GET /api/categories/admin/all — every category, including inactive ones.
categoriesRouter.get("/admin/all", requireAdmin, async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });

    res.json({ success: true, data: await withProductCounts(categories) });
  } catch (error) {
    handleError(error, res, "Unable to retrieve categories.");
  }
});

// GET /api/categories/:identifier — one active category by id or slug.
categoriesRouter.get("/:identifier", async (req, res) => {
  try {
    const identifier = String(req.params.identifier);

    const category = await prisma.category.findFirst({
      where: {
        isActive: true,
        OR: [{ id: identifier }, { slug: identifier }],
      },
    });

    if (!category) {
      res.status(404).json({ success: false, message: "Category not found." });
      return;
    }

    const [data] = await withProductCounts([category]);
    const { productCount: _hidden, ...publicData } = data;

    res.json({ success: true, data: publicData });
  } catch (error) {
    handleError(error, res, "Unable to retrieve the category.");
  }
});

// POST /api/categories
categoriesRouter.post("/", requireAdmin, async (req, res) => {
  try {
    const body = req.body ?? {};

    const name = readText(body.name, "Category name", {
      required: true,
      max: 120,
    })!;

    const category = await prisma.category.create({
      data: {
        name,
        slug: parseSlug(body.slug, name),
        description: readText(body.description, "Description", { max: 2000 }),
        imageUrl: parseImageUrl(body.imageUrl),
        isActive:
          body.isActive === undefined
            ? true
            : readBoolean(body.isActive, "Active status"),
        specificationFields: parseSpecificationFields(
          body.specificationFields,
        ) as unknown as Prisma.InputJsonValue,
        parentId: await parseParent(body.parentId),
      },
    });

    const [data] = await withProductCounts([category]);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(error, res, "Unable to create the category.");
  }
});

// PUT /api/categories/:id — partial updates are allowed.
categoriesRouter.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const body = req.body ?? {};

    const existing = await prisma.category.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, message: "Category not found." });
      return;
    }

    const data: Prisma.CategoryUpdateInput = {};

    if (body.name !== undefined) {
      data.name = readText(body.name, "Category name", {
        required: true,
        max: 120,
      })!;
    }

    // Slugs only change when explicitly sent, so existing links keep working.
    if (body.slug !== undefined) {
      data.slug = parseSlug(body.slug, (data.name as string) ?? existing.name);
    }

    if (body.description !== undefined) {
      data.description = readText(body.description, "Description", {
        max: 2000,
      });
    }

    if (body.imageUrl !== undefined) {
      data.imageUrl = parseImageUrl(body.imageUrl);
    }

    if (body.isActive !== undefined) {
      data.isActive = readBoolean(body.isActive, "Active status");
    }

    if (body.parentId !== undefined) {
      const parentId = await parseParent(body.parentId, id);
      data.parent = parentId ? { connect: { id: parentId } } : { disconnect: true };
    }

    if (body.specificationFields !== undefined) {
      data.specificationFields = parseSpecificationFields(
        body.specificationFields,
      ) as unknown as Prisma.InputJsonValue;
    }

    const category = await prisma.category.update({ where: { id }, data });
    const [result] = await withProductCounts([category]);

    res.json({ success: true, data: result });
  } catch (error) {
    handleError(error, res, "Unable to update the category.");
  }
});

// DELETE /api/categories/:id
// Only empty categories can be deleted. Categories with products must be
// deactivated instead, so no product is left without a category.
categoriesRouter.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);

    const [productCount, childCount] = await Promise.all([
      prisma.product.count({ where: { categoryId: id } }),
      prisma.category.count({ where: { parentId: id } }),
    ]);

    if (childCount > 0) {
      res.status(409).json({
        success: false,
        message: `This category has ${childCount} subcategor${childCount === 1 ? "y" : "ies"}. Move or delete them first.`,
      });
      return;
    }

    if (productCount > 0) {
      res.status(409).json({
        success: false,
        message: `This category has ${productCount} product(s). Move them to another category or deactivate the category instead.`,
      });
      return;
    }

    await prisma.category.delete({ where: { id } });

    res.json({ success: true, message: "Category deleted." });
  } catch (error) {
    handleError(error, res, "Unable to delete the category.");
  }
});

export default categoriesRouter;
