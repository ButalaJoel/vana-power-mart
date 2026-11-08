import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";

// Record an admin action. Never throws: a failed audit write must not
// break the action itself, but it is logged on the server.
export async function audit(
  actor: string,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actor,
        action,
        entity,
        entityId: entityId ?? null,
        details: details ? (JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}
