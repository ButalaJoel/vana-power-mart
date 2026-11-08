import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  Search,
  ShoppingCart,
} from 'lucide-react'
import { apiRequest, formatUGX } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { OrderDetails } from './OrderDetailsPanel'

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'AWAITING_STOCK',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const

export const PAYMENT_STATUSES = ['UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const

export function statusLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800',
  CONFIRMED: 'bg-blue-50 text-blue-800',
  PROCESSING: 'bg-blue-50 text-blue-800',
  AWAITING_STOCK: 'bg-orange-50 text-orange-800',
  READY_FOR_DELIVERY: 'bg-indigo-50 text-indigo-800',
  OUT_FOR_DELIVERY: 'bg-indigo-50 text-indigo-800',
  DELIVERED: 'bg-[#E6F4EA] text-[#166534]',
  CANCELLED: 'bg-gray-100 text-gray-600',
  UNPAID: 'bg-gray-100 text-gray-700',
  PAID: 'bg-[#E6F4EA] text-[#166534]',
  FAILED: 'bg-red-50 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-600',
}

export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_STYLES[value] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {statusLabel(value)}
    </span>
  )
}

export interface AdminOrderItem {
  id: string
  productName: string
  quantity: number
  unitPrice: string
  product: { id: string; slug: string; sku: string; imageUrls: string[] }
  variant: { id: string; sku: string } | null
  procurement: {
    id: string
    status: string
    unitCost: string | null
    notes: string | null
    confirmedAt: string | null
    receivedAt: string | null
    supplier: { id: string; name: string; phone: string | null; deliversDirect: boolean } | null
  } | null
}

export interface AdminOrder {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string
  deliveryMethod: string
  subtotal: string
  discountAmount: string
  deliveryFee: string
  total: string
  currency: string
  deliveryAddress: string
  deliveryArea: string | null
  customerNotes: string | null
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  fulfilledBy: string | null
  deliveryAssignee: string | null
  deliveryAssigneePhone: string | null
  deliveryCost: string | null
  dispatchedAt: string | null
  deliveredAt: string | null
  deliveryProof: string | null
  cancellationReason: string | null
  internalNotes: string | null
  createdAt: string
  updatedAt: string
  deliveryZone: { id: string; name: string; fee: string } | null
  voucher: { id: string; code: string } | null
  customer: { id: string; firstName: string; lastName: string; email: string | null; phone: string }
  items: AdminOrderItem[]
  payments: Array<{ id: string; method: string; provider: string; amount: string; status: string; phone: string | null; merchantReference: string; providerReference: string | null; failureReason: string | null; verifiedAt: string | null; createdAt: string }>
  statusHistory: Array<{ id: string; status: string; paymentStatus: string | null; note: string | null; actor: string | null; createdAt: string }>
  notifications: Array<{ id: string; recipient: string; message: string; status: string; error: string | null; createdAt: string }>
  returnRequests: Array<{ id: string; status: string; reason: string }>
  profit: { revenue: number; goodsCost: number; deliveryCost: number; grossProfit: number; marginPercent: number | null; costComplete: boolean }
}

interface OrdersResponse {
  data: AdminOrder[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminOrdersPage() {
  usePageTitle('Orders')

  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const paymentStatus = searchParams.get('payment') ?? ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [searchInput, setSearchInput] = useState(search)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => setSearchInput(search), [search])

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const query = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) query.set('search', search)
      if (status) query.set('status', status)
      if (paymentStatus) query.set('paymentStatus', paymentStatus)

      const result = await apiRequest<OrdersResponse>(`/api/orders?${query}`, { auth: true })
      setOrders(result.data)
      setPagination({
        total: result.pagination.total,
        totalPages: Math.max(1, result.pagination.totalPages),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load orders.')
    } finally {
      setLoading(false)
    }
  }, [page, search, status, paymentStatus])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilter('search', searchInput.trim())
  }

  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null
  const hasFilters = Boolean(search || status || paymentStatus)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[#64756A]">Management</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17241C]">Orders</h1>
        <p className="mt-2 text-sm text-[#64756A]">
          Review incoming orders, confirm them with customers and track fulfilment and payment.
        </p>
      </div>

      <section className="rounded-2xl border border-[#D9E5DD] bg-white">
        <div className="grid gap-3 border-b border-[#D9E5DD] p-4 md:grid-cols-[minmax(0,1fr)_200px_180px]">
          <form onSubmit={handleSearch} className="flex gap-2">
            <label htmlFor="order-search" className="sr-only">Search orders</label>
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64756A]" />
              <input
                id="order-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Order number, name, phone or email"
                className="w-full rounded-lg border border-[#D9E5DD] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#0B6843]"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[#064E32] px-4 text-sm font-semibold text-white"
            >
              Search
            </button>
          </form>

          <label className="sr-only" htmlFor="status-filter">Order status</label>
          <select
            id="status-filter"
            value={status}
            onChange={(event) => setFilter('status', event.target.value)}
            className="rounded-lg border border-[#D9E5DD] px-3 py-2.5 text-sm"
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>{statusLabel(value)}</option>
            ))}
          </select>

          <label className="sr-only" htmlFor="payment-filter">Payment status</label>
          <select
            id="payment-filter"
            value={paymentStatus}
            onChange={(event) => setFilter('payment', event.target.value)}
            className="rounded-lg border border-[#D9E5DD] px-3 py-2.5 text-sm"
          >
            <option value="">All payments</option>
            {PAYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>{statusLabel(value)}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div aria-busy="true" className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded bg-[#E7EEE9]" />
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <AlertCircle className="mx-auto text-red-600" />
            <p className="mt-3 font-semibold">Orders couldn't be loaded</p>
            <p className="mt-1 text-sm text-[#64756A]">{error}</p>
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#D9E5DD] px-4 py-2 text-sm font-medium"
            >
              <RotateCcw size={16} /> Retry
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center">
            <ShoppingCart className="mx-auto text-[#0B6843]" />
            <p className="mt-3 font-semibold text-[#17241C]">
              {hasFilters ? 'No orders match these filters' : 'No orders yet'}
            </p>
            <p className="mt-1 text-sm text-[#64756A]">
              {hasFilters
                ? 'Try a different search or status.'
                : 'Orders placed on the storefront will appear here.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="mt-4 text-sm font-semibold text-[#0B6843] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Cards on phones, table on larger screens. */}
            <ul className="divide-y divide-[#E7EEE9] md:hidden">
              {orders.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(order.id)}
                    className="w-full p-4 text-left hover:bg-[#F8FAF8]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#17241C]">{order.orderNumber}</p>
                        <p className="truncate text-sm text-[#64756A]">
                          {order.customer.firstName} {order.customer.lastName}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold">{formatUGX(order.total)}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge value={order.status} />
                      <StatusBadge value={order.paymentStatus} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-[#F5F8F6] text-[#64756A]">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Order</th>
                    <th scope="col" className="px-5 py-3 font-medium">Customer</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Items</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Total</th>
                    <th scope="col" className="px-5 py-3 font-medium">Status</th>
                    <th scope="col" className="px-5 py-3 font-medium">Payment</th>
                    <th scope="col" className="px-5 py-3 font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EEE9]">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-[#F8FAF8]">
                      <td className="px-5 py-4">
                        <p className="font-medium text-[#17241C]">{order.orderNumber}</p>
                        <p className="text-xs text-[#64756A]">{formatDate(order.createdAt)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-[#17241C]">
                          {order.customer.firstName} {order.customer.lastName}
                        </p>
                        <p className="text-xs text-[#64756A]">{order.customer.phone}</p>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </td>
                      <td className="px-5 py-4 text-right font-medium tabular-nums">
                        {formatUGX(order.total)}
                      </td>
                      <td className="px-5 py-4"><StatusBadge value={order.status} /></td>
                      <td className="px-5 py-4"><StatusBadge value={order.paymentStatus} /></td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedId(order.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E5DD] px-3 py-2 text-sm font-medium hover:bg-[#F5F8F6]"
                        >
                          <Eye size={15} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#D9E5DD] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#64756A]">
                {pagination.total} order{pagination.total === 1 ? '' : 's'} · page {page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setFilter('page', String(page - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D9E5DD] px-3 py-2 text-sm disabled:opacity-40"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setFilter('page', String(page + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D9E5DD] px-3 py-2 text-sm disabled:opacity-40"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {selectedOrder && (
        <OrderDetails
          order={selectedOrder}
          onClose={() => setSelectedId(null)}
          onUpdated={(updated) =>
            setOrders((current) =>
              current.map((order) => (order.id === updated.id ? updated : order)),
            )
          }
        />
      )}
    </div>
  )
}

