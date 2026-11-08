
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { routePaths } from '../lib/routePaths'

export function CartPage() {
  const {
    items,
    itemCount,
    subtotal,
    updateQuantity,
    removeItem,
    loading,
  } = useCart()

  usePageTitle('Shopping Cart')

  const formatPrice = (price: number) =>
    `UGX ${price.toLocaleString('en-UG')}`

  return (
    <main className="min-h-[55vh] bg-[#f5f6f5] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-7">
          <nav aria-label="Breadcrumb" className="mb-3 text-sm text-gray-500">
            <Link to="/" className="hover:text-[var(--vana-green)]">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="font-medium text-[#10231b]">Shopping cart</span>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-[#10231b]">
                Your shopping cart
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Review your items before proceeding to checkout.
              </p>
            </div>

            {items.length > 0 && (
              <Link
                to={routePaths.products}
                className="text-sm font-semibold text-[var(--vana-green)] hover:underline"
              >
                Continue shopping
              </Link>
            )}
          </div>
        </div>

        {loading && items.length === 0 ? (
          <p className="rounded-2xl border border-[#e1e7e2] bg-white px-5 py-16 text-center text-sm text-gray-500">
            Loading your cart…
          </p>
        ) : items.length === 0 ? (
          <section className="rounded-2xl border border-[#e1e7e2] bg-white px-5 py-16 text-center sm:px-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#eaf3ed] text-[var(--vana-green)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-10 w-10"
                aria-hidden="true"
              >
                <path d="M3 3h2l2.4 11.5a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6" />
                <circle cx="10" cy="20" r="1" />
                <circle cx="18" cy="20" r="1" />
              </svg>
            </div>

            <h2 className="mt-5 text-xl font-bold text-[#10231b]">
              Your cart is empty
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
              You haven't added any products yet. Explore our catalogue
              and find something for your home or business.
            </p>

            <Link
              to={routePaths.products}
              className="mt-6 inline-flex rounded-full bg-[var(--vana-green)] px-7 py-3 font-semibold text-white hover:bg-[var(--vana-green-dark)]"
            >
              Start shopping
            </Link>
          </section>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="overflow-hidden rounded-2xl border border-[#e1e7e2] bg-white">
              <div className="flex items-center justify-between border-b border-[#e8ece9] px-5 py-4 sm:px-6">
                <h2 className="font-bold text-[#10231b]">Cart items</h2>
                <span className="text-sm text-gray-500">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="divide-y divide-[#e8ece9]">
                {items.map(({ product, quantity, lineTotal }) => (
                  <article
                    key={product.id}
                    className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6"
                  >
                    <Link
                      to={`/products/${product.slug}`}
                      className="flex h-32 w-full shrink-0 items-center justify-center rounded-xl bg-[#f4f7f5] p-3 sm:w-36"
                    >
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-gray-500">
                          Image unavailable
                        </span>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--vana-green)]">
                        {product.brand ?? 'Vana Power Mart'}
                      </p>

                      <Link
                        to={`/products/${product.slug}`}
                        className="mt-1 block font-bold leading-6 text-[#10231b] hover:text-[var(--vana-green)]"
                      >
                        {product.name}
                      </Link>

                      {product.model && (
                        <p className="mt-1 text-xs text-gray-500">
                          Model: {product.model}
                        </p>
                      )}

                      <p className="mt-2 text-sm text-gray-600">
                        Unit price:{' '}
                        {product.price > 0
                          ? formatPrice(product.price)
                          : 'Price unavailable'}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="inline-flex items-center rounded-lg border border-[#dce5df]">
                          <button
                            type="button"
                            aria-label={`Decrease ${product.name} quantity`}
                            onClick={() =>
                              updateQuantity(product.id, quantity - 1)
                            }
                            className="h-9 w-10 rounded-l-lg text-lg hover:bg-[#f4f7f5]"
                          >
                            −
                          </button>

                          <span className="flex h-9 min-w-10 items-center justify-center border-x border-[#dce5df] px-2 text-sm font-semibold">
                            {quantity}
                          </span>

                          <button
                            type="button"
                            aria-label={`Increase ${product.name} quantity`}
                            onClick={() =>
                              updateQuantity(product.id, quantity + 1)
                            }
                            className="h-9 w-10 rounded-r-lg text-lg hover:bg-[#f4f7f5]"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(product.id)}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="shrink-0 sm:min-w-36 sm:text-right">
                      <p className="text-xs text-gray-500 sm:hidden">
                        Item total
                      </p>
                      <p className="mt-1 font-bold text-[var(--vana-green)]">
                        {formatPrice(lineTotal)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="border-t border-[#e8ece9] px-5 py-4 sm:px-6">
                <Link
                  to={routePaths.products}
                  className="text-sm font-semibold text-[var(--vana-green)] hover:underline"
                >
                  ← Continue shopping
                </Link>
              </div>
            </section>

            <aside className="rounded-2xl border border-[#e1e7e2] bg-white p-5 sm:p-6 lg:sticky lg:top-24">
              <h2 className="text-xl font-bold text-[#10231b]">
                Order summary
              </h2>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-600">
                    Subtotal ({itemCount} items)
                  </span>
                  <span className="font-semibold text-[#10231b]">
                    {formatPrice(subtotal)}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-600">Delivery</span>
                  <span className="text-right text-gray-500">
                    Confirmed after you order
                  </span>
                </div>

                <div className="border-t border-[#e8ece9] pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold text-[#10231b]">
                      Subtotal before delivery
                    </span>
                    <span className="text-lg font-bold text-[var(--vana-green)]">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                </div>
              </div>

              <Link
                to={routePaths.checkout}
                className="mt-6 flex w-full items-center justify-center rounded-full bg-[var(--vana-green)] px-5 py-3.5 text-center font-semibold text-white hover:bg-[var(--vana-green-dark)]"
              >
                Proceed to checkout
              </Link>

              <p className="mt-4 text-xs leading-5 text-gray-500">
                Delivery charges and the final payable amount will be
                confirmed during checkout.
              </p>

              <div className="mt-5 rounded-xl bg-[#f4f7f5] p-4">
                <p className="font-semibold text-[#10231b]">
                  Shopping with confidence
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-600">
                  Contact Vana Power Mart if you need help with product
                  availability or delivery arrangements.
                </p>
                <Link
                  to="/contact"
                  className="mt-3 inline-block text-sm font-semibold text-[var(--vana-green)] hover:underline"
                >
                  Contact customer care
                </Link>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}

