import { Heart, ShoppingCart, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

// Import the shared cart so the header always displays the real item count.
import { useCart } from '../../context/CartContext'
import { routePaths } from '../../lib/routePaths'

// Define the structure of each navigation action.
type AccountAction = {
  icon: LucideIcon
  eyebrow: string
  label: string
  to: string
}

// Keep the account and wishlist links centralised.
// The cart label is generated dynamically inside the component.
const accountActions: AccountAction[] = [
  {
    icon: UserRound,
    eyebrow: 'Hello, sign in',
    label: 'My account',
    to: routePaths.account,
  },
  {
    icon: Heart,
    eyebrow: 'Saved items',
    label: 'Wishlist',
    to: routePaths.wishlist,
  },
]

export function AccountActions() {
  // Read the number of individual products in the shared cart.
  const { itemCount } = useCart()

  return (
    <div className="flex items-center justify-end gap-3 sm:gap-5 xl:gap-7">
      {/* Render the account and wishlist navigation links. */}
      {accountActions.map(({ icon: Icon, eyebrow, label, to }) => (
        <Link
          aria-label={`${eyebrow}, ${label}`}
          className="flex min-w-0 items-center gap-2 text-[var(--vana-text)]"
          key={to}
          to={to}
        >
          <Icon
            aria-hidden="true"
            className="shrink-0"
            size={21}
            strokeWidth={1.7}
          />

          <span className="hidden whitespace-nowrap leading-tight sm:block">
            <span className="block text-[11px] text-[var(--vana-muted)]">
              {eyebrow}
            </span>
            <span className="mt-1 block text-xs font-semibold">
              {label}
            </span>
          </span>
        </Link>
      ))}

      {/* Display the live cart count instead of a hardcoded zero. */}
      <Link
        aria-label={`Your cart, ${itemCount} items`}
        className="flex min-w-0 items-center gap-2 text-[var(--vana-text)]"
        to={routePaths.cart}
      >
        <ShoppingCart
          aria-hidden="true"
          className="shrink-0"
          size={21}
          strokeWidth={1.7}
        />

        <span className="hidden whitespace-nowrap leading-tight sm:block">
          <span className="block text-[11px] text-[var(--vana-muted)]">
            Your cart
          </span>
          <span className="mt-1 block text-xs font-semibold">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </span>
      </Link>
    </div>
  )
}