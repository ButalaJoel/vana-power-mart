import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { apiRequest } from '../lib/api'
import type { Category } from '../types/catalog'

interface CategoryContextValue {
  // Active categories, loaded from PostgreSQL through the API.
  categories: Category[]
  loading: boolean
  error: string | null
  refreshCategories: () => Promise<void>
}

const CategoryContext = createContext<CategoryContextValue | undefined>(undefined)

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshCategories = useCallback(async () => {
    try {
      setError(null)
      const result = await apiRequest<{ data: Category[] }>('/api/categories')
      setCategories(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load categories.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshCategories()
  }, [refreshCategories])

  // If loading failed (server restarting, weak mobile data), try again every
  // 5 seconds and when the customer comes back to the tab.
  useEffect(() => {
    if (!error) return
    const timer = window.setInterval(() => void refreshCategories(), 5000)
    const onFocus = () => void refreshCategories()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
    }
  }, [error, refreshCategories])

  return (
    <CategoryContext.Provider
      value={{ categories, loading, error, refreshCategories }}
    >
      {children}
    </CategoryContext.Provider>
  )
}

export function useCategories() {
  const context = useContext(CategoryContext)

  if (!context) {
    throw new Error('useCategories must be used inside CategoryProvider.')
  }

  return context
}
