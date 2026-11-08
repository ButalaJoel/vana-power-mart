
import express from "express";
import cors from "cors";
import helmet from "helmet";

// Import the shared Prisma Client instance for database health checks.
import { prisma } from "./lib/prisma.js";

// Import the central API router.
// This router registers authentication, products and uploads.
import apiRoutes from "./routes/index.js";

// Create the Express application used by our API.
const app = express();

// Behind a hosting proxy, use the real client IP for rate limiting.
app.set("trust proxy", 1);

// Standard security headers. Images and API responses may be used by the
// storefront on another origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Allowed frontend origins. Set CORS_ORIGINS in .env as a comma-separated
// list for production, e.g. "https://vanapowermart.com,https://www.vanapowermart.com".
// Defaults to the local Vite dev and preview servers.
const allowedOrigins = (
  process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:4173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Outside production, any localhost port is allowed too, because Vite moves
// to 5174, 5175... when 5173 is already taken.
// Entries may use * as a wildcard, e.g. https://vana-power-mart*.vercel.app
// to also allow Vercel preview links.
function originMatches(pattern: string, origin: string) {
  if (!pattern.includes("*")) return pattern === origin;
  const escaped = pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\/]/g, "\\$&"));
  return new RegExp(`^${escaped.join("[a-z0-9-]*")}$`).test(origin);
}

const isLocalhost = (origin: string) => /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed =
        !origin ||
        allowedOrigins.some((allowedOrigin) => originMatches(allowedOrigin, origin)) ||
        (process.env.NODE_ENV !== "production" && isLocalhost(origin));
      callback(null, allowed);
    },
    // Lets the admin page read PDF file names.
    exposedHeaders: ["Content-Disposition"],
  }),
);

// The payment webhook needs the exact raw body to verify its signature.
app.use("/api/payments/webhook", express.raw({ type: "*/*", limit: "256kb" }));

// Automatically parse incoming JSON request bodies (size-limited).
app.use(express.json({ limit: "1mb" }));

// Register all API route modules under the /api prefix.
//
// The central router handles:
// /api/auth/...
// /api/products/...
// /api/uploads/...
app.use("/api", apiRoutes);

// Provide an endpoint to confirm that the API is running.
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Vana Power Mart API is running.",
  });
});

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
    // Log technical details on the server without exposing credentials.
    console.error("Database health check failed:", error);

    res.status(503).json({
      success: false,
      message: "Database connection unavailable.",
    });
  }
});

// Unknown API routes return JSON instead of Express's HTML page.
app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "API route not found." });
});

// Final error handler: invalid JSON bodies, rejected uploads (wrong type,
// too large) and anything unexpected all return a JSON message.
app.use(
  (
    error: Error & { status?: number; type?: string; code?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error.type === "entity.parse.failed") {
      res.status(400).json({ success: false, message: "Invalid JSON body." });
      return;
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ success: false, message: "Each image must be 15 MB or smaller." });
      return;
    }

    if (error.code?.startsWith("LIMIT_") || error.message === "Upload an image file.") {
      res.status(400).json({
        success: false,
        message:
          error.message === "Upload an image file."
            ? "Only image files can be uploaded."
            : "Upload up to 8 images at a time.",
      });
      return;
    }

    console.error("Unhandled API error:", error);
    res.status(error.status ?? 500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  },
);

// Export the configured application for server.ts.
export default app;
