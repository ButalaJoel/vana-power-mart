import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useProducts } from '../context/ProductContext'
import { useStore } from '../context/StoreContext'
import { apiRequest, formatUGX, newIdempotencyKey } from '../lib/api'
import { usePageTitle } from '../hooks/usePageTitle'
import { routePaths } from '../lib/routePaths'
import { trackBeginCheckout } from '../lib/analytics'

type DeliveryMethod = 'delivery' | 'collection'
type PaymentMethod = 'cash-on-delivery' | 'mobile-money' | 'bank-transfer'

interface CustomerDetails {
  fullName: string
  phone: string
  email: string
  deliveryMethod: DeliveryMethod
  zoneId: string
  area: string
  address: string
  instructions: string
  paymentMethod: PaymentMethod
  paymentPhone: string
}

interface PlacedOrder {
  orderNumber: string
  paymentMethod: string
  payment: { status: string } | null
}

const inputClass =
  'w-full rounded-xl border border-[#d7e1d9] px-4 py-3 outline-none focus:border-[var(--vana-green)]'

function StepHeading({ step, title, text }: { step: number; title: string; text: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eaf3ed] font-bold text-[var(--vana-green)]">
        {step}
      </span>
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-gray-500">{text}</p>
      </div>
    </div>
  )
}

export function CheckoutPage() {
  const { items, itemCount, subtotal, clearCart, loading: cartLoading } = useCart()
  const { refreshProducts } = useProducts()
  const { config, customer: account } = useStore()
  const navigate = useNavigate()

  usePageTitle('Checkout')

  const [reviewingOrder, setReviewingOrder] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderError, setOrderError] = useState('')
  // One key per checkout attempt: a retried submit returns the same order.
  const idempotencyKey = useRef(newIdempotencyKey())
  // Blocks a second click that lands before React re-renders the disabled button.
  const submittingRef = useRef(false)
  // Hidden "website" field: people never see it, bots fill it in.
  const [website, setWebsite] = useState('')
  const checkoutTracked = useRef(false)

  const [customer, setCustomer] = useState<CustomerDetails>({
    fullName: '',
    phone: '',
    email: '',
    deliveryMethod: 'delivery',
    zoneId: '',
    area: '',
    address: '',
    instructions: '',
    paymentMethod: 'cash-on-delivery',
    paymentPhone: '',
  })

  // Voucher state: what was typed, and what the server accepted.
  const [voucherInput, setVoucherInput] = useState('')
  const [voucher, setVoucher] = useState<{ code: string; discount: number } | null>(null)
  const [voucherMessage, setVoucherMessage] = useState('')
  const [checkingVoucher, setCheckingVoucher] = useState(false)

  // Prefill from the logged-in account.
  useEffect(() => {
    if (!account) return
    setCustomer((current) => ({
      ...current,
      fullName: current.fullName || `${account.firstName} ${account.lastName}`.trim(),
      phone: current.phone || account.phone.replace(/^\+256/, '0'),
      email: current.email || account.email || '',
    }))
  }, [account])

  // Offer mobile money first once the store says it is available.
  useEffect(() => {
    if (config?.mobileMoneyEnabled) {
      setCustomer((current) =>
        current.paymentMethod === 'cash-on-delivery' && !reviewingOrder
          ? { ...current, paymentMethod: 'mobile-money' }
          : current,
      )
    }
  }, [config?.mobileMoneyEnabled, reviewingOrder])

  // Re-check the voucher when the cart total changes.
  useEffect(() => {
    if (voucher) setVoucher(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal])

  const zones = config?.deliveryZones ?? []
  const zone = zones.find((item) => item.id === customer.zoneId) ?? null
  const isDelivery = customer.deliveryMethod === 'delivery'
  const discount = voucher?.discount ?? 0

  const delivery = useMemo(() => {
    if (!isDelivery) return { fee: 0, label: 'Free (collection)' }
    if (zones.length > 0 && !zone) return { fee: 0, label: 'Choose your area' }
    const threshold = config?.freeDeliveryThreshold
    if (threshold !== null && threshold !== undefined && subtotal - discount >= threshold) {
      return { fee: 0, label: 'Free' }
    }
    const fee = zone?.fee ?? 0
    return { fee, label: zones.length === 0 ? 'Confirmed by phone' : fee === 0 ? 'Free' : formatUGX(fee) }
  }, [isDelivery, zones.length, zone, config?.freeDeliveryThreshold, subtotal, discount])

  const total = Math.max(0, subtotal - discount + delivery.fee)

  useEffect(() => {
    if (checkoutTracked.current || items.length === 0) return
    checkoutTracked.current = true
    trackBeginCheckout(
      subtotal,
      items.map(({ product, quantity }) => ({ item_id: product.slug, item_name: product.name, price: product.price, quantity })),
    )
  }, [items, subtotal])

  function update<K extends keyof CustomerDetails>(field: K, value: CustomerDetails[K]) {
    setCustomer((previous) => ({ ...previous, [field]: value }))
  }

  async function applyVoucher() {
    const code = voucherInput.trim()
    if (!code) return
    try {
      setCheckingVoucher(true)
      setVoucherMessage('')
      const result = await apiRequest<{ data: { code: string; discount: number } }>('/api/store/vouchers/check', {
        method: 'POST',
        body: { code, subtotal },
      })
      setVoucher(result.data)
      setVoucherMessage(`Voucher applied: you save ${formatUGX(result.data.discount)}.`)
    } catch (error) {
      setVoucher(null)
      setVoucherMessage(error instanceof Error ? error.message : 'That voucher could not be applied.')
    } finally {
      setCheckingVoucher(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOrderError('')
    setReviewingOrder(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // The browser sends product IDs and quantities only; the server prices
  // everything, applies the voucher and delivery fee, and checks stock.
  async function handlePlaceOrder() {
    if (items.length === 0) {
      navigate(routePaths.products)
      return
    }
    if (placingOrder || submittingRef.current) return
    submittingRef.current = true

    const [firstName, ...rest] = customer.fullName.trim().split(/\s+/)

    try {
      setPlacingOrder(true)
      setOrderError('')

      const result = await apiRequest<{ data: PlacedOrder; paymentError?: string | null }>('/api/orders', {
        method: 'POST',
        customer: true,
        body: {
          idempotencyKey: idempotencyKey.current,
          website,
          customer: {
            firstName,
            lastName: rest.join(' '),
            phone: customer.phone,
            email: customer.email || undefined,
          },
          deliveryMethod: customer.deliveryMethod,
          deliveryZoneId: isDelivery && customer.zoneId ? customer.zoneId : undefined,
          deliveryArea: isDelivery ? customer.area : undefined,
          deliveryAddress: isDelivery ? customer.address : undefined,
          customerNotes: customer.instructions || undefined,
          paymentMethod: customer.paymentMethod,
          paymentPhone:
            customer.paymentMethod === 'mobile-money' ? customer.paymentPhone || customer.phone : undefined,
          voucherCode: voucher?.code,
          items: items.map(({ product, quantity }) => ({
            productId: product.id,
            variantId: product.variantId,
            quantity,
          })),
        },
      })

      // Only clear the cart once the order is safely stored.
      clearCart()
      void refreshProducts()

      const orderNumber = encodeURIComponent(result.data.orderNumber)
      if (result.data.paymentMethod === 'mobile-money') {
        navigate(`/payment/${orderNumber}`, { state: { phone: customer.phone, paymentError: result.paymentError } })
      } else {
        navigate(`/order-confirmation/${orderNumber}`, { state: { order: result.data } })
      }
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'Unable to place your order. Please try again.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      submittingRef.current = false
      setPlacingOrder(false)
    }
  }

  if (cartLoading && items.length === 0) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-gray-500">Loading your cart…</p>
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-[var(--vana-green)]">Your cart is empty</h1>
        <p className="mt-3 text-gray-600">Add some products before proceeding to checkout.</p>
        <Link
          to={routePaths.products}
          className="mt-6 inline-flex rounded-full bg-[var(--vana-green)] px-6 py-3 font-semibold text-white"
        >
          Browse products
        </Link>
      </section>
    )
  }

  const paymentOptions: Array<[PaymentMethod, string, string]> = [
    ...(config?.mobileMoneyEnabled
      ? ([[
          'mobile-money',
          'Mobile Money (MTN or Airtel)',
          config.paymentTestMode
            ? 'TEST MODE: no real money is taken.'
            : 'Pay now: approve the prompt on your phone with your PIN.',
        ]] as Array<[PaymentMethod, string, string]>)
      : []),
    ['cash-on-delivery', 'Cash on delivery', isDelivery ? 'Pay the rider when your order arrives.' : 'Pay when you collect.'],
    ['bank-transfer', 'Bank transfer', 'We will send our bank details when we confirm your order.'],
  ]

  const paymentLabel = paymentOptions.find(([value]) => value === customer.paymentMethod)?.[1] ?? customer.paymentMethod

  const totals = (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between gap-4">
        <span className="text-gray-500">Items ({itemCount})</span>
        <span className="font-semibold">{formatUGX(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between gap-4 text-[var(--vana-green)]">
          <span>Voucher {voucher?.code}</span>
          <span>−{formatUGX(discount)}</span>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <span className="text-gray-500">Delivery</span>
        <span className={delivery.fee > 0 ? 'font-semibold' : 'text-gray-500'}>{delivery.label}</span>
      </div>
      <div className="flex justify-between gap-4 border-t border-[#e1e7e2] pt-4 text-base font-bold">
        <span>Total</span>
        <span className="text-[var(--vana-green)]">{formatUGX(total)}</span>
      </div>
    </div>
  )

  return (
    <div className="bg-[#f5f7f5]">
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-5 text-sm text-gray-500">
          <Link to={routePaths.home}>Home</Link>
          {' / '}
          <Link to={routePaths.cart}>Cart</Link>
          {' / '}
          <span className="font-medium text-gray-900">Checkout</span>
        </nav>

        <h1 className="text-3xl font-extrabold text-[#10231b]">Checkout</h1>
        <p className="mt-2 text-sm text-gray-600">
          {account ? (
            <>Signed in as {account.firstName}. </>
          ) : (
            <>
              <Link to="/account" className="font-semibold text-[var(--vana-green)] underline">
                Sign in
              </Link>{' '}
              to track all your orders in one place, or continue as a guest.{' '}
            </>
          )}
        </p>

        {!reviewingOrder ? (
          <form
            id="checkout-form"
            onSubmit={handleSubmit}
            className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
          >
            <div className="space-y-6">
              <div aria-hidden="true" className="absolute left-[-10000px] h-px w-px overflow-hidden">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
                </label>
              </div>
              <section className="rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:p-7">
                <StepHeading step={1} title="Contact information" text="We send order updates by SMS to this number." />

                <label htmlFor="checkout-name" className="mb-2 block text-sm font-semibold">Full name *</label>
                <input
                  id="checkout-name"
                  required
                  autoComplete="name"
                  value={customer.fullName}
                  onChange={(event) => update('fullName', event.target.value)}
                  placeholder="Enter your full name"
                  className={`mb-5 ${inputClass}`}
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="checkout-phone" className="mb-2 block text-sm font-semibold">Phone number *</label>
                    <input
                      id="checkout-phone"
                      required
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      pattern="^(\+?256|0)?\s*\d[\d\s]{7,12}$"
                      title="A Ugandan phone number, e.g. 0772 123 456"
                      readOnly={Boolean(account)}
                      value={customer.phone}
                      onChange={(event) => update('phone', event.target.value)}
                      placeholder="e.g. 0772 123 456"
                      className={`${inputClass} ${account ? 'bg-[#f5f7f5]' : ''}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-email" className="mb-2 block text-sm font-semibold">Email address</label>
                    <input
                      id="checkout-email"
                      type="email"
                      autoComplete="email"
                      value={customer.email}
                      onChange={(event) => update('email', event.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:p-7">
                <StepHeading step={2} title="Delivery or collection" text="Choose how you would like to receive your items." />

                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    ['delivery', 'Delivery', 'Delivered to your door.'],
                    ['collection', 'Collection', config?.collectionAddress ? `Collect from ${config.collectionAddress}.` : 'Collect from Vana Power Mart.'],
                  ] as const).map(([value, title, description]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${
                        customer.deliveryMethod === value ? 'border-[var(--vana-green)] bg-[#f3f7f4]' : 'border-[#d7e1d9]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryMethod"
                        value={value}
                        checked={customer.deliveryMethod === value}
                        onChange={() => update('deliveryMethod', value)}
                        className="mt-1 accent-[#075331]"
                      />
                      <span>
                        <span className="block font-semibold">{title}</span>
                        <span className="mt-1 block text-xs text-gray-500">{description}</span>
                      </span>
                    </label>
                  ))}
                </div>

                {isDelivery && (
                  <div className="mt-5 space-y-5">
                    {zones.length > 0 && (
                      <div>
                        <label htmlFor="checkout-zone" className="mb-2 block text-sm font-semibold">Delivery area *</label>
                        <select
                          id="checkout-zone"
                          required
                          value={customer.zoneId}
                          onChange={(event) => update('zoneId', event.target.value)}
                          className={inputClass}
                        >
                          <option value="">Choose your area</option>
                          {zones.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} — {item.fee === 0 ? 'Free' : formatUGX(item.fee)}
                              {item.estimatedTime ? ` · ${item.estimatedTime}` : ''}
                            </option>
                          ))}
                        </select>
                        {config?.freeDeliveryThreshold ? (
                          <p className="mt-2 text-xs text-gray-500">
                            Free delivery on orders of {formatUGX(config.freeDeliveryThreshold)} or more.
                          </p>
                        ) : null}
                      </div>
                    )}

                    <div>
                      <label htmlFor="checkout-area" className="mb-2 block text-sm font-semibold">Town / neighbourhood *</label>
                      <input
                        id="checkout-area"
                        required
                        value={customer.area}
                        onChange={(event) => update('area', event.target.value)}
                        placeholder="e.g. Ntinda, Kampala"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label htmlFor="checkout-address" className="mb-2 block text-sm font-semibold">Delivery address *</label>
                      <textarea
                        id="checkout-address"
                        required
                        rows={3}
                        value={customer.address}
                        onChange={(event) => update('address', event.target.value)}
                        placeholder="Road, building, plot or other directions"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-5">
                  <label htmlFor="checkout-notes" className="mb-2 block text-sm font-semibold">Instructions (optional)</label>
                  <textarea
                    id="checkout-notes"
                    rows={2}
                    value={customer.instructions}
                    onChange={(event) => update('instructions', event.target.value)}
                    placeholder="Landmark, best time to call, or other notes"
                    className={inputClass}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:p-7">
                <StepHeading step={3} title="Payment method" text="Choose how you would like to pay." />

                {paymentOptions.map(([value, title, description]) => (
                  <label
                    key={value}
                    className={`mb-3 flex cursor-pointer gap-3 rounded-xl border p-4 ${
                      customer.paymentMethod === value ? 'border-[var(--vana-green)] bg-[#f3f7f4]' : 'border-[#d7e1d9]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={value}
                      checked={customer.paymentMethod === value}
                      onChange={() => update('paymentMethod', value)}
                      className="mt-1 accent-[#075331]"
                    />
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="mt-1 block text-xs text-gray-500">{description}</span>
                    </span>
                  </label>
                ))}

                {customer.paymentMethod === 'mobile-money' && (
                  <div className="mt-2">
                    <label htmlFor="checkout-momo" className="mb-2 block text-sm font-semibold">Mobile money number</label>
                    <input
                      id="checkout-momo"
                      type="tel"
                      inputMode="tel"
                      value={customer.paymentPhone}
                      onChange={(event) => update('paymentPhone', event.target.value)}
                      placeholder={customer.phone || 'Same as your phone number'}
                      className={inputClass}
                    />
                    <p className="mt-2 text-xs text-gray-500">Leave empty to use your contact number.</p>
                  </div>
                )}
              </section>
            </div>

            <aside className="rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:p-7 lg:sticky lg:top-6">
              <h2 className="text-xl font-bold">Your order</h2>
              <p className="mt-1 text-sm text-gray-500">{itemCount} items in your cart</p>

              <div className="mt-5 max-h-[320px] space-y-4 overflow-y-auto">
                {items.map(({ product, quantity, lineTotal }) => (
                  <div key={product.id} className="flex gap-3 border-b border-[#e1e7e2] pb-4">
                    {product.images[0] ? (
                      <img src={product.images[0]} alt="" className="h-16 w-16 rounded-lg bg-[#f3f6f3] object-contain" />
                    ) : (
                      <span className="h-16 w-16 shrink-0 rounded-lg bg-[#f3f6f3]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{product.name}</p>
                      <p className="mt-1 text-xs text-gray-500">Qty: {quantity}</p>
                      <p className="mt-1 text-sm font-bold text-[var(--vana-green)]">{formatUGX(lineTotal)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <label htmlFor="checkout-voucher" className="mb-2 block text-sm font-semibold">Voucher code</label>
                <div className="flex gap-2">
                  <input
                    id="checkout-voucher"
                    value={voucherInput}
                    onChange={(event) => setVoucherInput(event.target.value.toUpperCase())}
                    placeholder="e.g. WELCOME10"
                    className="min-w-0 flex-1 rounded-xl border border-[#d7e1d9] px-3 py-2.5 text-sm uppercase outline-none focus:border-[var(--vana-green)]"
                  />
                  {voucher ? (
                    <button
                      type="button"
                      onClick={() => {
                        setVoucher(null)
                        setVoucherInput('')
                        setVoucherMessage('')
                      }}
                      className="rounded-xl border border-[#d7e1d9] px-3 text-sm font-semibold"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={checkingVoucher || !voucherInput.trim()}
                      onClick={() => void applyVoucher()}
                      className="rounded-xl bg-[#10231b] px-4 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {checkingVoucher ? '…' : 'Apply'}
                    </button>
                  )}
                </div>
                {voucherMessage && (
                  <p role="status" className={`mt-2 text-xs ${voucher ? 'text-[var(--vana-green)]' : 'text-red-600'}`}>
                    {voucherMessage}
                  </p>
                )}
              </div>

              <div className="mt-5">{totals}</div>

              {/* Submit runs the browser's required-field checks first. */}
              <button
                type="submit"
                className="mt-6 w-full rounded-full bg-[var(--vana-green)] px-5 py-3.5 font-semibold text-white transition hover:opacity-90"
              >
                Review order
              </button>

              <Link to={routePaths.cart} className="mt-5 block text-center text-sm font-semibold text-[var(--vana-green)]">
                ← Return to cart
              </Link>
            </aside>
          </form>
        ) : (
          <section className="mt-8 rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:p-8">
            <h2 className="text-2xl font-bold">Review your order</h2>
            <p className="mt-2 text-sm text-gray-600">Check your details before placing your order.</p>

            {orderError && (
              <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold">Your order was not placed.</p>
                <p className="mt-1">{orderError}</p>
              </div>
            )}

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl bg-[#f3f6f3] p-5">
                <h3 className="font-bold">Customer details</h3>
                <p className="mt-3">{customer.fullName}</p>
                <p className="mt-1">{customer.phone}</p>
                {customer.email && <p className="mt-1">{customer.email}</p>}
              </div>

              <div className="rounded-xl bg-[#f3f6f3] p-5">
                <h3 className="font-bold">Delivery and payment</h3>
                <p className="mt-3">{isDelivery ? `Delivery${zone ? ` · ${zone.name}` : ''}` : 'Collection'}</p>
                {isDelivery && (
                  <>
                    <p className="mt-1">{customer.area}</p>
                    <p className="mt-1">{customer.address}</p>
                  </>
                )}
                {customer.instructions && <p className="mt-1 text-sm text-gray-600">{customer.instructions}</p>}
                <p className="mt-3">Payment: {paymentLabel}</p>
                {customer.paymentMethod === 'mobile-money' && (
                  <p className="mt-1 text-sm text-gray-600">
                    A payment prompt will be sent to {customer.paymentPhone || customer.phone}.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[#e1e7e2] p-4 sm:p-5">
              {items.map(({ product, quantity, lineTotal }) => (
                <div key={product.id} className="flex justify-between gap-4 border-b border-[#e1e7e2] py-4 last:border-0">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="mt-1 text-sm text-gray-500">Quantity: {quantity}</p>
                  </div>
                  <p className="shrink-0 font-medium">{formatUGX(lineTotal)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl bg-[#f3f6f3] p-5">{totals}</div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  setOrderError('')
                  setReviewingOrder(false)
                }}
                disabled={placingOrder}
                className="rounded-full border border-[#d7e1d9] px-6 py-3 font-medium disabled:opacity-50"
              >
                Edit details
              </button>

              <button
                type="button"
                onClick={() => void handlePlaceOrder()}
                disabled={placingOrder}
                aria-busy={placingOrder}
                className="rounded-full bg-[var(--vana-green)] px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
              >
                {placingOrder
                  ? 'Placing order…'
                  : customer.paymentMethod === 'mobile-money'
                    ? `Place order and pay ${formatUGX(total)}`
                    : 'Place order'}
              </button>
            </div>

            <p className="mt-4 text-xs leading-5 text-gray-500">
              Prices, discounts and delivery fees are confirmed by our system when you place the order.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
