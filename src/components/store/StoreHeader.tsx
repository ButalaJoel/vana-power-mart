
import { Link } from 'react-router-dom'
import { AccountActions } from './AccountActions'
import { SearchBar } from './SearchBar'
import { routePaths } from '../../lib/routePaths'
import { useCart } from '../../context/CartContext'

export function StoreHeader() {
  const { itemCount } = useCart()

  return (
    <header className="border-b border-[var(--vana-border)] bg-white">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-4 px-4 py-4 sm:px-6 lg:grid-cols-[210px_minmax(280px,1fr)_auto] lg:gap-x-8 lg:px-10 lg:py-5">
        <Link
          aria-label="Vana Power Mart home"
          className="whitespace-nowrap text-[19px] font-extrabold leading-none text-[var(--vana-green)] sm:text-[21px]"
          to={routePaths.home}
        >
          Vana Power Mart
        </Link>

        <div className="col-span-2 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
          <SearchBar />
        </div>

        <div className="col-start-2 row-start-1 flex items-center justify-end gap-3 lg:col-start-3">
          <Link
            to={routePaths.cart}
            aria-label={`Shopping cart, ${itemCount} items`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--vana-border)] px-3 py-2 text-sm font-semibold text-[var(--vana-green)] transition-colors hover:bg-[#f0f6f2]"
          >
            <span>Cart</span>
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--vana-green)] px-1.5 text-xs font-bold text-white">
              {itemCount}
            </span>
          </Link>

          <AccountActions />
        </div>
      </div>
    </header>
  )
}
