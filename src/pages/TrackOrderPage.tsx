import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, FileText, PackageSearch, Phone, Share2 } from 'lucide-react'
import { apiRequest, formatDateTime, formatUGX, statusLabel } from '../lib/api'
import { usePageTitle } from '../hooks/usePageTitle'
import { useStore } from '../context/StoreContext'

export interface TrackedOrder {
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string
  deliveryMethod: string
  subtotal: string
  discountAmount: string
  deliveryFee: string
  total: string
  deliveryZone: { name: string; estimatedTime: string | null } | null
  createdAt: string
  dispatchedAt: string | null
  deliveredAt: string | null
  rider: { name: string; phone: string | null } | null
  items: Array<{ productName: string; quantity: number; unitPrice: string; productSlug: string; imageUrl: string | null }>
  timeline: Array<{ status: string; paymentStatus: string | null; at: string }>
  payment: { status: string; method: string; reference: string; failureReason: string | null } | null
  returnEligible: boolean
  returnDeadline: string | null
  returns: Array<{ status: string; reason: string; createdAt: string }>
  documents?: { invoice: string; deliveryNote: string }
}

// The happy path a customer sees, in order.
const STEPS = [
  { key: 'PLACED', label: 'Order placed' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'READY_FOR_DELIVERY', label: 'Packed' },
  { key: 'OUT_FOR_DELIVERY', label: 'On the way' },
  { key: 'DELIVERED', label: 'Delivered' },
]
const STEP_INDEX: Record<string, number> = {
  PENDING: 0,
  AWAITING_STOCK: 0,
  CONFIRMED: 1,
  PROCESSING: 1,
  READY_FOR_DELIVERY: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
}

export function TrackOrderPage() {
  usePageTitle('Track your order')
  const [params, setParams] = useSearchParams()
  const { customer } = useStore()
  const [orderNumber, setOrderNumber] = useState(params.get('order') ?? '')
  const [phone, setPhone] = useState(customer?.phone.replace(/^\+256/, '0') ?? '')
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (customer && !phone) setPhone(customer.phone.replace(/^\+256/, '0'))
  }, [customer, phone])

  // Links in our SMS include a token, so the order opens without typing the phone.
  const linkToken = params.get('t') ?? ''

  const lookup = useCallback(async (number: string, phoneNumber: string, token = '') => {
    try {
      setLoading(true)
      setError('')
      const query = new URLSearchParams(
        token ? { orderNumber: number.trim(), t: token } : { orderNumber: number.trim(), phone: phoneNumber.trim() },
      )
      const result = await apiRequest<{ data: TrackedOrder }>(`/api/orders/track?${query}`)
      setOrder(result.data)
    } catch (err) {
      setOrder(null)
      setError(err instanceof Error ? err.message : 'Order not found.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Logged-in customers following a link from their account load straight away.
  useEffect(() => {
    const number = params.get('order')
    const token = params.get('t')
    if (number && token) void lookup(number, '', token)
    else if (number && customer) void lookup(number, customer.phone)
  }, [params, customer, lookup])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setParams({ order: orderNumber.trim().toUpperCase() })
    void lookup(orderNumber, phone)
  }

  return (
    <main className="min-h-[60vh] bg-[#f5f6f5] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-extrabold text-[#10231b]">Track your order</h1>

        <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-semibold">
            Order number
            <input
              required
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value.toUpperCase())}
              placeholder="VPM-20261108-XXXXXX"
              className="mt-1 w-full rounded-xl border border-[#d7e1d9] px-3 py-2.5 font-normal outline-none focus:border-[var(--vana-green)]"
            />
          </label>
          <label className="text-sm font-semibold">
            Phone number used
            <input
              required
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0772 123 456"
              className="mt-1 w-full rounded-xl border border-[#d7e1d9] px-3 py-2.5 font-normal outline-none focus:border-[var(--vana-green)]"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[var(--vana-green)] px-5 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Searching…' : 'Track'}
          </button>
        </form>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
        )}

        {!order && !error && !loading && (
          <div className="rounded-2xl border border-dashed border-[#d7e1d9] p-10 text-center text-sm text-gray-500">
            <PackageSearch className="mx-auto mb-3 text-[var(--vana-green)]" />
            Your order number is in the SMS we sent you.
          </div>
        )}

        {order && (
          <OrderTracking
            order={order}
            phone={phone}
            linkToken={linkToken}
            onChanged={() => void lookup(order.orderNumber, phone, linkToken)}
          />
        )}
      </div>
    </main>
  )
}

function OrderTracking({ order, phone, linkToken, onChanged }: { order: TrackedOrder; phone: string; linkToken: string; onChanged: () => void }) {
  const cancelled = order.status === 'CANCELLED'
  const current = STEP_INDEX[order.status] ?? 0
  const at = (status: string) => order.timeline.find((entry) => entry.status === status)?.at

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Order</p>
            <p className="text-lg font-bold">{order.orderNumber}</p>
            <p className="text-xs text-gray-500">Placed {formatDateTime(order.createdAt)}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[var(--vana-green)]">{formatUGX(order.total)}</p>
            <p className="text-xs text-gray-500">Payment: {statusLabel(order.paymentStatus)}</p>
          </div>
        </div>

        {cancelled ? (
          <p className="mt-6 rounded-xl bg-gray-100 p-4 text-sm">This order was cancelled.</p>
        ) : (
          <ol className="mt-8 grid grid-cols-5 gap-1">
            {STEPS.map((step, index) => {
              const done = index <= current
              return (
                <li key={step.key} className="text-center">
                  <span
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                      done ? 'border-[var(--vana-green)] bg-[var(--vana-green)] text-white' : 'border-[#d7e1d9] text-gray-400'
                    }`}
                  >
                    {done ? <Check size={16} /> : index + 1}
                  </span>
                  <span className={`mt-2 block text-[11px] leading-tight sm:text-xs ${done ? 'font-semibold text-[#10231b]' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                  {index === 0 && <span className="block text-[10px] text-gray-400">{formatDateTime(order.createdAt)}</span>}
                  {index > 0 && at(step.key) && <span className="block text-[10px] text-gray-400">{formatDateTime(at(step.key))}</span>}
                </li>
              )
            })}
          </ol>
        )}

        {order.status === 'AWAITING_STOCK' && (
          <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Some items are being restocked. We'll call you to confirm availability.
          </p>
        )}

        {order.rider && (
          <p className="mt-6 flex items-center gap-2 rounded-xl bg-[#eaf3ed] p-4 text-sm">
            <Phone size={16} className="text-[var(--vana-green)]" />
            On the way with {order.rider.name}
            {order.rider.phone && (
              <a href={`tel:${order.rider.phone}`} className="font-semibold text-[var(--vana-green)] underline">
                {order.rider.phone}
              </a>
            )}
          </p>
        )}

        {order.paymentMethod === 'mobile-money' && ['UNPAID', 'PENDING', 'FAILED'].includes(order.paymentStatus) && !cancelled && (
          <Link
            to={`/payment/${encodeURIComponent(order.orderNumber)}`}
            state={{ phone }}
            className="mt-6 inline-block rounded-full bg-[var(--vana-green)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Complete payment
          </Link>
        )}
      </section>

      <section className="rounded-2xl border border-[#e1e7e2] bg-white">
        <ul className="divide-y divide-[#e8ece9]">
          {order.items.map((item) => (
            <li key={item.productSlug + item.unitPrice} className="flex gap-3 p-4">
              {item.imageUrl && <img src={item.imageUrl} alt="" className="h-14 w-14 rounded-lg bg-[#f3f6f3] object-contain" />}
              <div className="min-w-0 flex-1">
                <Link to={`/products/${item.productSlug}`} className="text-sm font-semibold hover:underline">
                  {item.productName}
                </Link>
                <p className="text-xs text-gray-500">{item.quantity} × {formatUGX(item.unitPrice)}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t border-[#e8ece9] p-4 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatUGX(order.subtotal)}</span></div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between text-[var(--vana-green)]"><span>Discount</span><span>−{formatUGX(order.discountAmount)}</span></div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Delivery{order.deliveryZone ? ` (${order.deliveryZone.name})` : ''}</span>
            <span>{order.deliveryMethod === 'collection' ? 'Collection' : formatUGX(order.deliveryFee)}</span>
          </div>
          <div className="flex justify-between font-bold"><span>Total</span><span>{formatUGX(order.total)}</span></div>
        </div>
      </section>

      {order.returns.length > 0 && (
        <section className="rounded-2xl border border-[#e1e7e2] bg-white p-5 text-sm">
          <h2 className="font-bold">Return</h2>
          {order.returns.map((request) => (
            <p key={request.createdAt} className="mt-2">
              {request.reason} — <strong>{statusLabel(request.status)}</strong> ({formatDateTime(request.createdAt)})
            </p>
          ))}
        </section>
      )}

      {order.documents && <OrderDocuments order={order} />}

      {order.returnEligible && <ReturnForm order={order} phone={phone} linkToken={linkToken} onDone={onChanged} />}
    </div>
  )
}

function OrderDocuments({ order }: { order: TrackedOrder }) {
  const documents = order.documents!
  const paid = order.paymentStatus === 'PAID'
  const title = paid ? 'Receipt' : 'Invoice'
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <section className="rounded-2xl border border-[#e1e7e2] bg-white p-5">
      <h2 className="font-bold">Your documents</h2>
      <p className="mt-1 text-sm text-gray-500">Keep these for warranty and returns.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`${documents.invoice}&download=1`} className="inline-flex items-center gap-2 rounded-full bg-[var(--vana-green)] px-4 py-2 text-sm font-semibold text-white">
          <FileText size={16} /> Download {title.toLowerCase()} (PDF)
        </a>
        {['OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status) && (
          <a href={`${documents.deliveryNote}&download=1`} className="inline-flex items-center gap-2 rounded-full border border-[#d7e1d9] px-4 py-2 text-sm font-semibold">
            <FileText size={16} /> Delivery note
          </a>
        )}
        {canShare && (
          <button
            type="button"
            onClick={() => void navigator.share({ title: `${title} ${order.orderNumber}`, url: documents.invoice }).catch(() => undefined)}
            className="inline-flex items-center gap-2 rounded-full border border-[#d7e1d9] px-4 py-2 text-sm font-semibold"
          >
            <Share2 size={16} /> Share
          </button>
        )}
      </div>
    </section>
  )
}

function ReturnForm({ order, phone, linkToken, onDone }: { order: TrackedOrder; phone: string; linkToken: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [reasons, setReasons] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || reasons.length) return
    apiRequest<{ data: string[] }>('/api/returns/reasons')
      .then((result) => setReasons(result.data))
      .catch(() => setReasons([]))
  }, [open, reasons.length])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setSending(true)
      setError('')
      await apiRequest('/api/returns', { method: 'POST', body: { orderNumber: order.orderNumber, phone, t: linkToken || undefined, reason, details } })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send the request.')
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <p className="text-sm text-gray-600">
        Problem with your order?{' '}
        <button type="button" onClick={() => setOpen(true)} className="font-semibold text-[var(--vana-green)] underline">
          Request a return
        </button>
        {order.returnDeadline ? ` by ${formatDateTime(order.returnDeadline)}` : ''}.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[#e1e7e2] bg-white p-5">
      <h2 className="font-bold">Request a return</h2>
      <label className="block text-sm font-semibold">
        Reason *
        <select
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 w-full rounded-xl border border-[#d7e1d9] px-3 py-2.5 font-normal"
        >
          <option value="">Choose a reason</option>
          {reasons.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Details
        <textarea
          rows={3}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="What happened? Which item?"
          className="mt-1 w-full rounded-xl border border-[#d7e1d9] px-3 py-2.5 font-normal"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={sending} className="rounded-full bg-[var(--vana-green)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {sending ? 'Sending…' : 'Send request'}
      </button>
    </form>
  )
}
