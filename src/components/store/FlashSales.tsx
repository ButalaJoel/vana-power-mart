import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useProducts } from '../../context/ProductContext'
import { useCart } from '../../context/CartContext'
import { formatUGX } from '../../lib/api'
import { SaleCountdown } from './SaleCountdown'

// Home page row of products with a running flash sale. Hidden when none.
export function FlashSales() {
  const { products } = useProducts()
  const { addItem } = useCart()
  const onSale = products
    .filter((product) => product.onSale)
    .sort((a, b) => Date.parse(a.saleEndsAt ?? '9999') - Date.parse(b.saleEndsAt ?? '9999'))
    .slice(0, 10)

  if (onSale.length === 0) return null
  const soonest = onSale.find((product) => product.saleEndsAt)?.saleEndsAt

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="overflow-hidden rounded-2xl border border-[#f2d7c6] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#c2410c] px-5 py-3 text-white">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Zap size={20} fill="currentColor" /> Flash sales
          </h2>
          {soonest && <SaleCountdown endsAt={soonest} className="text-sm font-semibold" />}
        </div>
        <ul className="flex snap-x gap-4 overflow-x-auto p-4 [scrollbar-width:thin]">
          {onSale.map((product) => {
            const off = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0
            return (
              <li key={product.id} className="w-44 shrink-0 snap-start sm:w-52">
                <Link to={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden rounded-xl bg-[#f6f7f6]">
                  {product.images[0] && <img src={product.images[0]} alt={product.name} loading="lazy" className="h-full w-full object-contain p-3" />}
                  {off > 0 && (
                    <span className="absolute left-2 top-2 rounded-md bg-[#c2410c] px-2 py-0.5 text-xs font-bold text-white">−{off}%</span>
                  )}
                </Link>
                <Link to={`/products/${product.slug}`} className="mt-2 line-clamp-2 text-sm font-medium hover:underline">
                  {product.name}
                </Link>
                <p className="mt-1 font-bold text-[#10231b]">{formatUGX(product.price)}</p>
                {product.oldPrice && <p className="text-xs text-gray-400 line-through">{formatUGX(product.oldPrice)}</p>}
                <button
                  type="button"
                  onClick={() => addItem(product.id, 1)}
                  className="mt-2 w-full rounded-full bg-[var(--vana-green)] py-2 text-xs font-semibold text-white"
                >
                  Add to cart
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
