
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '../../data/products'
import { useCart } from '../../context/CartContext'

interface ProductGridProps {
  products: Product[]
  title: string
}

export function ProductGrid({ products, title }: ProductGridProps) {
  const { addItem } = useCart()
  const [addedProductId, setAddedProductId] = useState<string | null>(null)

  function handleAddToCart(product: Product) {
    addItem(product.id, 1)
    setAddedProductId(product.id)

    window.setTimeout(() => {
      setAddedProductId((current) =>
        current === product.id ? null : current,
      )
    }, 1800)
  }

  return (
    <section className="px-4 py-12 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--vana-green)]">
              Featured
            </p>

            <h2 className="text-2xl font-bold text-[var(--vana-green)] sm:text-3xl">
              {title}
            </h2>
          </div>

          <Link
            to="/products"
            className="text-sm font-medium text-[var(--vana-green)] transition-colors hover:text-[var(--vana-green-dark)]"
          >
            View all
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {products.map((product) => {
            const justAdded = addedProductId === product.id

            return (
              <article
                key={product.id}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#dce5df] bg-white transition-all duration-200 hover:-translate-y-1 hover:border-[var(--vana-green)] hover:shadow-md"
              >
                <div className="flex h-56 items-center justify-center bg-[#f4f7f5] p-4">
                  <Link
                    to={`/products/${product.id}`}
                    className="flex h-full w-full items-center justify-center"
                  >
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-contain"
                    />
                  </Link>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <p className="mb-2 text-xs text-[#718078]">
                    {product.category}
                  </p>

                  <h3 className="line-clamp-2 min-h-[40px] text-sm font-medium leading-5 text-[#10231b]">
                    <Link
                      to={`/products/${product.id}`}
                      className="hover:text-[var(--vana-green)]"
                    >
                      {product.name}
                    </Link>
                  </h3>

                  {product.model && (
                    <p className="mt-4 text-xs text-[#718078]">
                      {product.model}
                    </p>
                  )}

                  <div className="mt-auto pt-5">
                    {product.price !== undefined && (
                      <p className="text-base font-bold text-[var(--vana-green)]">
                        UGX {product.price.toLocaleString()}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      className={`mt-4 w-full rounded-full border border-[var(--vana-green)] px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                        justAdded
                          ? 'bg-[var(--vana-green)] text-white'
                          : 'text-[var(--vana-green)] hover:bg-[var(--vana-green)] hover:text-white'
                      }`}
                    >
                      {justAdded ? 'Added to cart ✓' : 'Add to cart'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
