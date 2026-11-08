import { apiRequest } from '../lib/api'
import type { ApiProduct, StoreProduct } from '../types/catalog'

interface ProductsResponse {
  success: boolean
  data: ApiProduct[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

// Specification keys that hold the brand, in the order we check them.
const BRAND_KEYS = ['brand', 'Brand']

// Convert an API product into the storefront shape.
// Pricing rule: the default (first active) variant's price is the price
// customers pay; Product.price is the fallback for products without variants.
export function toStoreProduct(item: ApiProduct): StoreProduct {
  const variant = item.variants?.find((entry) => entry.isActive) ?? item.variants?.[0]

  const specifications: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(item.specifications ?? {})) {
    if (
      (typeof value === 'string' && value.trim() !== '') ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      specifications[key] = value
    }
  }

  const brandKey = BRAND_KEYS.find((key) => typeof specifications[key] === 'string')
  const basePrice = Number(variant?.price ?? item.price)
  const sale = saleIsActive(item) && Number(item.salePrice) < basePrice
  const price = sale ? Number(item.salePrice) : basePrice
  // During a sale the regular price is shown crossed out.
  const compareAt = sale
    ? basePrice
    : variant
      ? variant.compareAtPrice
      : item.compareAtPrice
  const inventory = item.inventory ?? variant?.inventory ?? null

  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    sku: item.sku,
    model: variant?.modelNumber ?? item.sku,
    brand: brandKey ? String(specifications[brandKey]) : undefined,
    categoryId: item.categoryId,
    categorySlug: item.category?.slug ?? '',
    categoryName: item.category?.name ?? 'General',
    price,
    oldPrice:
      compareAt != null && Number(compareAt) > price ? Number(compareAt) : undefined,
    images: item.imageUrls ?? [],
    description: item.description ?? undefined,
    specifications,
    stock: inventory ? Math.max(0, inventory.quantity - inventory.reservedQuantity) : 0,
    featured: item.isFeatured,
    variantId: variant?.id,
    onSale: sale,
    saleEndsAt: sale && item.saleEndsAt ? item.saleEndsAt : undefined,
    rating: item.rating && item.rating.count > 0 ? item.rating : undefined,
  }
}

// Same rule as the server (server/src/lib/pricing.ts): a sale runs while
// now is between its start (if any) and end (if any).
export function saleIsActive(item: Pick<ApiProduct, 'salePrice' | 'saleStartsAt' | 'saleEndsAt'>, now = Date.now()) {
  if (item.salePrice === null || item.salePrice === undefined) return false
  if (item.saleStartsAt && Date.parse(item.saleStartsAt) > now) return false
  if (item.saleEndsAt && Date.parse(item.saleEndsAt) <= now) return false
  return true
}

// Load the active storefront catalogue, page by page (the API caps a page at 100).
export async function fetchProducts(): Promise<StoreProduct[]> {
  const all: ApiProduct[] = []
  let page = 1
  let totalPages = 1

  do {
    const result = await apiRequest<ProductsResponse>(
      `/api/products?limit=100&page=${page}`,
    )
    all.push(...result.data)
    totalPages = result.pagination?.totalPages ?? 1
    page++
  } while (page <= totalPages && page <= 20)

  return all.map(toStoreProduct)
}
