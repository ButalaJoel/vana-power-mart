import { Link } from 'react-router-dom'
import { useCategories } from '../../context/CategoryContext'
import { useProducts } from '../../context/ProductContext'

export function CategorySection() {
  const { categories, loading } = useCategories()
  const { products } = useProducts()

  // Use the category image; otherwise the first product image in that category.
  function imageFor(categoryId: string, imageUrl: string | null) {
    if (imageUrl) return imageUrl
    return products.find(
      (product) => product.categoryId === categoryId && product.images[0],
    )?.images[0]
  }

  if (!loading && categories.length === 0) return null

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
          {loading &&
            Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                aria-hidden="true"
                className="aspect-[4/5] animate-pulse rounded-2xl bg-[#f0f3f1]"
              />
            ))}

          {categories.filter((category) => !category.parentId).map((category) => {
            const image = imageFor(category.id, category.imageUrl)

            return (
            <Link
              key={category.id}
              to={`/categories/${category.slug}`}
              className="group overflow-hidden rounded-2xl border border-[var(--vana-border)] bg-white transition-all duration-200 hover:-translate-y-1 hover:border-[var(--vana-green)] hover:shadow-md"
            >
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-[#f4f7f5]">
                {image ? (
                  <img
                    src={image}
                    alt={category.name}
                    loading="lazy"
                    className={`h-full w-full transition-transform duration-300 group-hover:scale-105 ${
                      category.imageUrl ? 'object-cover' : 'object-contain p-4'
                    }`}
                  />
                ) : (
                  <span className="px-3 text-center text-2xl font-bold text-[var(--vana-green)]/40">
                    {category.name.charAt(0)}
                  </span>
                )}
              </div>

              <div className="px-4 py-4">
                <h3 className="text-sm font-semibold text-[var(--vana-text)]">
                  {category.name}
                </h3>

                <span className="mt-1 block text-xs text-[var(--vana-muted)]">
                  {category.activeProductCount > 0
                    ? `${category.activeProductCount} product${category.activeProductCount === 1 ? '' : 's'}`
                    : 'Coming soon'}
                </span>
              </div>
            </Link>
            )
          })}
        </div>

      </div>
    </section>
  )
}