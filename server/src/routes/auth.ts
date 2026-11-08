
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Use the existing Prisma client to communicate with PostgreSQL.
import { prisma } from "../lib/prisma.js";
import { limitAdminLogin } from "../middleware/rateLimits.js";

// Import our authentication middleware and its request type.
// The middleware protects endpoints that require an admin login.
import {
  requireAdmin,
  type AuthenticatedAdminRequest,
} from "../middleware/requireAdmin.js";

const router = Router();

/**
 * POST /api/auth/login
 *
 * Authenticates an administrator using their email and password.
 * If the credentials are valid, it returns a JWT for future requests.
 */
router.post("/login", limitAdminLogin, async (req, res) => {
  try {
    // Accept only string values from the request body.
    // Normalize the email so capitalization does not affect login.
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const password =
      typeof req.body?.password === "string"
        ? req.body.password
        : "";

    // Reject requests with missing credentials.
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
      return;
    }

    // Read the JWT secret from the server's .env configuration.
    // The secret is used to sign and later verify login tokens.
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      res.status(500).json({
        success: false,
        message: "Authentication is not configured.",
      });
      return;
    }

    // Find the administrator by their unique email address.
    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    // If the account exists and is active, compare the submitted
    // password with the securely hashed password stored in the DB.
    // Use the same generic error for invalid credentials to avoid
    // revealing whether a particular email has an account.
    if (
      !admin ||
      !admin.isActive ||
      !(await bcrypt.compare(password, admin.passwordHash))
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    // Create a signed JWT containing the administrator's identity.
    // The token expires after eight hours.
    const token = jwt.sign(
      {
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
      },
      secret,
      { expiresIn: "8h" },
    );

    // Record when the administrator last logged in.
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Return the token and safe account details.
    // Never send passwordHash to the frontend.
    res.json({
      success: true,
      message: "Login successful.",
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    // Log the technical error on the server for debugging.
    console.error("Admin login failed:", error);

    // Return a generic message to the client.
    res.status(500).json({
      success: false,
      message: "Unable to log in right now.",
    });
  }
});

/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated administrator's details.
 * requireAdmin verifies the JWT and checks that the account is active.
 */
router.get(
  "/me",
  requireAdmin,
  async (req: AuthenticatedAdminRequest, res) => {
    try {
      // Look up the authenticated admin using the ID attached
      // to the request by requireAdmin.
      const admin = await prisma.admin.findUnique({
        where: { id: req.admin!.adminId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          lastLoginAt: true,
        },
      });

      // Handle the unlikely case where the account no longer exists.
      if (!admin) {
        res.status(404).json({
          success: false,
          message: "Administrator not found.",
        });
        return;
      }

      // Return the current administrator's profile.
      res.json({
        success: true,
        admin,
      });
    } catch (error) {
      console.error("Admin session check failed:", error);

      res.status(500).json({
        success: false,
        message: "Unable to verify the session.",
      });
    }
  },
);

export default router;
