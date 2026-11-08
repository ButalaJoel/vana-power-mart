import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, Smartphone, XCircle } from 'lucide-react'
import { apiRequest, formatUGX } from '../lib/api'
import { usePageTitle } from '../hooks/usePageTitle'
import { useStore } from '../context/StoreContext'

interface PaymentState {
  orderNumber: string
  total: string
  orderStatus: string
  paymentStatus: string
  paymentMethod: string
  mobileMoneyEnabled: boolean
  payment: {
    status: string
    reference: string
    failureReason: string | null
    amount: string
    phoneEnding: string | null
  } | null
}

const POLL_MS = 4000
const GIVE_UP_MS = 5 * 60_000

// Shown after a mobile money order: waits for the customer to approve the
// prompt on their phone, then confirms. Also used to retry a failed payment.
export function PaymentPage() {
  usePageTitle('Payment')
  const { orderNumber = '' } = useParams()
  const location = useLocation()
  const navState = (location.state as { phone?: string; paymentError?: string | null } | null) ?? {}
  const { config } = useStore()

  const [state, setState] = useState<PaymentState | null>(null)
  const [error, setError] = useState(navState.paymentError ?? '')
  const [orderPhone, setOrderPhone] = useState(navState.phone ?? '')
  const [paymentPhone, setPaymentPhone] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const startedAt = useRef(Date.now())

  const load = useCallback(async () => {
    try {
      const result = await apiRequest<{ data: PaymentState }>(`/api/payments/order/${encodeURIComponent(orderNumber)}`)
      setState(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check the payment.')
    }
  }, [orderNumber])

  useEffect(() => {
    void load()
  }, [load])

  const waiting = state?.payment?.status === 'PENDING' && !timedOut

  // Poll while the payment is pending.
  useEffect(() => {
    if (!waiting) return
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        setTimedOut(true)
        return
      }
      void load()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [waiting, load])

  async function retry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (retrying) return
    try {
      setRetrying(true)
      setError('')
      await apiRequest(`/api/payments/order/${encodeURIComponent(orderNumber)}/retry`, {
        method: 'POST',
        body: { orderPhone, paymentPhone: paymentPhone || orderPhone },
      })
      startedAt.current = Date.now()
      setTimedOut(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start the payment.')
    } finally {
      setRetrying(false)
    }
  }

  const paid = state?.paymentStatus === 'PAID'
  const failed = state?.payment?.status === 'FAILED' || (!state?.payment && state?.paymentStatus !== 'PAID')

  return (
    <main className="min-h-[60vh] bg-[#f5f6f5] px-4 py-12 sm:px-6">
      <section className="mx-auto max-w-lg rounded-2xl border border-[#e1e7e2] bg-white p-6 text-center sm:p-10">
        {!state && !error && <Loader2 className="mx-auto animate-spin text-[var(--vana-green)]" size={40} />}

        {state && paid && (
          <>
            <CheckCircle2 className="mx-auto text-[var(--vana-green)]" size={56} />
            <h1 className="mt-4 text-2xl font-bold text-[#10231b]">Payment received</h1>
            <p className="mt-2 text-gray-600">
              {formatUGX(state.total)} paid for order <strong>{state.orderNumber}</strong>. We've sent you an SMS.
            </p>
            <Link
              to={`/order-confirmation/${encodeURIComponent(state.orderNumber)}`}
              className="mt-6 inline-block rounded-full bg-[var(--vana-green)] px-6 py-3 font-semibold text-white"
            >
              View your order
            </Link>
          </>
        )}

        {state && !paid && waiting && (
          <>
            <Smartphone className="mx-auto text-[var(--vana-green)]" size={52} />
            <h1 className="mt-4 text-2xl font-bold text-[#10231b]">Check your phone</h1>
            <p className="mt-2 text-gray-600">
              Approve the payment of <strong>{formatUGX(state.total)}</strong>
              {state.payment?.phoneEnding ? ` on the number ending ${state.payment.phoneEnding}` : ''} by entering
              your mobile money PIN.
            </p>
            {config?.paymentTestMode && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                Test mode: this payment completes by itself in about 10 seconds. No money is taken.
              </p>
            )}
            <p className="mt-6 inline-flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={16} /> Waiting for confirmation…
            </p>
            <p className="mt-2 text-xs text-gray-400">Order {state.orderNumber}</p>
          </>
        )}

        {state && !paid && !waiting && (
          <>
            <XCircle className="mx-auto text-amber-600" size={52} />
            <h1 className="mt-4 text-2xl font-bold text-[#10231b]">
              {timedOut ? 'Still waiting for your payment' : 'Payment not completed'}
            </h1>
            <p className="mt-2 text-gray-600">
              Your order <strong>{state.orderNumber}</strong> is saved.{' '}
              {state.payment?.failureReason && !timedOut ? `Reason: ${state.payment.failureReason}. ` : ''}
              You can try again, or pay on delivery — we'll call to confirm.
            </p>

            {state.mobileMoneyEnabled && state.orderStatus !== 'CANCELLED' && (failed || timedOut) && (
              <form onSubmit={retry} className="mt-6 space-y-3 text-left">
                <label className="block text-sm font-semibold">
                  Phone number used for this order *
                  <input
                    required
                    type="tel"
                    value={orderPhone}
                    onChange={(event) => setOrderPhone(event.target.value)}
                    placeholder="0772 123 456"
                    className="mt-1 w-full rounded-xl border border-[#d7e1d9] px-4 py-3 font-normal outline-none focus:border-[var(--vana-green)]"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Pay from a different number (optional)
                  <input
                    type="tel"
                    value={paymentPhone}
                    onChange={(event) => setPaymentPhone(event.target.value)}
                    placeholder="Same as above"
                    className="mt-1 w-full rounded-xl border border-[#d7e1d9] px-4 py-3 font-normal outline-none focus:border-[var(--vana-green)]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={retrying}
                  aria-busy={retrying}
                  className="w-full rounded-full bg-[var(--vana-green)] px-6 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {retrying ? 'Sending payment request…' : `Try again: pay ${formatUGX(state.total)}`}
                </button>
              </form>
            )}

            <Link
              to={`/order-confirmation/${encodeURIComponent(state.orderNumber)}`}
              className="mt-4 inline-block text-sm font-semibold text-[var(--vana-green)] underline"
            >
              View order details
            </Link>
          </>
        )}

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
