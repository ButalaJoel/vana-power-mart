
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Import the shared Prisma client so we can verify that the
// administrator still exists and their account is active.
import { prisma } from "../lib/prisma.js";

// Define the information we expect to receive inside the JWT.
export interface AdminTokenPayload {
  adminId: string;
  email: string;
  role: "ADMIN";
}

// Extend Express's Request type to hold the authenticated admin.
// Other routes can then access req.admin after this middleware runs.
export interface AuthenticatedAdminRequest extends Request {
  admin?: AdminTokenPayload;
}

// Middleware that protects routes from unauthenticated requests.
// Example: creating, editing or deleting products.
export async function requireAdmin(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction,
) {
  // Read the secret from .env when the middleware executes.
  // Never hardcode the JWT secret in this file.
  const secret = process.env.JWT_SECRET;

  // Stop if the server has not been configured with a secret.
  if (!secret) {
    res.status(500).json({
      success: false,
      message: "Authentication is not configured.",
    });
    return;
  }

  // The frontend must send the token in the Authorization header.
  // Expected format: Authorization: Bearer <token>
  const authorization = req.headers.authorization;

  // Reject requests that do not provide a Bearer token.
  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Please log in as an administrator.",
    });
    return;
  }

  // Remove "Bearer " so we are left with the actual JWT.
  const token = authorization.slice(7).trim();

  try {
    // Verify the token's signature and expiration using our secret.
    // jwt.verify throws an error if the token is invalid or expired.
    const payload = jwt.verify(token, secret);

    // Confirm that the token contains the required fields
    // and that its role is allowed to access admin routes.
    if (
      typeof payload === "string" ||
      typeof payload.adminId !== "string" ||
      typeof payload.email !== "string" ||
      payload.role !== "ADMIN"
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid administrator token.",
      });
      return;
    }

    // Look up the administrator in the database.
    // This prevents deleted or deactivated accounts from continuing
    // to access protected routes with an old token.
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    // Reject access if the account is missing, inactive,
    // or its current details do not match the token.
    if (
      !admin ||
      !admin.isActive ||
      admin.email !== payload.email ||
      admin.role !== "ADMIN"
    ) {
      res.status(403).json({
        success: false,
        message: "Administrator access has been revoked.",
      });
      return;
    }

    // Attach verified administrator details to the request.
    // Protected routes can now identify the logged-in administrator.
    req.admin = {
      adminId: admin.id,
      email: admin.email,
      role: "ADMIN",
    };

    // Continue to the actual route handler because authentication passed.
    next();
  } catch {
    // Return 401 if token verification fails or a database lookup
    // throws an error. The server logs can be used to investigate
    // unexpected database errors separately if needed.
    res.status(401).json({
      success: false,
      message: "Your session is invalid or has expired. Please log in again.",
    });
  }
}
