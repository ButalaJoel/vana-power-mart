
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { products } from '../data/products'
import type { Product, ProductCategory } from '../data/products'
import { ProductGrid } from '../components/store/ProductGrid'
import { usePageTitle } from '../hooks/usePageTitle'

const categories: { label: string; slug: ProductCategory }[] = [
  { label: 'Refrigerators', slug: 'refrigerators' },
  { label: 'Freezers', slug: 'freezers' },
  { label: 'Washing Machines', slug: 'washing-machines' },
  { label: 'Water Heaters', slug: 'water-heaters' },
  { label: 'Kitchen Appliances', slug: 'kitchen-appliances' },
  { label: 'Furniture & Home', slug: 'furniture' },
]

const capacityCategories: ProductCategory[] = [
  'refrigerators',
  'freezers',
  'washing-machines',
]

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedCategory = searchParams.get('category') ?? 'all'

  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('featured')
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedCapacities, setSelectedCapacities] = useState<string[]>([])
  const [inStockOnly, setInStockOnly] = useState(false)

  usePageTitle('Products')

  const activeCategory = categories.find(
    (category) => category.slug === selectedCategory,
  )

  const categoryProducts = useMemo(() => {
    if (selectedCategory === 'all') return products

    return products.filter(
      (product) => product.category === selectedCategory,
    )
  }, [selectedCategory])

  const availableBrands = useMemo(
    () =>
      [...new Set(
        categoryProducts
          .map((product) => product.brand)
          .filter((brand): brand is string => Boolean(brand)),
      )].sort(),
    [categoryProducts],
  )

  const availableCapacities = useMemo(
    () =>
      [...new Set(
        categoryProducts
          .map((product) => product.capacity)
          .filter(
            (capacity): capacity is string | number =>
              capacity !== undefined && capacity !== '',
          )
          .map(String),
      )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [categoryProducts],
  )

  const filteredProducts = useMemo(() => {
    let result: Product[] = [...categoryProducts]

    if (minPrice !== '') {
      result = result.filter(
        (product) =>
          product.price !== undefined &&
          product.price >= Number(minPrice),
      )
    }

    if (maxPrice !== '') {
      result = result.filter(
        (product) =>
          product.price !== undefined &&
          product.price <= Number(maxPrice),
      )
    }

    if (selectedBrands.length > 0) {
      result = result.filter(
        (product) =>
          product.brand !== undefined &&
          selectedBrands.includes(product.brand),
      )
    }

    if (selectedCapacities.length > 0) {
      result = result.filter(
        (product) =>
          product.capacity !== undefined &&
          selectedCapacities.includes(String(product.capacity)),
      )
    }

    if (inStockOnly) {
      result = result.filter(
        (product) => product.stock !== undefined && product.stock > 0,
      )
    }

    if (sort === 'price-low') {
      result.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    } else if (sort === 'price-high') {
      result.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    } else if (sort === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      result.sort(
        (a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)),
      )
    }

    return result
  }, [
    categoryProducts,
    minPrice,
    maxPrice,
    selectedBrands,
    selectedCapacities,
    inStockOnly,
    sort,
  ])

  function chooseCategory(category: string) {
    setSearchParams(category === 'all' ? {} : { category })
    setSelectedBrands([])
    setSelectedCapacities([])
    setMinPrice('')
    setMaxPrice('')
    setInStockOnly(false)
  }

  function clearFilters() {
    setMinPrice('')
    setMaxPrice('')
    setSelectedBrands([])
    setSelectedCapacities([])
    setInStockOnly(false)
    setSort('featured')
  }

  function toggleValue(
    value: string,
    current: string[],
    update: (values: string[]) => void,
  ) {
    update(
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    )
  }

  const hasActiveFilters =
    minPrice !== '' ||
    maxPrice !== '' ||
    selectedBrands.length > 0 ||
    selectedCapacities.length > 0 ||
    inStockOnly

  const showCapacityFilter =
    selectedCategory !== 'all' &&
    capacityCategories.includes(selectedCategory as ProductCategory)

  return (
    <main className="min-h-screen bg-[#f5f6f5] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-5 text-sm text-[#718078]">
          <Link to="/" className="hover:text-[var(--vana-green)]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span>Products</span>

          {activeCategory && (
            <>
              <span className="mx-2">/</span>
              <span className="text-[#10231b]">
                {activeCategory.label}
              </span>
            </>
          )}
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-xl border border-[#e1e7e2] bg-white">
            <div className="border-b border-[#e8ece9] p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase">
                Categories
              </h2>

              <button
                onClick={() => chooseCategory('all')}
                className={`mb-2 block w-full rounded-lg px-2 py-2 text-left text-sm ${
                  selectedCategory === 'all'
                    ? 'bg-[#eaf3ed] font-semibold text-[var(--vana-green)]'
                    : 'hover:bg-gray-50'
                }`}
              >
                All Products
              </button>

              {categories.map((category) => (
                <button
                  key={category.slug}
                  onClick={() => chooseCategory(category.slug)}
                  className={`mb-1 block w-full rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                    selectedCategory === category.slug
                      ? 'bg-[#eaf3ed] font-semibold text-[var(--vana-green)]'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>

            <div className="border-b border-[#e8ece9] p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase">
                  Price (UGX)
                </h2>
                <button
                  onClick={() => {
                    setMinPrice('')
                    setMaxPrice('')
                  }}
                  className="text-xs font-medium text-[var(--vana-green)] hover:underline"
                >
                  Clear
                </button>
              </div>

              <label className="mb-1 block text-xs text-gray-500">
                Minimum price
              </label>
              <input
                type="number"
                min="0"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="e.g. 100000"
                className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[var(--vana-green)]"
              />

              <label className="mb-1 block text-xs text-gray-500">
                Maximum price
              </label>
              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="e.g. 1000000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[var(--vana-green)]"
              />
            </div>

            {selectedCategory !== 'all' && (
              <>
                <div className="border-b border-[#e8ece9] p-4">
                  <h2 className="mb-3 text-sm font-semibold uppercase">
                    Brand
                  </h2>

                  {availableBrands.length > 0 ? (
                    <div className="space-y-3">
                      {availableBrands.map((brand) => (
                        <label
                          key={brand}
                          className="flex cursor-pointer items-center gap-2 text-sm text-[#34443b]"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBrands.includes(brand)}
                            onChange={() =>
                              toggleValue(
                                brand,
                                selectedBrands,
                                setSelectedBrands,
                              )
                            }
                            className="h-4 w-4 accent-[var(--vana-green)]"
                          />
                          {brand}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs leading-5 text-gray-500">
                      Brand filters will appear when brand information is
                      added to these products.
                    </p>
                  )}
                </div>

                {showCapacityFilter && (
                  <div className="border-b border-[#e8ece9] p-4">
                    <h2 className="mb-3 text-sm font-semibold uppercase">
                      {selectedCategory === 'washing-machines'
                        ? 'Capacity'
                        : 'Capacity'}
                    </h2>

                    {availableCapacities.length > 0 ? (
                      <div className="space-y-3">
                        {availableCapacities.map((capacity) => (
                          <label
                            key={capacity}
                            className="flex cursor-pointer items-center gap-2 text-sm text-[#34443b]"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCapacities.includes(capacity)}
                              onChange={() =>
                                toggleValue(
                                  capacity,
                                  selectedCapacities,
                                  setSelectedCapacities,
                                )
                              }
                              className="h-4 w-4 accent-[var(--vana-green)]"
                            />
                            {capacity}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs leading-5 text-gray-500">
                        Capacity options will appear when product capacities
                        are recorded.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase">
                Availability
              </h2>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(event) => setInStockOnly(event.target.checked)}
                  className="h-4 w-4 accent-[var(--vana-green)]"
                />
                In-stock products only
              </label>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                Products without a recorded stock quantity will not appear
                when this filter is selected.
              </p>
            </div>

            {hasActiveFilters && (
              <div className="border-t border-[#e8ece9] p-4">
                <button
                  onClick={clearFilters}
                  className="w-full rounded-full border border-[var(--vana-green)] px-4 py-2 text-sm font-medium text-[var(--vana-green)] transition-colors hover:bg-[var(--vana-green)] hover:text-white"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </aside>

          <section className="min-w-0 overflow-hidden rounded-xl border border-[#e1e7e2] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#e8ece9] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-bold text-[#10231b]">
                  {activeCategory?.label ?? 'All Products'}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {filteredProducts.length} products found
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <span className="whitespace-nowrap text-gray-500">
                  Sort by
                </span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-[var(--vana-green)]"
                >
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="[&>section]:px-3 [&>section]:py-4 [&>section>div]:max-w-none [&>section>div>div:first-child]:hidden [&>section>div>div:last-child]:grid-cols-2 [&>section>div>div:last-child]:sm:grid-cols-2 [&>section>div>div:last-child]:lg:grid-cols-3 [&>section>div>div:last-child]:xl:grid-cols-4 [&>section>div>div:last-child]:2xl:grid-cols-5">
                <ProductGrid
                  title={activeCategory?.label ?? 'All Products'}
                  products={filteredProducts}
                />
              </div>
            ) : (
              <div className="p-10 text-center">
                <h2 className="font-semibold text-[#10231b]">
                  No products found
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  Try a different category or adjust your filters.
                </p>
                <button
                  onClick={() => {
                    clearFilters()
                    chooseCategory('all')
                  }}
                  className="mt-4 rounded-full bg-[var(--vana-green)] px-5 py-2 text-sm font-semibold text-white"
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
