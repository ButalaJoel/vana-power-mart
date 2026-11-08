
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  Users,
  ChartNoAxesCombined,
  Settings,
  Search,
  Menu,
  X,
  Tags,
  LogOut,
  Factory,
  BadgePercent,
  Undo2,
} from 'lucide-react'
import {
  ADMIN_LOGOUT_EVENT,
  apiRequest,
  getAdminToken,
  setAdminToken,
} from '../lib/api'
import { AdminLoginPage, type AdminProfile } from '../pages/admin/AdminLoginPage'

// Keep all sidebar links in one place so desktop and mobile stay consistent.
const navigation = [
  { label: 'Overview', path: '/admin', icon: LayoutDashboard },
  { label: 'Orders', path: '/admin/orders', icon: ShoppingCart },
  { label: 'Products', path: '/admin/products', icon: Package },
  { label: 'Categories', path: '/admin/categories', icon: Tags },
  { label: 'Inventory', path: '/admin/inventory', icon: Boxes },
  { label: 'Suppliers', path: '/admin/suppliers', icon: Factory },
  { label: 'Delivery', path: '/admin/delivery', icon: Truck },
  { label: 'Promotions', path: '/admin/promotions', icon: BadgePercent },
  { label: 'Customers', path: '/admin/customers', icon: Users },
  { label: 'Returns', path: '/admin/returns', icon: Undo2 },
  { label: 'Reports', path: '/admin/reports', icon: ChartNoAxesCombined },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
]

export function AdminLayout() {
  // Track whether the mobile sidebar is open and what the user searches for.
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const location = useLocation()
  const navigate = useNavigate()

  // Admin session: verified with /api/auth/me whenever a token is present.
  const [admin, setAdmin] = useState<AdminProfile | null>(null)
  const [checkingSession, setCheckingSession] = useState(() => Boolean(getAdminToken()))
  const [sessionNotice, setSessionNotice] = useState('')

  useEffect(() => {
    if (!getAdminToken()) return

    apiRequest<{ admin: AdminProfile }>('/api/auth/me', { auth: true })
      .then((result) => setAdmin(result.admin))
      .catch(() => setAdmin(null))
      .finally(() => setCheckingSession(false))
  }, [])

  // Any request that finds the session expired logs the admin out.
  useEffect(() => {
    function handleLogout() {
      setAdmin((current) => {
        if (current) setSessionNotice('Your session has ended. Please sign in again.')
        return null
      })
    }

    window.addEventListener(ADMIN_LOGOUT_EVENT, handleLogout)
    return () => window.removeEventListener(ADMIN_LOGOUT_EVENT, handleLogout)
  }, [])

  function logout() {
    setSessionNotice('')
    setAdminToken(null)
    setAdmin(null)
  }

  // Close the mobile sidebar when the user selects a page.
  function closeMenu() {
    setMenuOpen(false)
  }

  // Shared navigation styling: active links are white pills; hover adds a white outline.
  function getNavigationClass(isActive: boolean) {
    return `flex items-center gap-3 rounded-full border px-4 py-3 text-sm transition-colors duration-200 ${
      isActive
        ? 'border-white bg-white font-semibold text-[#064E32]'
        : 'border-transparent text-white/90 hover:border-white hover:bg-transparent hover:text-white'
    }`
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8F6] text-sm text-[#64756A]">
        Checking your session…
      </div>
    )
  }

  if (!admin) {
    return (
      <AdminLoginPage
        notice={sessionNotice}
        onLogin={(profile) => {
          setSessionNotice('')
          setAdmin(profile)
        }}
      />
    )
  }

  const initial = admin.name.charAt(0).toUpperCase() || 'A'

  return (
    <div className="min-h-screen bg-[#F5F8F6] text-[#17241C]">
      <div className="flex min-h-screen">

        {/* Desktop sidebar: always visible on large screens. */}
        <aside className="hidden w-[250px] shrink-0 flex-col bg-[#064E32] text-white lg:flex">
          <div className="border-b border-white/15 px-6 py-6">
            <h1 className="text-xl font-bold tracking-tight">
              Vana Power Mart
            </h1>
            <p className="mt-1 text-sm text-white/70">Administration</p>
          </div>

          <nav
            aria-label="Admin navigation"
            className="flex-1 space-y-2 px-3 py-5"
          >
            {navigation.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  className={({ isActive }) => getNavigationClass(isActive)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* Admin profile at the bottom of the desktop sidebar. */}
          <div className="border-t border-white/15 p-4">
            <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-[#064E32]">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{admin.name}</p>
                <p className="truncate text-xs text-white/70">{admin.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-3 flex w-full items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm text-white/90 transition hover:border-white hover:text-white"
            >
              <LogOut size={16} aria-hidden="true" />
              Log out
            </button>
            <p className="mt-3 px-2 text-xs text-white/60">
              Vana Power Mart · Admin
            </p>
          </div>
        </aside>

        {/* Dark backdrop closes the mobile menu when tapped. */}
        {menuOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={closeMenu}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
        )}

        {/* Mobile sidebar: slides in when the hamburger button is pressed. */}
        <aside
          id="admin-mobile-menu"
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(290px,85vw)] flex-col bg-[#064E32] text-white shadow-2xl transition-transform duration-200 lg:hidden ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-label="Mobile admin navigation"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
        >
          <div className="flex items-start justify-between border-b border-white/15 px-5 py-5">
            <div>
              <h2 className="text-lg font-bold">Vana Power Mart</h2>
              <p className="mt-1 text-sm text-white/70">Administration</p>
            </div>

            <button
              type="button"
              onClick={closeMenu}
              aria-label="Close navigation"
              className="rounded-full p-2 transition hover:bg-white/15"
            >
              <X size={20} />
            </button>
          </div>

          <nav
            aria-label="Mobile admin navigation"
            className="flex-1 space-y-2 overflow-y-auto px-3 py-5"
          >
            {navigation.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  onClick={closeMenu}
                  className={({ isActive }) => getNavigationClass(isActive)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* Keep the mobile profile consistent with desktop. */}
          <div className="border-t border-white/15 p-4">
            <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-bold text-[#064E32]">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{admin.name}</p>
                <p className="truncate text-xs text-white/70">{admin.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-3 flex w-full items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm text-white/90 transition hover:border-white hover:text-white"
            >
              <LogOut size={16} aria-hidden="true" />
              Log out
            </button>
          </div>
        </aside>

        {/* Main dashboard workspace. */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-[#D9E5DD] bg-white/95 backdrop-blur">
            <div className="flex min-h-[72px] items-center gap-3 px-3 py-3 sm:px-5 lg:px-8">

              {/* Hamburger appears on phones and tablets. */}
              <button
                type="button"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-controls="admin-mobile-menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D9E5DD] text-[#064E32] transition hover:bg-[#EAF2EC] lg:hidden"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              {/* Search bar follows the public storefront's pill-shaped design. */}
              <form
                role="search"
                onSubmit={(event) => {
                  event.preventDefault()

                  const query = searchQuery.trim()

                  // The header search looks up orders (number, name, phone, email).
                  navigate(
                    query
                      ? `/admin/orders?search=${encodeURIComponent(query)}`
                      : '/admin/orders',
                  )
                }}
                className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#064E32] bg-white px-3 shadow-sm transition focus-within:ring-2 focus-within:ring-[#064E32]/15 sm:px-4 lg:max-w-2xl"
              >
                <Search
                  size={19}
                  aria-hidden="true"
                  className="shrink-0 text-[#064E32]"
                />

                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search orders by number, name or phone..."
                  aria-label="Search the admin workspace"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#17241C] outline-none placeholder:text-[#829087]"
                />

                <button
                  type="submit"
                  aria-label="Submit search"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#064E32] text-white transition hover:bg-[#0B6843]"
                >
                  <Search size={16} />
                </button>
              </form>

              <button
                type="button"
                onClick={logout}
                className="hidden items-center gap-2 rounded-full border border-[#D9E5DD] p-1.5 pr-3 transition hover:bg-[#F5F8F6] sm:flex"
                title={`Signed in as ${admin.email}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF2EC] text-sm font-semibold text-[#064E32]">
                  {initial}
                </span>
                <span className="text-sm font-medium">Log out</span>
              </button>
            </div>

            {/* Breadcrumb updates to reflect the current admin section. */}
            <div className="px-4 pb-3 sm:px-5 lg:px-8">
              <p className="truncate text-xs text-[#64756A]">
                Vana Power Mart / Management
                {location.pathname !== '/admin' &&
                  ` / ${
                    navigation.find((item) =>
                      location.pathname.startsWith(item.path) && item.path !== '/admin',
                    )?.label ?? 'Section'
                  }`}
              </p>
            </div>
          </header>

          {/* Reduce padding on phones so cards have more usable space. */}
          <main className="p-3 sm:p-5 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
