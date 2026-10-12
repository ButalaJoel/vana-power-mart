
 // Load environment variables from server/.env.
import "dotenv/config";

// Import the shared Prisma Client.
import { prisma } from "./lib/prisma.js";

// Import Node.js file utilities.
import { readFile } from "node:fs/promises";

// Describe the structure of products exported from the frontend.
interface CatalogueProduct {
  id: string;
  name: string;
  brand?: string;
  category: string;
  model?: string;
  price?: number;
  oldPrice?: number;
  images: string[];
  shortDescription?: string;
  description?: string;
  specifications?: Record<string, string | number | boolean>;
  stock?: number;
  featured?: boolean;
}

// Convert category slugs into readable category names.
function formatCategoryName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Import the catalogue into PostgreSQL.
async function main() {
  // Load the exported JSON catalogue from server/prisma/products.json.
  const productsPath = new URL("../prisma/products.json", import.meta.url);

  const products = JSON.parse(
    await readFile(productsPath, "utf8"),
  ) as CatalogueProduct[];

  // Track the import results.
  let imported = 0;
  let skipped = 0;

  // Process each product in the catalogue.
  for (const product of products) {
    // Skip products without a valid selling price.
    if (
      product.price === undefined ||
      !Number.isFinite(product.price) ||
      product.price <= 0
    ) {
      console.warn(
        `Skipped "${product.name}" (${product.id}): selling price is missing or invalid.`,
      );

      skipped++;
      continue;
    }

    // Create the category if it does not already exist.
    const category = await prisma.category.upsert({
      where: {
        slug: product.category,
      },
      update: {},
      create: {
        name: formatCategoryName(product.category),
        slug: product.category,
      },
    });

    // Use the model as the SKU when available.
    // Otherwise, use the existing product ID.
    const sku = (product.model ?? product.id).toUpperCase();

    // Prepare the fields shared by new and existing products.
    const productData = {
      name: product.name,
      sku,
      description:
        product.description ?? product.shortDescription ?? null,
      price: product.price,
      compareAtPrice: product.oldPrice ?? null,
      imageUrls: product.images,
      specifications: product.specifications ?? undefined,
      isActive: true,
      isFeatured: product.featured ?? false,
      categoryId: category.id,
    };

    // Create the product or update its catalogue information.
    const savedProduct = await prisma.product.upsert({
      where: {
        slug: product.id,
      },
      update: productData,
      create: {
        slug: product.id,
        ...productData,
      },
    });

    // Create inventory only if a record does not already exist.
    // Existing quantities are preserved on subsequent seed runs.
    await prisma.inventory.upsert({
      where: {
        productId: savedProduct.id,
      },
      update: {},
      create: {
        productId: savedProduct.id,
        quantity: product.stock ?? 0,
        reorderLevel: 2,
      },
    });

    imported++;

    console.log(`Imported: ${product.name}`);
  }

  // Print the final import summary.
  console.log("\nCatalogue import complete!");
  console.log(`Successfully processed: ${imported}`);
  console.log(`Skipped due to missing or invalid price: ${skipped}`);
  console.log(`Products in source catalogue: ${products.length}`);
}

// Run the import and close the database connection afterwards.
main()
  .catch((error) => {
    console.error("Catalogue import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
