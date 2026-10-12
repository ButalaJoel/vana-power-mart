
// Import the existing frontend product types.
import type {
  Product,
  ProductCategory,
} from "../data/products";

// Use the backend URL from the environment when configured.
// Fall back to the local Express API during development.
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

// Describe the product data returned by our Express API.
interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  price: string | number;
  compareAtPrice: string | number | null;
  imageUrls: string[];
  specifications: Record<string, unknown> | null;
  isFeatured: boolean;
  category: {
    name: string;
    slug: string;
  };
  inventory: {
    quantity: number;
    reservedQuantity: number;
  } | null;
}

// Describe the complete API response.
interface ProductsApiResponse {
  success: boolean;
  count: number;
  data: ApiProduct[];
}

// Convert a database product into the format used by our existing UI.
function mapApiProduct(item: ApiProduct): Product {
  const validCategories: ProductCategory[] = [
    "refrigerators",
    "freezers",
    "washing-machines",
    "water-heaters",
    "kitchen-appliances",
    "furniture",
  ];

  const category = validCategories.includes(
    item.category.slug as ProductCategory,
  )
    ? (item.category.slug as ProductCategory)
    : "furniture";

  // Keep only specification values supported by our frontend type.
  const specifications: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(item.specifications ?? {})) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      specifications[key] = value;
    }
  }

  return {
    // Use the existing slug so product links and cart IDs stay compatible.
    id: item.slug,
    name: item.name,
    category,
    model: item.sku,
    price: Number(item.price),
    oldPrice:
      item.compareAtPrice == null
        ? undefined
        : Number(item.compareAtPrice),
    images: item.imageUrls,
    description: item.description ?? undefined,
    shortDescription: item.description ?? undefined,
    specifications,
    stock: item.inventory?.quantity ?? 0,
    featured: item.isFeatured,
  };
}

// Fetch the products from our backend API.
export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(`${API_URL}/api/products`);

  if (!response.ok) {
    throw new Error(
      `Unable to fetch products. Server returned ${response.status}.`,
    );
  }

  const result: ProductsApiResponse = await response.json();

  if (!result.success || !Array.isArray(result.data)) {
    throw new Error("The products API returned an invalid response.");
  }

  return result.data.map(mapApiProduct);
}
