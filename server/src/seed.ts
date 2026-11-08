
 // Load environment variables from server/.env.
import "dotenv/config";

// Import bcrypt so we can hash the admin password securely.
import bcrypt from "bcryptjs";

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

/**
 * Create the initial administrator from environment variables.
 *
 * Required variables in server/.env:
 * ADMIN_NAME
 * ADMIN_EMAIL
 * ADMIN_PASSWORD
 *
 * The password is hashed before it is saved to PostgreSQL.
 * If the admin already exists, this function leaves the account
 * and its password unchanged.
 */
async function seedAdmin() {
  // Read the administrator details from the environment.
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  // Stop if any required administrator details are missing.
  if (!name || !email || !password) {
    throw new Error(
      "Missing ADMIN_NAME, ADMIN_EMAIL or ADMIN_PASSWORD in server/.env.",
    );
  }

  // Require a reasonably strong initial password.
  // Use a unique password of at least 12 characters.
  if (password.length < 12) {
    throw new Error(
      "ADMIN_PASSWORD must contain at least 12 characters.",
    );
  }

  // Check whether an administrator with this email already exists.
  const existingAdmin = await prisma.admin.findUnique({
    where: { email },
  });

  // Do not overwrite an existing account or reset its password.
  if (existingAdmin) {
    console.log(`Admin account already exists: ${email}`);
    console.log("Existing admin details were left unchanged.");
    return;
  }

  // Hash the password with bcrypt before storing it.
  // Never store the plain-text password in the database.
  const passwordHash = await bcrypt.hash(password, 12);

  // Create the initial administrator account.
  await prisma.admin.create({
    data: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`Initial administrator created: ${email}`);
}

/**
 * Import the product catalogue into PostgreSQL.
 *
 * This preserves the existing catalogue import behaviour.
 */
async function importCatalogue() {
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

// Run the admin setup and catalogue import.
async function main() {
  // Create the initial admin if it does not already exist.
  await seedAdmin();

  // Import the product catalogue using the existing logic.
  await importCatalogue();
}

// Run the seed and always close the database connection afterwards.
main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
