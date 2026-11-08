import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Banknote, Clock3, Factory, Package, ShoppingCart, Undo2 } from 'lucide-react'

import { AdminStatCard } from '../../components/admin/AdminStatCard'
import { apiRequest, formatUGX } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import type { ApiProduct } from '../../types/catalog'
import { StatusBadge, statusLabel, type AdminOrder } from './AdminOrdersPage'

interface Summary {
  ordersByStatus: Record<string, number>
  activeOrderCount: number
  revenue: string | number
  customerCount: number
  lowStockCount: number
  pendingProcurement: number
  openReturns: number
}

// Orders that still need staff action.
const OPEN_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'AWAITING_STOCK', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY']

export function AdminDashboardPage() {
  usePageTitle('Admin dashboard')

  const [summary, setSummary] = useState<Summary | null>(null)
  const [recentOrders, setRecentOrders] = useState<AdminOrder[]>([])
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    Promise.all([
      apiRequest<{ data: Summary }>('/api/orders/admin/summary', { auth: true }),
      apiRequest<{ data: AdminOrder[] }>('/api/orders?limit=6', { auth: true }),
      apiRequest<{ data: ApiProduct[] }>('/api/products/admin/all', { auth: true }),
    ])
      .then(([summaryResult, ordersResult, productsResult]) => {
        if (!active) return
        setSummary(summaryResult.data)
        setRecentOrders(ordersResult.data)
        setProducts(productsResult.data)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load the dashboard.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const activeProducts = products.filter((product) => product.isActive)
  const lowStock = activeProducts
    .filter((product) => (product.inventory?.quantity ?? 0) <= (product.inventory?.reorderLevel ?? 0))
    .sort((a, b) => (a.inventory?.quantity ?? 0) - (b.inventory?.quantity ?? 0))

  const openOrders = OPEN_STATUSES.reduce(
    (sum, status) => sum + (summary?.ordersByStatus[status] ?? 0),
    0,
  )
  const show = (value: string | number) => (loading ? '…' : error ? '—' : value)

  const stats = [
    {
      title: 'Sales value',
      value: show(formatUGX(summary?.revenue ?? 0)),
      description: 'All orders except cancelled',
      icon: <Banknote size={20} />,
    },
    {
      title: 'Orders',
      value: show(summary?.activeOrderCount ?? 0),
      description: 'Excluding cancelled orders',
      icon: <ShoppingCart size={20} />,
    },
    {
      title: 'Open orders',
      value: show(openOrders),
      description: `${summary?.ordersByStatus.AWAITING_STOCK ?? 0} awaiting stock`,
      icon: <Clock3 size={20} />,
    },
    {
      title: 'Active products',
      value: show(activeProducts.length),
      description: `${lowStock.length} at or below their low-stock level`,
      icon: <Package size={20} />,
    },
    {
      title: 'Items to source',
      value: show(summary?.pendingProcurement ?? 0),
      description: 'Order items not yet confirmed with a supplier',
      icon: <Factory size={20} />,
    },
    {
      title: 'Open returns',
      value: show(summary?.openReturns ?? 0),
      description: 'Return requests waiting for action',
      icon: <Undo2 size={20} />,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[#64756A]">Overview</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17241C]">Dashboard</h1>
        <p className="mt-2 text-sm text-[#64756A]">
          Your store's orders and stock at a glance.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <AdminStatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="rounded-xl border border-[#D9E5DD] bg-white xl:col-span-3">
          <div className="flex items-center justify-between gap-3 p-5 pb-3">
            <h2 className="font-semibold text-[#17241C]">Recent orders</h2>
            <Link to="/admin/orders" className="text-sm font-semibold text-[#0B6843] hover:underline">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2 p-5 pt-0">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded bg-[#E7EEE9]" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <p className="p-5 pt-0 text-sm text-[#64756A]">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-[#E7EEE9]">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    to={`/admin/orders?search=${encodeURIComponent(order.orderNumber)}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-[#F8FAF8]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#17241C]">{order.orderNumber}</p>
                      <p className="truncate text-xs text-[#64756A]">
                        {order.customer.firstName} {order.customer.lastName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge value={order.status} />
                      <span className="text-sm font-semibold tabular-nums">{formatUGX(order.total)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-[#D9E5DD] bg-white p-5 xl:col-span-2">
          <h2 className="font-semibold text-[#17241C]">Orders by status</h2>
          {loading ? (
            <div className="mt-4 h-32 animate-pulse rounded bg-[#E7EEE9]" />
          ) : (
            <dl className="mt-4 space-y-2 text-sm">
              {Object.keys(summary?.ordersByStatus ?? {}).length === 0 && (
                <p className="text-[#64756A]">No orders yet.</p>
              )}
              {Object.entries(summary?.ordersByStatus ?? {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <dt className="text-[#64756A]">{statusLabel(status)}</dt>
                  <dd>
                    <Link
                      to={`/admin/orders?status=${status}`}
                      className="font-semibold tabular-nums text-[#17241C] hover:underline"
                    >
                      {count}
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#D9E5DD] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-[#17241C]">
              <AlertTriangle size={18} className="text-amber-600" /> Low-stock alerts
            </h2>
            <p className="mt-1 text-sm text-[#64756A]">
              Active products at or below their low-stock level. Update stock from Products.
            </p>
          </div>
          <Link to="/admin/products" className="shrink-0 text-sm font-semibold text-[#0B6843] hover:underline">
            Products
          </Link>
        </div>
        {loading ? (
          <div className="mt-4 h-20 animate-pulse rounded bg-[#E7EEE9]" />
        ) : lowStock.length === 0 ? (
          <p className="mt-4 text-sm text-[#64756A]">All products are above their low-stock level.</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lowStock.slice(0, 9).map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#F5F8F6] px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{product.name}</span>
                <span className="shrink-0 font-semibold tabular-nums text-amber-700">
                  {product.inventory?.quantity ?? 0} left
                </span>
              </li>
            ))}
          </ul>
        )}
        {lowStock.length > 9 && (
          <p className="mt-2 text-xs text-[#64756A]">and {lowStock.length - 9} more.</p>
        )}
      </section>
    </div>
  )
}
