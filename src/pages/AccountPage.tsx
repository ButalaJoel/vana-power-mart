import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Heart, LogOut, Package } from 'lucide-react'
import { apiRequest, formatDateTime, formatUGX, statusLabel } from '../lib/api'
import { usePageTitle } from '../hooks/usePageTitle'
import { useStore, type CustomerProfile } from '../context/StoreContext'
import { useProducts } from '../context/ProductContext'
import { useCart } from '../context/CartContext'

const inputClass =
  'mt-1 w-full rounded-xl border border-[#d7e1d9] px-4 py-3 font-normal outline-none focus:border-[var(--vana-green)]'

export function AccountPage() {
  const { customer, customerLoading } = useStore()
  usePageTitle(customer ? 'My account' : 'Sign in')

  if (customerLoading) {
    return <p className="px-4 py-16 text-center text-sm text-gray-500">Loading your account…</p>
  }

  return (
    <main className="min-h-[60vh] bg-[#f5f6f5] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">{customer ? <AccountDashboard customer={customer} /> : <AuthForms />}</div>
    </main>
  )
}

type AuthMode = 'login' | 'register' | 'reset'

function AuthForms() {
  const { signIn } = useStore()
  const [mode, setMode] = useState<AuthMode>('login')
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', password: '', code: '' })
  // Sign-up and password reset happen in two steps: send the SMS code, then use it.
  const [codeSent, setCodeSent] = useState(false)
  const [testCode, setTestCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn])

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  function switchMode(next: AuthMode) {
    setMode(next)
    setCodeSent(false)
    setTestCode('')
    setError('')
    setForm((current) => ({ ...current, code: '', password: '' }))
  }

  async function sendCode() {
    const result = await apiRequest<{ testCode?: string }>('/api/customers/otp', {
      method: 'POST',
      body: { phone: form.phone, purpose: mode === 'reset' ? 'RESET_PASSWORD' : 'REGISTER' },
    })
    setCodeSent(true)
    setTestCode(result.testCode ?? '')
    setResendIn(60)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    try {
      setBusy(true)
      setError('')

      if (mode !== 'login' && !codeSent) {
        await sendCode()
        return
      }

      const path = mode === 'login' ? '/api/customers/login' : mode === 'register' ? '/api/customers/register' : '/api/customers/reset-password'
      const body =
        mode === 'login'
          ? { phone: form.phone, password: form.password }
          : mode === 'reset'
            ? { phone: form.phone, code: form.code, password: form.password }
            : form
      const result = await apiRequest<{ token: string; customer: CustomerProfile }>(path, { method: 'POST', body })
      signIn(result.token, result.customer)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    try {
      setBusy(true)
      setError('')
      await sendCode()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send a new code.')
    } finally {
      setBusy(false)
    }
  }

  const detailsLocked = mode !== 'login' && codeSent
  const buttonLabel = busy
    ? 'Please wait…'
    : mode === 'login'
      ? 'Sign in'
      : !codeSent
        ? 'Send code by SMS'
        : mode === 'register'
          ? 'Create account'
          : 'Save new password'

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-[#e1e7e2] bg-white p-6 sm:p-8">
      <h1 className="sr-only">{mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create an account' : 'Reset your password'}</h1>
      {mode !== 'reset' ? (
        <div className="mb-6 grid grid-cols-2 rounded-full bg-[#f0f3f1] p-1 text-sm font-semibold">
          {(['login', 'register'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              className={`rounded-full py-2 ${mode === value ? 'bg-white text-[var(--vana-green)] shadow-sm' : 'text-gray-500'}`}
            >
              {value === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-lg font-bold text-[#10231b]">Reset your password</p>
          <p className="mt-1 text-sm text-gray-500">We'll send a code to your phone.</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              First name *
              <input required disabled={detailsLocked} autoComplete="given-name" value={form.firstName} onChange={set('firstName')} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold">
              Last name
              <input disabled={detailsLocked} autoComplete="family-name" value={form.lastName} onChange={set('lastName')} className={inputClass} />
            </label>
          </div>
        )}
        <label className="block text-sm font-semibold">
          Phone number *
          <input required disabled={detailsLocked} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="0772 123 456" className={inputClass} />
        </label>
        {mode === 'register' && (
          <label className="block text-sm font-semibold">
            Email (optional)
            <input disabled={detailsLocked} type="email" autoComplete="email" value={form.email} onChange={set('email')} className={inputClass} />
          </label>
        )}

        {detailsLocked && (
          <div className="rounded-xl bg-[#eef6f1] p-4 text-sm">
            <p>
              We sent a 6-digit code to <strong>{form.phone}</strong>.{' '}
              <button type="button" onClick={() => setCodeSent(false)} className="font-semibold text-[var(--vana-green)] underline">
                Change number
              </button>
            </p>
            {testCode && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-800">
                Test mode (SMS not connected): your code is <strong className="tracking-widest">{testCode}</strong>
              </p>
            )}
            <label className="mt-3 block font-semibold">
              Code *
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={form.code}
                onChange={set('code')}
                className={`${inputClass} tracking-[0.4em]`}
              />
            </label>
            <button
              type="button"
              onClick={resend}
              disabled={busy || resendIn > 0}
              className="mt-2 text-sm font-semibold text-[var(--vana-green)] disabled:text-gray-400"
            >
              {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
            </button>
          </div>
        )}

        {(mode === 'login' || detailsLocked) && (
          <label className="block text-sm font-semibold">
            {mode === 'reset' ? 'New password *' : 'Password *'}
            <input
              required
              type="password"
              minLength={mode === 'login' ? undefined : 8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={set('password')}
              className={inputClass}
            />
            {mode !== 'login' && <span className="mt-1 block text-xs font-normal text-gray-500">At least 8 characters.</span>}
          </label>
        )}

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className="w-full rounded-full bg-[var(--vana-green)] px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {buttonLabel}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm text-gray-500">
        {mode === 'login' && (
          <p>
            <button type="button" onClick={() => switchMode('reset')} className="font-semibold text-[var(--vana-green)] underline">
              Forgot your password?
            </button>
          </p>
        )}
        {mode === 'reset' && (
          <p>
            <button type="button" onClick={() => switchMode('login')} className="font-semibold text-[var(--vana-green)] underline">
              Back to sign in
            </button>
          </p>
        )}
        <p>
          No account needed to shop. <Link to="/track" className="font-semibold text-[var(--vana-green)] underline">Track an order</Link>
        </p>
      </div>
    </section>
  )
}

interface MyOrder {
  orderNumber: string
  status: string
  paymentStatus: string
  total: string
  createdAt: string
  itemCount: number
  firstItem: string | null
}

function AccountDashboard({ customer }: { customer: CustomerProfile }) {
  const { signOut, wishlist } = useStore()
  const [orders, setOrders] = useState<MyOrder[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<{ data: MyOrder[] }>('/api/customers/me/orders', { customer: true })
      .then((result) => setOrders(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load your orders.'))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#10231b]">Hello, {customer.firstName}</h1>
          <p className="mt-1 text-sm text-gray-500">{customer.phone}{customer.email ? ` · ${customer.email}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/account/wishlist" className="inline-flex items-center gap-2 rounded-full border border-[#d7e1d9] bg-white px-4 py-2 text-sm font-semibold">
            <Heart size={16} /> Wishlist ({wishlist.length})
          </Link>
          <button type="button" onClick={signOut} className="inline-flex items-center gap-2 rounded-full border border-[#d7e1d9] bg-white px-4 py-2 text-sm font-semibold">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e1e7e2] bg-white">
        <h2 className="flex items-center gap-2 border-b border-[#e8ece9] p-5 font-bold">
          <Package size={18} className="text-[var(--vana-green)]" /> My orders
        </h2>
        {error && <p className="p-5 text-sm text-red-700">{error}</p>}
        {!orders && !error && <p className="p-5 text-sm text-gray-500">Loading…</p>}
        {orders?.length === 0 && (
          <p className="p-5 text-sm text-gray-500">
            No orders yet. <Link to="/products" className="font-semibold text-[var(--vana-green)] underline">Start shopping</Link>
          </p>
        )}
        <ul className="divide-y divide-[#e8ece9]">
          {orders?.map((order) => (
            <li key={order.orderNumber}>
              <Link to={`/track?order=${encodeURIComponent(order.orderNumber)}`} className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-[#f8faf8]">
                <div className="min-w-0">
                  <p className="font-semibold">{order.orderNumber}</p>
                  <p className="truncate text-sm text-gray-500">
                    {order.firstItem}
                    {order.itemCount > 1 ? ` and ${order.itemCount - 1} more` : ''} · {formatDateTime(order.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatUGX(order.total)}</p>
                  <p className="text-xs text-gray-500">{statusLabel(order.status)} · {statusLabel(order.paymentStatus)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function WishlistPage() {
  usePageTitle('Wishlist')
  const { wishlist, toggleWishlist } = useStore()
  const { products, loading } = useProducts()
  const { addItem } = useCart()
  const saved = products.filter((product) => wishlist.includes(product.id))

  return (
    <main className="min-h-[60vh] bg-[#f5f6f5] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-extrabold text-[#10231b]">Wishlist</h1>
        {loading && <p className="mt-6 text-sm text-gray-500">Loading…</p>}
        {!loading && saved.length === 0 && (
          <p className="mt-6 rounded-2xl border border-dashed border-[#d7e1d9] bg-white p-10 text-center text-sm text-gray-500">
            Tap the heart on any product to save it here.
          </p>
        )}
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((product) => (
            <li key={product.id} className="flex gap-3 rounded-2xl border border-[#e1e7e2] bg-white p-4">
              {product.images[0] && <img src={product.images[0]} alt="" className="h-20 w-20 rounded-lg bg-[#f3f6f3] object-contain" />}
              <div className="min-w-0 flex-1">
                <Link to={`/products/${product.slug}`} className="line-clamp-2 text-sm font-semibold hover:underline">{product.name}</Link>
                <p className="mt-1 font-bold text-[var(--vana-green)]">{formatUGX(product.price)}</p>
                <div className="mt-2 flex gap-3 text-sm">
                  <button type="button" onClick={() => addItem(product.id, 1)} className="font-semibold text-[var(--vana-green)]">Add to cart</button>
                  <button type="button" onClick={() => toggleWishlist(product.id)} className="text-gray-500">Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
