import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { apiRequest, getCustomerToken, setCustomerToken } from '../lib/api'

// Shared storefront state that isn't the catalogue or cart:
// checkout configuration, the logged-in customer and the wishlist.

export interface DeliveryZone {
  id: string
  name: string
  fee: number
  estimatedTime: string | null
}

export interface StoreConfig {
  storeName: string
  storePhone: string
  collectionAddress: string
  freeDeliveryThreshold: number | null
  returnWindowDays: number
  mobileMoneyEnabled: boolean
  paymentTestMode: boolean
  deliveryZones: DeliveryZone[]
}

export interface CustomerProfile {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string | null
}

interface StoreContextValue {
  config: StoreConfig | null
  configError: string | null
  reloadConfig: () => Promise<void>

  customer: CustomerProfile | null
  customerLoading: boolean
  signIn: (token: string, customer: CustomerProfile) => void
  signOut: () => void

  wishlist: string[]
  isWishlisted: (productId: string) => boolean
  toggleWishlist: (productId: string) => void
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined)
const WISHLIST_KEY = 'vana-power-mart-wishlist'

function readWishlist(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(WISHLIST_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<StoreConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [customerLoading, setCustomerLoading] = useState(() => Boolean(getCustomerToken()))
  const [wishlist, setWishlist] = useState<string[]>(readWishlist)

  const reloadConfig = useCallback(async () => {
    try {
      setConfigError(null)
      const result = await apiRequest<{ data: StoreConfig }>('/api/store/config')
      setConfig(result.data)
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'Unable to load store settings.')
    }
  }, [])

  useEffect(() => {
    void reloadConfig()
  }, [reloadConfig])

  // Retry if the server wasn't reachable.
  useEffect(() => {
    if (!configError) return
    const timer = window.setInterval(() => void reloadConfig(), 5000)
    return () => window.clearInterval(timer)
  }, [configError, reloadConfig])

  // Restore the customer session.
  useEffect(() => {
    if (!getCustomerToken()) return
    apiRequest<{ customer: CustomerProfile }>('/api/customers/me', { customer: true })
      .then((result) => setCustomer(result.customer))
      .catch(() => setCustomer(null))
      .finally(() => setCustomerLoading(false))
  }, [])

  useEffect(() => {
    const onLogout = () => setCustomer(null)
    window.addEventListener('vana-customer-logout', onLogout)
    return () => window.removeEventListener('vana-customer-logout', onLogout)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist))
    } catch {
      // Storage unavailable: the wishlist lasts for this visit only.
    }
  }, [wishlist])

  const signIn = useCallback((token: string, profile: CustomerProfile) => {
    setCustomerToken(token)
    setCustomer(profile)
  }, [])

  const signOut = useCallback(() => {
    setCustomerToken(null)
    setCustomer(null)
  }, [])

  const isWishlisted = useCallback((productId: string) => wishlist.includes(productId), [wishlist])

  const toggleWishlist = useCallback((productId: string) => {
    setWishlist((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId].slice(-200),
    )
  }, [])

  return (
    <StoreContext.Provider
      value={{
        config,
        configError,
        reloadConfig,
        customer,
        customerLoading,
        signIn,
        signOut,
        wishlist,
        isWishlisted,
        toggleWishlist,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used inside StoreProvider.')
  return context
}
