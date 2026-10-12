import { Link } from 'react-router-dom'
import { storeCategories } from '../../data/categories'

export function CategorySection() {
  return (
    <section className="bg-white px-4 py-12 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--vana-green)]">
              Shop by category
            </p>

            <h2 className="mt-2 text-2xl font-bold text-[var(--vana-text)] sm:text-3xl">
              Find what you need
            </h2>
          </div>

          <Link
            to="/products"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[var(--vana-green)] transition-colors hover:bg-[var(--vana-green)] hover:text-white sm:inline-flex"
          >
            View all
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {storeCategories.map((category) => (
            <Link
              key={category.id}
              to={`/categories/${category.slug}`}
              className="group overflow-hidden rounded-2xl border border-[var(--vana-border)] bg-white transition-all duration-200 hover:-translate-y-1 hover:border-[var(--vana-green)] hover:shadow-md"
            >
              <div className="aspect-square overflow-hidden bg-[#f4f7f5]">
                <img
                  src={category.image}
                  alt={category.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              <div className="px-4 py-4">
                <h3 className="text-sm font-semibold text-[var(--vana-text)]">
                  {category.name}
                </h3>

                <span className="mt-1 block text-xs text-[var(--vana-muted)]">
                  Shop now
                </span>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </section>
  )
}