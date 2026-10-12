import { Link } from 'react-router-dom'
import { routePaths } from '../../lib/routePaths'

const shopLinks = [
  { label: 'Home Appliances', to: '/categories/home-appliances' },
  { label: 'Phones & Electronics', to: '/categories/phones-electronics' },
  { label: 'Furniture & Home', to: '/categories/furniture-home' },
  { label: 'Beddings', to: '/categories/beddings' },
  { label: 'Bags & Accessories', to: '/categories/bags-accessories' },
]

const customerLinks = [
  { label: 'My account', to: routePaths.account },
  { label: 'My orders', to: routePaths.accountOrders },
  { label: 'Wishlist', to: routePaths.wishlist },
  { label: 'Contact us', to: routePaths.contact },
]

export function StoreFooter() {
  return (
    <footer className="mt-16 bg-[var(--vana-green-dark)] text-white">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-12 sm:px-8 lg:px-10 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          
          <div className="lg:col-span-1">
            <Link
              to={routePaths.home}
              className="text-xl font-semibold tracking-tight"
            >
              Vana Power Mart
            </Link>

            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
              Quality appliances, electronics, furniture and everyday essentials
              for homes and businesses across Uganda.
            </p>

            <p className="mt-5 text-sm font-medium text-white/90">
              Kampala, Uganda
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold">
              Shop
            </h2>

            <ul className="mt-4 space-y-3">
              {shopLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold">
              Customer care
            </h2>

            <ul className="mt-4 space-y-3">
              {customerLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold">
              Need help?
            </h2>

            <div className="mt-4 space-y-3 text-sm text-white/70">
              <p>+256 700 123 456</p>
              <p>Mon – Sat: 8:00 AM – 6:00 PM</p>
              <p>Sunday: 10:00 AM – 4:00 PM</p>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6">
          <div className="flex flex-col gap-3 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} Vana Power Mart. All rights reserved.
            </p>

            <div className="flex gap-4">
              <Link
                to={routePaths.privacy}
                className="transition-colors hover:text-white"
              >
                Privacy Policy
              </Link>

              <Link
                to={routePaths.terms}
                className="transition-colors hover:text-white"
              >
                Terms & Conditions
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}