
import express from 'express'
import cors from 'cors'
// Import the shared Prisma Client instance.
import { prisma } from "./lib/prisma.js";
// Import the products API router.
import productsRouter from "./routes/products.js";

// Create the Express application used by our API.
const app = express()

// Allow requests from our local Vite frontend during development.
app.use(
  cors({
    origin: 'http://localhost:5173',
  }),
)

// Automatically parse incoming JSON request bodies.
app.use(express.json())

// Register product endpoints under /api/products.
app.use("/api/products", productsRouter);

// Provide an endpoint to confirm that the API is running.
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Vana Power Mart API is running.',
  })
})

// Check whether the cloud database is reachable.
app.get("/api/db-health", async (_req, res) => {
  try {
    // Execute a lightweight query against PostgreSQL.
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: "Database connection successful.",
    });
  } catch (error) {
    // Log the error on the server without exposing credentials to clients.
    console.error("Database health check failed:", error);

    res.status(503).json({
      success: false,
      message: "Database connection unavailable.",
    });
  }
});
// Export the configured application for the server entry point.
export default app
