
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { routePaths } from '../lib/routePaths'

type DeliveryMethod = 'delivery' | 'collection'
type PaymentMethod = 'cash-on-delivery' | 'mobile-money' | 'bank-transfer'

interface CustomerDetails {
  fullName: string
  phone: string
  email: string
  deliveryMethod: DeliveryMethod
  district: string
  address: string
  instructions: string
  paymentMethod: PaymentMethod
}

export function CheckoutPage() {
  const { items, itemCount, subtotal, clearCart,} = useCart()
  const navigate = useNavigate()

  usePageTitle('Checkout')

  const [reviewingOrder, setReviewingOrder] = useState(false)

  const [customer, setCustomer] = useState<CustomerDetails>({
    fullName: '',
    phone: '',
    email: '',
    deliveryMethod: 'delivery',
    district: '',
    address: '',
    instructions: '',
    paymentMethod: 'mobile-money',
  })

  const formatPrice = (price: number) =>
    `UGX ${price.toLocaleString('en-UG')}`

  function updateCustomer<K extends keyof CustomerDetails>(
    field: K,
    value: CustomerDetails[K],
  ) {
    setCustomer((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReviewingOrder(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

// Create a demo order reference and navigate to confirmation.

  function handlePlaceDemoOrder() {
 // Stop if there is nothing to order.
if (items.length === 0) {
  navigate(routePaths.products)
  return
}

// Clear the shared cart after accepting the demo order.
clearCart()

// Keep your existing order-reference creation and navigation here.

    const orderId = `VPM-${Date.now()}`

    const demoOrder = {
      orderId,
      customer,
      items: items.map(({ product, quantity, lineTotal }) => ({
        productId: product.id,
        name: product.name,
        quantity,
        unitPrice: product.price ?? 0,
        lineTotal,
      })),
      itemCount,
      subtotal,
      deliveryCharge: null,
      paymentStatus: 'pending',
      orderStatus: 'awaiting-confirmation',
      createdAt: new Date().toISOString(),
    }

    // Demo only: save the order in this browser for the confirmation page.
    // A production order must be created and validated by the backend.
    sessionStorage.setItem(
      `vana-demo-order-${orderId}`,
      JSON.stringify(demoOrder),
    )

    navigate(`/order-confirmation/${encodeURIComponent(orderId)}`, {
      state: demoOrder,
    })
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-[var(--vana-green)]">
          Your cart is empty
        </h1>

        <p className="mt-3 text-gray-600">
          Add some products before proceeding to checkout.
        </p>

        <Link
          to={routePaths.products}
          className="mt-6 inline-flex rounded-full bg-[var(--vana-green)] px-6 py-3 font-semibold text-white"
        >
          Browse products
        </Link>
      </section>
    )
  }

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

        <h1 className="text-3xl font-extrabold text-[#10231b]">
          Checkout
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Provide your details so we can prepare your order.
        </p>

        {!reviewingOrder ? (
          <form
            id="checkout-form"
            onSubmit={handleSubmit}
            className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
          >
            <div className="space-y-6">
              <section className="rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:p-7">
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf3ed] font-bold text-[var(--vana-green)]">
                    1
                  </span>
                  <div>
                    <h2 className="text-lg font-bold">Contact information</h2>
                    <p className="text-sm text-gray-500">
                      How can we reach you about your order?
                    </p>
                  </div>
                </div>

                <label className="mb-2 block text-sm font-semibold">
                  Full name *
                </label>
                <input
                  required
                  autoComplete="name"
                  value={customer.fullName}
                  onChange={(event) =>
                    updateCustomer('fullName', event.target.value)
                  }
                  placeholder="Enter your full name"
                  className="mb-5 w-full rounded-xl border border-[#d7e1d9] px-4 py-3 outline-none focus:border-[var(--vana-green)]"
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold">
                      Phone number *
                    </label>
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      value={customer.phone}
                      onChange={(event) =>
                        updateCustomer('phone', event.target.value)
                      }
                      placeholder="e.g. 07XX XXX XXX"
                      className="w-full rounded-xl border border-[#d7e1d9] px-4 py-3 outline-none focus:border-[var(--vana-green)]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold">
                      Email address
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={customer.email}
                      onChange={(event) =>
                        updateCustomer('email', event.target.value)
                      }
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-[#d7e1d9] px-4 py-3 outline-none focus:border-[var(--vana-green)]"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:p-7">
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf3ed] font-bold text-[var(--vana-green)]">
                    2
                  </span>
                  <div>
                    <h2 className="text-lg font-bold">
                      Delivery or collection
                    </h2>
                    <p className="text-sm text-gray-500">
                      Choose how you would like to receive your items.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    ['delivery', 'Delivery', 'Have your order delivered to your location.'],
                    ['collection', 'Collection', 'Arrange collection with Vana Power Mart.'],
                  ] as const).map(([value, title, description]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${
                        customer.deliveryMethod === value
                          ? 'border-[var(--vana-green)] bg-[#f3f7f4]'
                          : 'border-[#d7e1d9]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryMethod"
                        value={value}
                        checked={customer.deliveryMethod === value}
                        onChange={() =>
                          updateCustomer('deliveryMethod', value)
                        }
                        className="mt-1 accent-[#075331]"
                      />
                      <span>
                        <span className="block font-semibold">{title}</span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>

                {customer.deliveryMethod === 'delivery' && (
                  <div className="mt-5 space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-semibold">
                        District or town *
                      </label>
                      <input
                        required
                        value={customer.district}
                        onChange={(event) =>
                          updateCustomer('district', event.target.value)
                        }
                        placeholder="e.g. Kampala, Wakiso, Mukono"
                        className="w-full rounded-xl border border-[#d7e1d9] px-4 py-3 outline-none focus:border-[var(--vana-green)]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold">
                        Delivery address *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={customer.address}
                        onChange={(event) =>
                          updateCustomer('address', event.target.value)
                        }
                        placeholder="Area, road, building or other directions"
                        className="w-full rounded-xl border border-[#d7e1d9] px-4 py-3 outline-none focus:border-[var(--vana-green)]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold">
                        Delivery instructions (optional)
                      </label>
                      <textarea
                        rows={2}
                        value={customer.instructions}
                        onChange={(event) =>
                          updateCustomer('instructions', event.target.value)
                        }
                        placeholder="Nearby landmark or instructions for the delivery team"
                        className="w-full rounded-xl border border-[#d7e1d9] px-4 py-3 outline-none focus:border-[var(--vana-green)]"
                      />
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:p-7">
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf3ed] font-bold text-[var(--vana-green)]">
                    3
                  </span>
                  <div>
                    <h2 className="text-lg font-bold">Payment method</h2>
                    <p className="text-sm text-gray-500">
                      Choose your preferred payment option.
                    </p>
                  </div>
                </div>

                {([
                  ['mobile-money', 'Mobile Money', 'MTN MoMo or Airtel Money; integration pending.'],
                  ['cash-on-delivery', 'Cash on delivery', 'Your order must be confirmed before dispatch.'],
                  ['bank-transfer', 'Bank transfer / card', 'Secure payment integration will be added later.'],
                ] as const).map(([value, title, description]) => (
                  <label
                    key={value}
                    className={`mb-3 flex cursor-pointer gap-3 rounded-xl border p-4 ${
                      customer.paymentMethod === value
                        ? 'border-[var(--vana-green)] bg-[#f3f7f4]'
                        : 'border-[#d7e1d9]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={value}
                      checked={customer.paymentMethod === value}
                      onChange={() => updateCustomer('paymentMethod', value)}
                      className="mt-1 accent-[#075331]"
                    />
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="mt-1 block text-xs text-gray-500">
                        {description}
                      </span>
                    </span>
                  </label>
                ))}
              </section>
            </div>

            <aside className="rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:p-7 lg:sticky lg:top-6">
              <h2 className="text-xl font-bold">Your order</h2>
              <p className="mt-1 text-sm text-gray-500">
                {itemCount} items in your cart
              </p>

              <div className="mt-5 max-h-[420px] space-y-4 overflow-y-auto">
                {items.map(({ product, quantity, lineTotal }) => (
                  <div
                    key={product.id}
                    className="flex gap-3 border-b border-[#e1e7e2] pb-4"
                  >
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-16 w-16 rounded-lg bg-[#f3f6f3] object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{product.name}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Qty: {quantity}
                      </p>
                      <p className="mt-1 text-sm font-bold text-[var(--vana-green)]">
                        {formatPrice(lineTotal)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Delivery</span>
                  <span className="text-gray-500">To be confirmed</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-[#e1e7e2] pt-4 font-bold">
                  <span>Subtotal before delivery</span>
                  <span className="text-[var(--vana-green)]">
                    {formatPrice(subtotal)}
                  </span>
                </div>
              </div>

              <button
                 type="button"
  onClick={() => {
    setReviewingOrder(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }}
  className="mt-6 w-full rounded-full bg-[var(--vana-green)] px-5 py-3.5 font-semibold text-white transition hover:opacity-90"
>
  Review order
              </button>

              <p className="mt-4 text-xs leading-5 text-gray-500">
                This is a frontend prototype. No payment is collected, and
                delivery charges will be confirmed before fulfilment.
              </p>

              <Link
                to={routePaths.cart}
                className="mt-5 block text-center text-sm font-semibold text-[var(--vana-green)]"
              >
                ← Return to cart
              </Link>
            </aside>
          </form>
        ) : (
          <section className="mt-8 rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:p-8">
            <h2 className="text-2xl font-bold">Review your order</h2>
            <p className="mt-2 text-sm text-gray-600">
              Check your details and products before placing your demo order.
              No payment will be collected in this prototype.
            </p>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl bg-[#f3f6f3] p-5">
                <h3 className="font-bold">Customer details</h3>
                <p className="mt-3">{customer.fullName}</p>
                <p className="mt-1">{customer.phone}</p>
                {customer.email && <p className="mt-1">{customer.email}</p>}
              </div>

              <div className="rounded-xl bg-[#f3f6f3] p-5">
                <h3 className="font-bold">Delivery details</h3>
                <p className="mt-3">
                  {customer.deliveryMethod === 'delivery'
                    ? 'Delivery'
                    : 'Collection'}
                </p>
                {customer.deliveryMethod === 'delivery' && (
                  <>
                    <p className="mt-1">{customer.district}</p>
                    <p className="mt-1">{customer.address}</p>
                    {customer.instructions && (
                      <p className="mt-1">{customer.instructions}</p>
                    )}
                  </>
                )}
                <p className="mt-3">
                  Payment:{' '}
                  {customer.paymentMethod === 'mobile-money'
                    ? 'Mobile Money'
                    : customer.paymentMethod === 'cash-on-delivery'
                      ? 'Cash on delivery'
                      : 'Bank transfer / card'}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[#e1e7e2] p-4 sm:p-5">
              {items.map(({ product, quantity, lineTotal }) => (
                <div
                  key={product.id}
                  className="flex justify-between gap-4 border-b border-[#e1e7e2] py-4 last:border-0"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Quantity: {quantity}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium">
                    {formatPrice(lineTotal)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl bg-[#f3f6f3] p-5">
              <div className="flex justify-between gap-4 text-sm">
                <span>Items ({itemCount})</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="mt-3 flex justify-between gap-4 text-sm">
                <span>Delivery</span>
                <span className="text-gray-500">To be confirmed</span>
              </div>
              <div className="mt-4 flex justify-between gap-4 border-t border-[#d7e1d9] pt-4 font-bold">
                <span>Subtotal before delivery</span>
                <span className="text-lg text-[var(--vana-green)]">
                  {formatPrice(subtotal)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setReviewingOrder(false)}
                className="rounded-full border border-[#d7e1d9] px-6 py-3 font-medium"
              >
                Edit details
              </button>

              <button
                type="button"
                onClick={handlePlaceDemoOrder}
                className="rounded-full bg-[var(--vana-green)] px-6 py-3 font-semibold text-white transition hover:opacity-90"
              >
                Place demo order
              </button>
            </div>

            <p className="mt-4 text-xs leading-5 text-gray-500">
              Demo only: this creates a temporary order reference for the
              prototype. It does not submit an order to the business or collect
              payment.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
