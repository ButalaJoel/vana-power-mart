import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { StoreProduct } from '../types/catalog'
import { fetchProducts } from '../services/productService'

interface ProductContextValue {
  products: StoreProduct[]
  loading: boolean
  error: string | null
  refreshProducts: () => Promise<void>
  // Find a product by database id or slug.
  findProduct: (idOrSlug: string | undefined) => StoreProduct | undefined
}

const ProductContext = createContext<ProductContextValue | undefined>(undefined)

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshProducts = useCallback(async () => {
    try {
      setError(null)
      setProducts(await fetchProducts())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load products.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshProducts()
  }, [refreshProducts])

  // If loading failed (server restarting, weak mobile data), try again every
  // 5 seconds and when the customer comes back to the tab.
  useEffect(() => {
    if (!error) return
    const timer = window.setInterval(() => void refreshProducts(), 5000)
    const onFocus = () => void refreshProducts()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
    }
  }, [error, refreshProducts])

  const findProduct = useCallback(
    (idOrSlug: string | undefined) =>
      idOrSlug
        ? products.find((item) => item.id === idOrSlug || item.slug === idOrSlug)
        : undefined,
    [products],
  )

  return (
    <ProductContext.Provider
      value={{ products, loading, error, refreshProducts, findProduct }}
    >
      {children}
    </ProductContext.Provider>
  )
}

export function useProducts() {
  const context = useContext(ProductContext)

  if (!context) {
    throw new Error('useProducts must be used inside ProductProvider.')
  }

  return context
}
