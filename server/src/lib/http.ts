import type { Response } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { ValidationError } from "./validation.js";

// Shared JSON error responses for the newer routes.
export function sendError(res: Response, error: unknown, fallback: string, duplicateMessage?: string) {
  if (error instanceof ValidationError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ success: false, message: duplicateMessage ?? "That record already exists." });
      return;
    }
    if (error.code === "P2025") {
      res.status(404).json({ success: false, message: "Not found." });
      return;
    }
    if (error.code === "P2003") {
      res.status(409).json({ success: false, message: "This record is still in use and cannot be removed." });
      return;
    }
  }
  console.error(fallback, error);
  res.status(500).json({ success: false, message: fallback });
}

export function readMoneyValue(value: unknown, field: string, { required = false } = {}): Prisma.Decimal | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ValidationError(`${field} is required.`);
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000) {
    throw new ValidationError(`${field} must be a number of 0 or more.`);
  }
  return new Prisma.Decimal(Math.round(number));
}

export function readDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new ValidationError(`${field} is not a valid date.`);
  return date;
}

export function readOptionalInt(value: unknown, field: string, min = 0, max = 1_000_000): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ValidationError(`${field} must be a whole number between ${min} and ${max}.`);
  }
  return number;
}
