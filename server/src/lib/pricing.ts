import { Prisma } from "../generated/prisma/client.js";

type Decimal = Prisma.Decimal;

// The one pricing rule used by checkout (and mirrored by the storefront):
// the selected/default variant's price, or Product.price without variants,
// replaced by the flash-sale price while the sale is running.
export function isSaleActive(
  product: { salePrice: Decimal | null; saleStartsAt: Date | null; saleEndsAt: Date | null },
  now = new Date(),
) {
  if (product.salePrice === null) return false;
  if (product.saleStartsAt && product.saleStartsAt > now) return false;
  if (product.saleEndsAt && product.saleEndsAt <= now) return false;
  return true;
}

export function effectiveUnitPrice(
  product: { price: Decimal; salePrice: Decimal | null; saleStartsAt: Date | null; saleEndsAt: Date | null },
  variant: { price: Decimal } | null,
  now = new Date(),
): Decimal {
  const base = variant ? variant.price : product.price;
  if (isSaleActive(product, now) && product.salePrice!.lessThan(base)) {
    return product.salePrice!;
  }
  return base;
}

export interface VoucherLike {
  code: string;
  type: string;
  value: Decimal;
  minOrderAmount: Decimal | null;
  maxDiscount: Decimal | null;
  usageLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

// Returns the discount for a subtotal, or an error message explaining why
// the voucher can't be used.
export function voucherDiscount(
  voucher: VoucherLike,
  subtotal: Decimal,
  now = new Date(),
): { discount: Decimal } | { error: string } {
  if (!voucher.isActive) return { error: "This voucher code is not active." };
  if (voucher.startsAt && voucher.startsAt > now) return { error: "This voucher is not valid yet." };
  if (voucher.endsAt && voucher.endsAt <= now) return { error: "This voucher has expired." };
  if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
    return { error: "This voucher has been fully used." };
  }
  if (voucher.minOrderAmount && subtotal.lessThan(voucher.minOrderAmount)) {
    return {
      error: `This voucher needs an order of at least UGX ${Number(voucher.minOrderAmount).toLocaleString("en-UG")}.`,
    };
  }

  let discount =
    voucher.type === "PERCENT"
      ? subtotal.mul(voucher.value).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN)
      : voucher.value;

  if (voucher.maxDiscount && discount.greaterThan(voucher.maxDiscount)) discount = voucher.maxDiscount;
  if (discount.greaterThan(subtotal)) discount = subtotal;

  return { discount };
}
