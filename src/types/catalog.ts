// Types shared by the storefront and the admin dashboard.

export type SpecFieldType = 'text' | 'number' | 'select' | 'boolean' | 'textarea'

// One entry of Category.specificationFields.
export interface SpecificationFieldDefinition {
  key: string
  label: string
  type: SpecFieldType
  required: boolean
  options?: string[]
  unit?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  isActive: boolean
  parentId: string | null
  specificationFields: SpecificationFieldDefinition[] | null
  activeProductCount: number
  // Only returned by the admin endpoint.
  productCount?: number
  createdAt: string
  updatedAt: string
}

export interface ApiInventory {
  id: string
  quantity: number
  reservedQuantity: number
  reorderLevel: number
}

export interface ApiVariant {
  id: string
  sku: string
  modelNumber: string | null
  price: string | number
  compareAtPrice: string | number | null
  options: Record<string, unknown> | null
  specifications: Record<string, unknown> | null
  isActive: boolean
  inventory?: ApiInventory | null
}

// A product exactly as the API returns it.
export interface ApiProduct {
  id: string
  name: string
  slug: string
  sku: string
  description: string | null
  price: string | number
  compareAtPrice: string | number | null
  imageUrls: string[]
  specifications: Record<string, unknown> | null
  isActive: boolean
  isFeatured: boolean
  salePrice: string | number | null
  saleStartsAt: string | null
  saleEndsAt: string | null
  rating?: { average: number; count: number } | null
  supplierProducts?: Array<{
    id: string
    supplierId: string
    wholesalePrice: string | number
    availableQuantity: number
    confirmedAt: string | null
    isPreferred: boolean
    leadTimeDays: number | null
    supplierSku: string | null
    supplier: { id: string; name: string; isActive: boolean }
  }>
  categoryId: string
  category: Pick<Category, 'id' | 'name' | 'slug' | 'isActive'> &
    Partial<Category>
  inventory: ApiInventory | null
  variants: ApiVariant[]
  createdAt: string
  updatedAt: string
}

// The storefront's view of a product.
export interface StoreProduct {
  id: string
  slug: string
  name: string
  sku: string
  model?: string
  brand?: string
  categoryId: string
  categorySlug: string
  categoryName: string
  // What the customer pays now: the flash-sale price while a sale runs,
  // otherwise the default variant's price (or the product's).
  price: number
  oldPrice?: number
  // Set while a flash sale is running.
  saleEndsAt?: string
  onSale: boolean
  rating?: { average: number; count: number }
  images: string[]
  description?: string
  specifications: Record<string, string | number | boolean>
  // Units available now. Products can still be ordered at 0 (Awaiting Stock).
  stock: number
  featured: boolean
  // The default variant that is ordered when the customer adds this product.
  variantId?: string
}
