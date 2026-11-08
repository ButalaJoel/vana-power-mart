// Organise the catalogue into the five planned storefront categories.
//
//   npm run organise-categories            -> dry run: prints what would change
//   npm run organise-categories -- --apply -> makes the changes
//
// What it does (safe to run more than once):
// 1. Creates any of the five planned categories that don't exist yet
//    (matched by slug), with suggested specification fields. Existing
//    categories are left exactly as they are.
// 2. Moves products from the legacy seed categories into their planned
//    category (e.g. refrigerators -> home-appliances). No product data,
//    prices, stock or orders are changed.
// 3. Deactivates legacy categories that end up empty. Nothing is deleted.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing from server/.env");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const apply = process.argv.includes("--apply");

const field = (label: string, required = false) => ({
  key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
  label,
  type: "text",
  required,
});

const PLANNED = [
  {
    slug: "home-appliances",
    name: "Home Appliances",
    fields: ["Brand", "Model", "Power consumption", "Capacity", "Colour", "Warranty", "Dimensions"],
  },
  {
    slug: "phones-electronics",
    name: "Phones & Electronics",
    fields: ["Brand", "Model", "Storage", "RAM", "Colour", "Battery capacity", "Warranty"],
  },
  {
    slug: "furniture-home",
    name: "Furniture & Home",
    fields: ["Material", "Dimensions", "Colour", "Weight", "Assembly required"],
  },
  { slug: "beddings", name: "Beddings", fields: ["Material", "Size", "Colour", "Fabric type"] },
  { slug: "bags-accessories", name: "Bags & Accessories", fields: ["Material", "Size", "Colour", "Type"] },
];

// Legacy seed category slug -> planned category slug.
const MOVES: Record<string, string> = {
  refrigerators: "home-appliances",
  freezers: "home-appliances",
  "washing-machines": "home-appliances",
  "water-heaters": "home-appliances",
  "kitchen-appliances": "home-appliances",
  furniture: "furniture-home",
};

async function main() {
  console.log(apply ? "APPLYING changes\n" : "DRY RUN (add -- --apply to make changes)\n");

  const ids: Record<string, string> = {};

  for (const planned of PLANNED) {
    const existing = await prisma.category.findUnique({ where: { slug: planned.slug } });

    if (existing) {
      ids[planned.slug] = existing.id;
      console.log(`= Category exists: ${existing.name} (/${planned.slug})`);
      continue;
    }

    console.log(`+ Create category: ${planned.name} (/${planned.slug})`);
    if (apply) {
      const created = await prisma.category.create({
        data: {
          name: planned.name,
          slug: planned.slug,
          specificationFields: planned.fields.map((label, index) =>
            field(label, index === 0 && label === "Brand"),
          ),
        },
      });
      ids[planned.slug] = created.id;
    }
  }

  for (const [legacySlug, targetSlug] of Object.entries(MOVES)) {
    const legacy = await prisma.category.findUnique({
      where: { slug: legacySlug },
      include: { products: { select: { id: true, name: true } } },
    });
    if (!legacy) continue;

    if (legacy.products.length > 0) {
      console.log(
        `> Move ${legacy.products.length} product(s) from ${legacy.name} to /${targetSlug}: ` +
          legacy.products.map((product) => product.name).join(", "),
      );
      if (apply) {
        await prisma.product.updateMany({
          where: { categoryId: legacy.id },
          data: { categoryId: ids[targetSlug] },
        });
      }
    }

    if (legacy.isActive) {
      console.log(`- Deactivate empty legacy category: ${legacy.name}`);
      if (apply) {
        await prisma.category.update({ where: { id: legacy.id }, data: { isActive: false } });
      }
    }
  }

  console.log(apply ? "\nDone." : "\nNo changes made.");
}

main()
  .catch((error) => {
    console.error("Organising categories failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
