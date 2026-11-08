import { trackAddToCart } from '../lib/analytics'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { StoreProduct } from '../types/catalog'
import { useProducts } from './ProductContext'

// The cart stores only product references and quantities. Names and prices
// always come from the live catalogue, and the server re-prices at checkout.
interface CartLine {
  // Product database id. Older saved carts may hold a slug, which also resolves.
  productId: string
  quantity: number
}

export interface CartItem extends CartLine {
  product: StoreProduct
  lineTotal: number
}

interface CartContextValue {
  items: CartItem[]
  itemCount: number
  subtotal: number
  // True until the catalogue has loaded, so saved carts aren't shown as empty.
  loading: boolean
  addItem: (productId: string, quantity?: number) => void
  updateQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

const STORAGE_KEY = 'vana-power-mart-cart'
const MAX_QUANTITY = 100

function readSavedCart(): CartLine[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return []

    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (item): item is CartLine =>
        typeof item?.productId === 'string' &&
        Number.isInteger(item?.quantity) &&
        item.quantity > 0,
    )
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { products, loading, error, findProduct } = useProducts()
  const [cart, setCart] = useState<CartLine[]>(readSavedCart)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
    } catch {
      // Storage unavailable: the cart lives in memory for this visit.
    }
  }, [cart])

  // Once the catalogue loads, normalise saved lines to product ids and drop
  // products that no longer exist or were deactivated.
  useEffect(() => {
    if (loading || error) return

    setCart((current) => {
      const next: CartLine[] = []

      for (const line of current) {
        const product = findProduct(line.productId)
        if (!product) continue

        const existing = next.find((item) => item.productId === product.id)
        if (existing) {
          existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + line.quantity)
        } else {
          next.push({ productId: product.id, quantity: line.quantity })
        }
      }

      const unchanged =
        next.length === current.length &&
        next.every(
          (line, index) =>
            line.productId === current[index].productId &&
            line.quantity === current[index].quantity,
        )

      return unchanged ? current : next
    })
  }, [products, loading, error, findProduct])

  const addItem = (productId: string, quantity = 1) => {
    const product = findProduct(productId)

    if (!product || !Number.isInteger(quantity) || quantity < 1) return
    trackAddToCart({ item_id: product.slug, item_name: product.name, price: product.price, quantity })

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id)

      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: Math.min(MAX_QUANTITY, item.quantity + quantity) }
            : item,
        )
      }

      return [...current, { productId: product.id, quantity: Math.min(MAX_QUANTITY, quantity) }]
    })
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (!Number.isInteger(quantity)) return

    if (quantity < 1) {
      removeItem(productId)
      return
    }

    setCart((current) =>
      current.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.min(MAX_QUANTITY, quantity) }
          : item,
      ),
    )
  }

  const removeItem = (productId: string) => {
    setCart((current) => current.filter((item) => item.productId !== productId))
  }

  const clearCart = () => setCart([])

  const items: CartItem[] = cart.flatMap((line) => {
    const product = findProduct(line.productId)
    if (!product) return []

    return [{ ...line, product, lineTotal: product.price * line.quantity }]
  })

  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        loading,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error('useCart must be used inside CartProvider')
  }

  return context
}
