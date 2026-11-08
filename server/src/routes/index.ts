
import { Router } from "express";

// Import the existing API route modules.
import authRoutes from "./auth.js";
import productRoutes from "./products.js";
import uploadRoutes from "./uploads.js";
import categoryRoutes from "./categories.js";
import orderRoutes from "./orders.js";
import paymentRoutes from "./payments.js";
import supplierRoutes from "./suppliers.js";
import inventoryRoutes from "./inventory.js";
import storeRoutes from "./store.js";
import customerRoutes from "./customers.js";
import returnRoutes from "./returns.js";
import reviewRoutes from "./reviews.js";

// Create the central API router.
const router = Router();

// Admin login and session verification.
router.use("/auth", authRoutes);

// Product listing and management.
router.use("/products", productRoutes);

// Category listing and management.
router.use("/categories", categoryRoutes);

// Customer checkout and admin order management.
router.use("/orders", orderRoutes);

// Mobile money payments and the gateway webhook.
router.use("/payments", paymentRoutes);

// Suppliers, their prices and stock confirmations (admin).
router.use("/suppliers", supplierRoutes);

// Sellable stock, adjustments and history (admin).
router.use("/inventory", inventoryRoutes);

// Checkout config, delivery zones, vouchers, settings, audit log.
router.use("/store", storeRoutes);

// Customer accounts and the admin customer list.
router.use("/customers", customerRoutes);

// Return requests.
router.use("/returns", returnRoutes);

// Product reviews.
router.use("/reviews", reviewRoutes);

// Image upload endpoints.
router.use("/uploads", uploadRoutes);

// Export the router for app.ts.
export default router;
