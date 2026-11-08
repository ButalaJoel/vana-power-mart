
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from server/.env");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.product.findMany({
    include: { inventory: true, variants: true },
  });

  let created = 0;
  let linked = 0;

  for (const product of products) {
    await prisma.$transaction(async (tx) => {
      // Reuse an existing variant if this script has already processed the product.
      let variant = await tx.productVariant.findFirst({
        where: { productId: product.id },
        orderBy: { createdAt: "asc" },
      });

      if (!variant) {
        variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: product.sku,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            specifications: product.specifications ?? undefined,
            isActive: product.isActive,
          },
        });

        created++;
      }

      // Attach the existing inventory record without changing its stock.
      if (product.inventory && product.inventory.variantId !== variant.id) {
        await tx.inventory.update({
          where: { id: product.inventory.id },
          data: { variantId: variant.id },
        });

        linked++;
      }
    });
  }

  console.log(`Products checked: ${products.length}`);
  console.log(`Variants created: ${created}`);
  console.log(`Inventory records linked: ${linked}`);
}

main()
  .catch((error) => {
    console.error("Product variant backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
