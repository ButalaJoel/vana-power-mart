
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { products } from '../data/products'
import { usePageTitle } from '../hooks/usePageTitle'
import { useCart } from '../context/CartContext'

export function ProductDetailsPage() {
  const { productId } = useParams()
  const { addItem } = useCart()

  const product = products.find((item) => item.id === productId)

  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [addedToCart, setAddedToCart] = useState(false)

  usePageTitle(product?.name ?? 'Product not found')

  if (!product) {
    return (
      <main className="min-h-[50vh] bg-[#f5f6f5] px-4 py-12">
        <div className="mx-auto max-w-7xl rounded-xl bg-white p-8">
          <h1 className="text-2xl font-bold text-[#10231b]">
            Product not found
          </h1>

          <p className="mt-2 text-gray-600">
            This product may have been removed or the link is incorrect.
          </p>

          <Link
            to="/products"
            className="mt-5 inline-block text-[var(--vana-green)] hover:underline"
          >
            Browse all products
          </Link>
        </div>
      </main>
    )
  }

  const formatPrice = (price: number) =>
    `UGX ${price.toLocaleString('en-UG')}`

  const specifications = product.specifications ?? {}
  const images = product.images ?? []

  const handleAddToCart = () => {
    addItem(product.id, quantity)
    setAddedToCart(true)
  }

  return (
    <main className="min-h-screen bg-[#f5f6f5] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-5 flex flex-wrap items-center gap-2 text-sm text-[#718078]"
        >
          <Link to="/" className="hover:text-[var(--vana-green)]">
            Home
          </Link>

          <span>/</span>

          <Link
            to="/products"
            className="hover:text-[var(--vana-green)]"
          >
            Products
          </Link>

          <span>/</span>

          <Link
            to={`/products?category=${product.category}`}
            className="hover:text-[var(--vana-green)]"
          >
            {product.category.replaceAll('-', ' ')}
          </Link>

          <span>/</span>

          <span className="font-medium text-[#10231b]">
            {product.name}
          </span>
        </nav>

        {/* Product overview */}
        <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          {/* Gallery and product information */}
          <div className="grid items-start gap-6 rounded-xl border border-[#e1e7e2] bg-white p-4 sm:p-6 lg:grid-cols-2">
            {/* Image gallery */}
            <div className="min-w-0">
              <div className="flex h-[300px] items-center justify-center rounded-xl bg-[#f4f7f5] p-5 sm:h-[380px]">
                {images.length > 0 ? (
                  <img
                    src={images[activeImage] ?? images[0]}
                    alt={product.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <p className="text-sm text-gray-500">
                    Product image unavailable
                  </p>
                )}
              </div>

              {images.length > 1 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {images.map((image, index) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      aria-label={`View product image ${index + 1}`}
                      aria-pressed={activeImage === index}
                      className={`flex h-16 w-16 items-center justify-center rounded-lg border-2 p-1 transition-colors ${
                        activeImage === index
                          ? 'border-[var(--vana-green)]'
                          : 'border-[#e1e7e2] hover:border-[var(--vana-green)]'
                      }`}
                    >
                      <img
                        src={image}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product information */}
            <div className="flex min-w-0 flex-col">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--vana-green)]">
                {product.brand ?? 'Vana Power Mart'}
              </p>

              <h1 className="mt-2 text-2xl font-bold leading-tight text-[#10231b] sm:text-3xl">
                {product.name}
              </h1>

              {product.model && (
                <p className="mt-3 text-sm text-gray-500">
                  Model: {product.model}
                </p>
              )}

              {product.rating !== undefined && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="text-amber-500">
                    {'★'.repeat(Math.round(product.rating))}
                  </span>

                  <span className="text-gray-500">
                    {product.rating}/5
                    {product.reviewCount !== undefined &&
                      ` (${product.reviewCount} reviews)`}
                  </span>
                </div>
              )}

              <div className="my-5 border-y border-[#e8ece9] py-5">
                {product.price !== undefined ? (
                  <p className="text-3xl font-bold text-[var(--vana-green)]">
                    {formatPrice(product.price)}
                  </p>
                ) : (
                  <p className="font-semibold text-gray-600">
                    Contact us for the current price
                  </p>
                )}

                {product.shortDescription && (
                  <p className="mt-4 text-sm leading-6 text-gray-600">
                    {product.shortDescription}
                  </p>
                )}
              </div>

              {product.model && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-[#10231b]">
                    Product code:
                  </span>{' '}
                  {product.model}
                </p>
              )}

              {/* Quantity selector */}
              <div className="mt-6">
                <label className="mb-2 block text-sm font-semibold text-[#10231b]">
                  Quantity
                </label>

                <div className="flex items-center gap-0">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1}
                    onClick={() => {
                      setQuantity((current) => Math.max(1, current - 1))
                      setAddedToCart(false)
                    }}
                    className="h-11 w-12 rounded-l-lg border border-[#dce5df] text-lg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    −
                  </button>

                  <span
                    aria-live="polite"
                    className="flex h-11 w-14 items-center justify-center border-y border-[#dce5df] font-semibold"
                  >
                    {quantity}
                  </span>

                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => {
                      setQuantity((current) => current + 1)
                      setAddedToCart(false)
                    }}
                    className="h-11 w-12 rounded-r-lg border border-[#dce5df] text-lg hover:bg-[#f4f7f5]"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={product.price === undefined}
                className="mt-5 w-full rounded-full bg-[var(--vana-green)] px-6 py-3.5 font-semibold text-white transition-colors hover:bg-[var(--vana-green-dark)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addedToCart ? 'Add to cart again' : 'Add to cart'}
              </button>

              {addedToCart && (
                <div
                  role="status"
                  className="mt-3 rounded-lg bg-[#eaf3ed] p-3 text-sm text-[#205c3b]"
                >
                  <p className="font-semibold">
                    Added to your cart successfully.
                  </p>

                  <p className="mt-1">
                    {quantity} × {product.name}
                  </p>

                  <Link
                    to="/cart"
                    className="mt-2 inline-block font-semibold underline"
                  >
                    View cart
                  </Link>
                </div>
              )}

              <p className="mt-3 text-xs leading-5 text-gray-500">
                Delivery arrangements and final charges will be confirmed
                during checkout.
              </p>
            </div>
          </div>

          {/* Delivery panel */}
          <aside className="rounded-xl border border-[#e1e7e2] bg-white p-5">
            <h2 className="border-b border-[#e8ece9] pb-3 font-bold text-[#10231b]">
              Delivery &amp; collection
            </h2>

            <div className="space-y-4 pt-4 text-sm">
              <div>
                <h3 className="font-semibold text-[#10231b]">
                  Delivery options
                </h3>

                <p className="mt-1 leading-6 text-gray-600">
                  Delivery availability and charges depend on your location.
                </p>
              </div>

              <div className="border-t border-[#e8ece9] pt-4">
                <h3 className="font-semibold text-[#10231b]">
                  Need assistance?
                </h3>

                <p className="mt-1 leading-6 text-gray-600">
                  Contact Vana Power Mart to confirm product availability
                  and delivery arrangements.
                </p>
              </div>

              <Link
                to="/contact"
                className="inline-flex w-full items-center justify-center rounded-full border border-[var(--vana-green)] px-4 py-3 font-medium text-[var(--vana-green)] hover:bg-[#f0f6f2]"
              >
                Contact us
              </Link>
            </div>
          </aside>
        </section>

        {/* Information sections */}
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="space-y-5">
            <section
              id="product-details"
              className="scroll-mt-28 rounded-xl border border-[#e1e7e2] bg-white p-5 sm:p-7"
            >
              <h2 className="text-xl font-bold text-[#10231b]">
                Product details
              </h2>

              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-600">
                {product.description ??
                  product.shortDescription ??
                  'Product information will be added soon.'}
              </p>
            </section>

            <section
              id="specifications"
              className="scroll-mt-28 rounded-xl border border-[#e1e7e2] bg-white p-5 sm:p-7"
            >
              <h2 className="text-xl font-bold text-[#10231b]">
                Specifications
              </h2>

              {Object.keys(specifications).length > 0 ? (
                <dl className="mt-4 divide-y divide-[#e8ece9]">
                  {Object.entries(specifications).map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-2 gap-4 py-3 text-sm"
                    >
                      <dt className="font-medium text-[#10231b]">
                        {label}
                      </dt>

                      <dd className="text-gray-600">
                        {String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  Detailed specifications will be added as they are verified.
                </p>
              )}
            </section>

            <section
              id="customer-feedback"
              className="scroll-mt-28 rounded-xl border border-[#e1e7e2] bg-white p-5 sm:p-7"
            >
              <h2 className="text-xl font-bold text-[#10231b]">
                Customer feedback
              </h2>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                Customer reviews will appear here as verified purchases
                and feedback become available.
              </p>
            </section>
          </div>

          {/* Page section navigation */}
          <aside className="sticky top-24 hidden overflow-hidden rounded-xl border border-[#e1e7e2] bg-white lg:block">
            <h2 className="bg-[#eaf3ed] p-4 font-semibold text-[#10231b]">
              On this page
            </h2>

            <a
              href="#product-details"
              className="block border-t border-[#e8ece9] px-4 py-3 text-sm hover:bg-gray-50"
            >
              Product details
            </a>

            <a
              href="#specifications"
              className="block border-t border-[#e8ece9] px-4 py-3 text-sm hover:bg-gray-50"
            >
              Specifications
            </a>

            <a
              href="#customer-feedback"
              className="block border-t border-[#e8ece9] px-4 py-3 text-sm hover:bg-gray-50"
            >
              Customer feedback
            </a>
          </aside>
        </div>
      </div>
    </main>
  )
}
