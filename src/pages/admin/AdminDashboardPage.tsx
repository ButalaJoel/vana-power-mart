
import { useEffect, useState } from 'react'
import {
  Banknote,
  ShoppingCart,
  Clock3,
  Package,
} from 'lucide-react'

import { AdminStatCard } from '../../components/admin/AdminStatCard'
import { RevenueChart } from '../../components/admin/RevenueChart'
import { OrderStatusBreakdown } from '../../components/admin/OrderStatusBreakdown'
import { RecentOrdersTable } from '../../components/admin/RecentOrdersTable'
import { LowStockPanel } from '../../components/admin/LowStockPanel'
import { BestSellingProducts } from '../../components/admin/BestSellingProducts'

// Use the deployed API URL in production and localhost during development.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export function AdminDashboardPage() {
  // Store the real product count and API loading status.
  const [productCount, setProductCount] = useState<number | null>(null)
  const [productsLoading, setProductsLoading] = useState(true)

  // Fetch products from our existing Express API when the page loads.
  useEffect(() => {
    let active = true

    fetch(`${API_URL}/api/products`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Could not load products')
        }
        return response.json()
      })
      .then((result) => {
        if (active && result.success) {
          setProductCount(result.count)
        }
      })
      .catch((error) => {
        console.error('Dashboard product request failed:', error)
      })
      .finally(() => {
        if (active) {
          setProductsLoading(false)
        }
      })

    // Prevent state updates if the page unmounts before the request finishes.
    return () => {
      active = false
    }
  }, [])

  // These cards remain labelled as demo values until real order endpoints exist.
  const stats = [
    {
      title: 'Total sales',
      value: 'Demo',
      description: 'Actual revenue API pending',
      icon: <Banknote size={20} />,
    },
    {
      title: 'Orders',
      value: 'Demo',
      description: 'Order records API pending',
      icon: <ShoppingCart size={20} />,
    },
    {
      title: 'Pending orders',
      value: 'Demo',
      description: 'Live fulfilment tracking pending',
      icon: <Clock3 size={20} />,
    },
    {
      title: 'Products in stock',
      value: productsLoading ? '…' : productCount === null ? '—' : productCount,
      description: 'Product count from the API',
      icon: <Package size={20} />,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Overview page title */}
      <div>
        <p className="text-sm text-[#64756A]">Overview</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17241C]">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-[#64756A]">
          Your store performance and daily operations at a glance.
        </p>
      </div>

      {/* Four key performance summary cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <AdminStatCard key={stat.title} {...stat} />
        ))}
      </section>

      {/* Revenue chart beside the order status breakdown */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <RevenueChart />
        </div>
        <div className="xl:col-span-2">
          <OrderStatusBreakdown />
        </div>
      </section>

      {/* Recent order activity */}
      <RecentOrdersTable />

      {/* Inventory alerts and best-selling products */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <LowStockPanel />
        <BestSellingProducts />
      </section>
    </div>
  )
}
