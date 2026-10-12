
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { products } from '../data/products'

interface CartLine {
  productId: string
  quantity: number
}

interface CartItem extends CartLine {
  product: (typeof products)[number]
  lineTotal: number
}

interface CartContextValue {
  items: CartItem[]
  itemCount: number
  subtotal: number
  addItem: (productId: string, quantity?: number) => void
  updateQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | undefined>(
  undefined,
)

const STORAGE_KEY = 'vana-power-mart-cart'

function readSavedCart(): CartLine[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (!saved) return []

    const parsed: unknown = JSON.parse(saved)

    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (item): item is CartLine =>
        typeof item?.productId === 'string' &&
        typeof item?.quantity === 'number' &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        products.some((product) => product.id === item.productId),
    )
  } catch {
    return []
  }
}

export function CartProvider({
  children,
}: {
  children: ReactNode
}) {
  const [cart, setCart] = useState<CartLine[]>(readSavedCart)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

  const addItem = (productId: string, quantity = 1) => {
    const productExists = products.some(
      (product) => product.id === productId,
    )

    if (
      !productExists ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return
    }

    setCart((current) => {
      const existing = current.find(
        (item) => item.productId === productId,
      )

      if (existing) {
        return current.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        )
      }

      return [...current, { productId, quantity }]
    })
  }

  const updateQuantity = (
    productId: string,
    quantity: number,
  ) => {
    if (!Number.isInteger(quantity)) return

    if (quantity < 1) {
      setCart((current) =>
        current.filter((item) => item.productId !== productId),
      )
      return
    }

    setCart((current) =>
      current.map((item) =>
        item.productId === productId
          ? { ...item, quantity }
          : item,
      ),
    )
  }

  const removeItem = (productId: string) => {
    setCart((current) =>
      current.filter((item) => item.productId !== productId),
    )
  }

  const clearCart = () => setCart([])

  const items: CartItem[] = cart.flatMap((line) => {
    const product = products.find(
      (item) => item.id === line.productId,
    )

    if (!product) return []

    return [
      {
        ...line,
        product,
        lineTotal: (product.price ?? 0) * line.quantity,
      },
    ]
  })

  const itemCount = items.reduce(
    (total, item) => total + item.quantity,
    0,
  )

  const subtotal = items.reduce(
    (total, item) => total + item.lineTotal,
    0,
  )

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
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
    throw new Error(
      'useCart must be used inside CartProvider',
    )
  }

  return context
}
