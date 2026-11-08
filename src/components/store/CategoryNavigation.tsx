import { NavLink } from 'react-router-dom'
import { routePaths } from '../../lib/routePaths'
import { useCategories } from '../../context/CategoryContext'

export function CategoryNavigation() {
  // Active categories come from the database, so new ones appear automatically.
  const { categories, loading } = useCategories()

  return (
    <nav
      aria-label="Shop categories"
      className="border-b border-[var(--vana-border)] bg-white"
    >
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        
        <NavLink
          to={routePaths.products}
          className={({ isActive }) =>
            `flex h-11 shrink-0 items-center justify-center rounded-full px-5 text-xs font-semibold transition-all duration-200 sm:text-sm ${
              isActive
                ? 'bg-[var(--vana-green)] text-white'
                : 'border border-transparent text-[var(--vana-text)] hover:border-[var(--vana-green)] hover:text-[var(--vana-green)]'
            }`
          }
        >
          Shop all categories
        </NavLink>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-3">
          {loading &&
            Array.from({ length: 4 }).map((_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className="h-8 w-28 shrink-0 animate-pulse rounded-full bg-[#eef2ef]"
              />
            ))}

          {categories.filter((category) => !category.parentId).map(({ name: label, slug }) => (
            <NavLink
              key={slug}
              to={`/categories/${slug}`}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--vana-green)] text-white'
                    : 'border border-transparent text-[#36483c] hover:border-[var(--vana-green)] hover:text-[var(--vana-green)]'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        <NavLink
          to={routePaths.products}
          className={({ isActive }) =>
            `hidden shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200 sm:block ${
              isActive
                ? 'bg-[var(--vana-green)] text-white'
                : 'text-[var(--vana-green)] hover:border hover:border-[var(--vana-green)]'
            }`
          }
        >
          Deals
        </NavLink>
      </div>
    </nav>
  )
}