
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { Product } from '../data/products'
import { fetchProducts } from '../services/productService'

interface ProductContextValue {
  products: Product[]
  loading: boolean
  error: string | null
  refreshProducts: () => Promise<void>
}

const ProductContext = createContext<ProductContextValue | undefined>(
  undefined,
)

export function ProductProvider({
  children,
}: {
  children: ReactNode
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refreshProducts() {
    try {
      setError(null)

      const data = await fetchProducts()
      setProducts(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load products.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshProducts()
  }, [])

  return (
    <ProductContext.Provider
      value={{ products, loading, error, refreshProducts }}
    >
      {children}
    </ProductContext.Provider>
  )
}

export function useProducts() {
  const context = useContext(ProductContext)

  if (!context) {
    throw new Error(
      'useProducts must be used inside ProductProvider.',
    )
  }

  return context
}
