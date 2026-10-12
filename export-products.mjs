
 // Import the file-writing utility from Node.js.
import { writeFile } from "node:fs/promises";

// Import the existing frontend product catalogue.
import { products } from "./src/data/products.ts";

// Save the catalogue as JSON inside the backend's Prisma folder.
await writeFile(
  "./server/prisma/products.json",
  JSON.stringify(products, null, 2),
  "utf8",
);

// Confirm how many products were exported.
console.log(
  `Exported ${products.length} products to server/prisma/products.json`,
);
