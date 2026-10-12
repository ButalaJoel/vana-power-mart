
// Import Express tools for creating a separate router.
import { Router } from "express";

// Import the shared Prisma Client.
import { prisma } from "../lib/prisma.js";

// Create a router for product-related endpoints.
const productsRouter = Router();

// GET /api/products
// Return active products from the PostgreSQL database.
productsRouter.get("/", async (_req, res) => {
  try {
    // Fetch products and their categories from the database.
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        category: true,
        inventory: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Return the products as JSON.
    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    // Log technical details on the server, not in the API response.
    console.error("Failed to fetch products:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve products.",
    });
  }
});

// Export the router so the main app can use it.
export default productsRouter;
