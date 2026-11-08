import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { trackPurchase } from '../lib/analytics'
import { usePageTitle } from '../hooks/usePageTitle'
import { routePaths } from '../lib/routePaths'
import { apiRequest, formatUGX } from '../lib/api'

interface PublicOrder {
  orderNumber: string
  status: string
  paymentStatus: string
  subtotal: string
  deliveryFee: string
  discountAmount?: string
  deliveryMethod?: string
  paymentMethod?: string
  total: string
  deliveryArea: string | null
  customerFirstName: string
  customerNotes: string | null
  createdAt: string
  documents?: { invoice: string; deliveryNote: string }
  items: Array<{
    productName: string
    quantity: number
    unitPrice: string
    productSlug: string
    imageUrl: string | null
  }>
}

export function OrderConfirmationPage() {
  const { orderId } = useParams()
  const location = useLocation()
  const passedOrder = (location.state as { order?: PublicOrder } | null)?.order

  const [order, setOrder] = useState<PublicOrder | null>(passedOrder ?? null)
  const [loading, setLoading] = useState(!passedOrder)
  const [error, setError] = useState('')

  usePageTitle('Order Confirmation')

  useEffect(() => {
    if (!order) return
    trackPurchase(
      order.orderNumber,
      Number(order.total),
      order.items.map((item) => ({
        item_id: item.productSlug,
        item_name: item.productName,
        price: Number(item.unitPrice),
        quantity: item.quantity,
      })),
    )
  }, [order])

  // Fetch the order when the page is opened directly or refreshed.
  useEffect(() => {
    if (passedOrder || !orderId) {
      setLoading(false)
      return
    }

    const controller = new AbortController()

    apiRequest<{ data: PublicOrder }>(
      `/api/orders/lookup/${encodeURIComponent(orderId)}`,
      { signal: controller.signal },
    )
      .then((result) => setOrder(result.data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Order not found.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [orderId, passedOrder])

  if (loading) {
    return (
      <main className="min-h-[60vh] bg-[#f5f6f5] px-4 py-12">
        <p className="text-center text-sm text-gray-500">Loading your order…</p>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="min-h-[60vh] bg-[#f5f6f5] px-4 py-12 sm:px-6">
        <section className="mx-auto max-w-2xl rounded-2xl border border-[#e1e7e2] bg-white p-8 text-center">
          <h1 className="text-2xl font-bold text-[#10231b]">Order not found</h1>
          <p className="mt-3 text-gray-600">
            {error || 'We could not find this order reference.'} If you placed
            an order, please contact us with your phone number.
          </p>
          <Link
            to={routePaths.products}
            className="mt-6 inline-block rounded-full bg-[var(--vana-green)] px-6 py-3 font-semibold text-white"
          >
            Continue shopping
          </Link>
        </section>
      </main>
    )
  }

  const awaitingStock = order.status === 'AWAITING_STOCK'

  return (
    <main className="min-h-[60vh] bg-[#f5f6f5] px-4 py-12 sm:px-6">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[#e1e7e2] bg-white p-6 sm:p-10">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eaf3ed] text-3xl text-[var(--vana-green)]">
            ✓
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-[var(--vana-green)]">
            Order received
          </p>

          <h1 className="mt-2 text-3xl font-bold text-[#10231b]">
            Thank you, {order.customerFirstName}!
          </h1>

          <p className="mt-4 leading-7 text-gray-600">Your order number is:</p>

          <p className="mt-2 break-all text-xl font-bold text-[var(--vana-green)]">
            {order.orderNumber}
          </p>
        </div>

        <div className="mt-8 divide-y divide-[#e8ece9] rounded-xl border border-[#e1e7e2]">
          {order.items.map((item) => (
            <div key={item.productSlug + item.unitPrice} className="flex gap-3 p-4">
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg bg-[#f3f6f3] object-contain"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#10231b]">
                  {item.productName}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {item.quantity} × {formatUGX(item.unitPrice)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold">
                {formatUGX(Number(item.unitPrice) * item.quantity)}
              </p>
            </div>
          ))}

          <div className="space-y-2 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatUGX(order.subtotal)}</span>
            </div>
            {Number(order.discountAmount ?? 0) > 0 && (
              <div className="flex justify-between text-[var(--vana-green)]">
                <span>Discount</span>
                <span>−{formatUGX(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery</span>
              <span className="text-gray-500">
                {order.deliveryMethod === 'collection'
                  ? 'Collection'
                  : Number(order.deliveryFee) > 0
                    ? formatUGX(order.deliveryFee)
                    : 'Free'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment</span>
              <span className={order.paymentStatus === 'PAID' ? 'font-semibold text-[var(--vana-green)]' : 'text-gray-500'}>
                {order.paymentStatus === 'PAID' ? 'Paid' : order.paymentMethod === 'cash-on-delivery' ? 'Cash on delivery' : order.paymentMethod === 'bank-transfer' ? 'Bank transfer' : 'Not yet paid'}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#e8ece9] pt-2 font-bold">
              <span>Total</span>
              <span className="text-[var(--vana-green)]">{formatUGX(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-[#f4f7f5] p-5 text-left">
          <h2 className="font-bold text-[#10231b]">What happens next?</h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            {awaitingStock
              ? 'Some items in your order are being restocked. Our team will call you to confirm availability, delivery and payment before anything is dispatched.'
              : order.paymentStatus === 'PAID'
                ? 'Your payment is confirmed. We will call you to arrange delivery and send SMS updates as your order moves.'
                : 'Our team will call you to confirm your order. We will send SMS updates as your order moves.'}
          </p>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to={routePaths.products}
            className="rounded-full bg-[var(--vana-green)] px-6 py-3 text-center font-semibold text-white hover:bg-[var(--vana-green-dark)]"
          >
            Continue shopping
          </Link>

          <Link
            to={`/track?order=${encodeURIComponent(order.orderNumber)}`}
            className="rounded-full border border-[var(--vana-green)] px-6 py-3 text-center font-semibold text-[var(--vana-green)] hover:bg-[#f4f7f5]"
          >
            Track this order
          </Link>

          {order.documents && (
            <a
              href={`${order.documents.invoice}&download=1`}
              className="rounded-full border border-[var(--vana-green)] px-6 py-3 text-center font-semibold text-[var(--vana-green)] hover:bg-[#f4f7f5]"
            >
              Download invoice (PDF)
            </a>
          )}

          <Link
            to={routePaths.home}
            className="rounded-full border border-[#dce5df] px-6 py-3 text-center font-semibold text-[#10231b] hover:bg-[#f4f7f5]"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  )
}
