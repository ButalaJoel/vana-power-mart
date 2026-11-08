import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export interface CustomerRequest extends Request {
  customer?: { id: string; phone: string; firstName: string; lastName: string; email: string | null };
}

export function signCustomerToken(customerId: string) {
  return jwt.sign({ customerId, role: "CUSTOMER" }, process.env.JWT_SECRET!, {
    expiresIn: "30d",
  });
}

async function readCustomer(req: CustomerRequest) {
  const secret = process.env.JWT_SECRET;
  const header = req.headers.authorization;
  if (!secret || !header?.startsWith("Bearer ")) return null;

  try {
    const payload = jwt.verify(header.slice(7).trim(), secret);
    if (typeof payload === "string" || payload.role !== "CUSTOMER" || typeof payload.customerId !== "string") {
      return null;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
      select: { id: true, phone: true, firstName: true, lastName: true, email: true, passwordHash: true },
    });
    if (!customer?.passwordHash) return null;

    const { passwordHash: _hidden, ...safe } = customer;
    return safe;
  } catch {
    return null;
  }
}

// Attaches req.customer when a valid customer token is sent; never blocks.
export async function optionalCustomer(req: CustomerRequest, _res: Response, next: NextFunction) {
  req.customer = (await readCustomer(req)) ?? undefined;
  next();
}

export async function requireCustomer(req: CustomerRequest, res: Response, next: NextFunction) {
  const customer = await readCustomer(req);
  if (!customer) {
    res.status(401).json({ success: false, message: "Please log in to your account." });
    return;
  }
  req.customer = customer;
  next();
}
