import { Prisma } from "../generated/prisma/client.js";

type Tx = Prisma.TransactionClient;

export type StockReason =
  | "OPENING"
  | "ADJUSTMENT"
  | "ORDER"
  | "CANCELLATION"
  | "SUPPLIER_CONFIRMATION"
  | "RETURN"
  | "PAYMENT_RELEASE";

// Record one stock change. Call it inside the same transaction that changed
// Inventory.quantity, after the change, so quantityAfter is accurate.
export async function recordStockMovement(
  tx: Tx,
  productId: string,
  change: number,
  reason: StockReason,
  options: { note?: string | null; orderId?: string | null; actor?: string | null } = {},
) {
  if (change === 0 && reason !== "SUPPLIER_CONFIRMATION") return;

  const inventory = await tx.inventory.findUnique({ where: { productId } });

  await tx.stockMovement.create({
    data: {
      productId,
      change,
      quantityAfter: inventory?.quantity ?? 0,
      reason,
      note: options.note ?? null,
      orderId: options.orderId ?? null,
      actor: options.actor ?? null,
    },
  });
}

// Set or change a product's sellable stock and record why.
export async function adjustStock(
  tx: Tx,
  productId: string,
  { set, add }: { set?: number; add?: number },
  reason: StockReason,
  options: { note?: string | null; actor?: string | null } = {},
) {
  let inventory = await tx.inventory.findUnique({ where: { productId } });

  if (!inventory) {
    const variant = await tx.productVariant.findFirst({
      where: { productId },
      orderBy: { createdAt: "asc" },
    });
    inventory = await tx.inventory.create({
      data: { productId, variantId: variant?.id ?? null, quantity: 0 },
    });
  }

  const target = set !== undefined ? set : inventory.quantity + (add ?? 0);

  if (!Number.isInteger(target) || target < 0) {
    throw new Error("Stock cannot go below 0.");
  }

  if (target < inventory.reservedQuantity) {
    throw new Error(
      `Stock cannot be lower than the ${inventory.reservedQuantity} unit(s) currently reserved.`,
    );
  }

  const change = target - inventory.quantity;

  await tx.inventory.update({
    where: { id: inventory.id },
    data: { quantity: target },
  });

  await recordStockMovement(tx, productId, change, reason, options);

  return { quantity: target, change };
}
