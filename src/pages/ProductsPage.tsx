import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ShoppingCart, SlidersHorizontal } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useCategories } from '../context/CategoryContext'
import { useProducts } from '../context/ProductContext'
import { usePageTitle } from '../hooks/usePageTitle'
import type { StoreProduct } from '../types/catalog'

const FALLBACK_IMAGE =
  'https://placehold.co/500x400/f4f7f5/0b6843?text=Vana+Power+Mart'

function getCapacity(product: StoreProduct): string {
  const entry = Object.entries(product.specifications).find(([key]) =>
    key.toLowerCase().includes('capacity'),
  )

  return entry ? String(entry[1]) : ''
}

function formatPrice(price: number | string) {
  return `UGX ${Number(price).toLocaleString('en-UG', {
    maximumFractionDigits: 0,
  })}`
}

function matchesSearch(product: StoreProduct, query: string) {
  if (!query) return true
  const text = [
    product.name,
    product.sku,
    product.model,
    product.brand,
    product.categoryName,
    product.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word))
}

export function ProductsPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const { categorySlug } = useParams<{ categorySlug?: string }>()
  const { products, loading: productsLoading, error, refreshProducts } = useProducts()
  const { categories, loading: categoriesLoading } = useCategories()

  // /categories/:slug wins; /products?category=slug still works for old links.
  const selectedCategory = categorySlug ?? searchParams.get('category') ?? 'all'
  const searchQuery = (searchParams.get('q') ?? '').trim()

  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('featured')
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedCapacities, setSelectedCapacities] = useState<string[]>([])
  const [inStockOnly, setInStockOnly] = useState(false)
  const [addedProductId, setAddedProductId] = useState<string | null>(null)

  // A parent category includes its subcategories' products.
  const childSlugs = (slug: string) => {
    const parent = categories.find((category) => category.slug === slug)
    return parent ? categories.filter((category) => category.parentId === parent.id).map((category) => category.slug) : []
  }
  const selectedSlugs = selectedCategory === 'all' ? [] : [selectedCategory, ...childSlugs(selectedCategory)]
  const topLevel = categories.filter((category) => !category.parentId)

  const activeCategory = categories.find(
    (category) => category.slug === selectedCategory,
  )
  const loading = productsLoading || (selectedCategory !== 'all' && categoriesLoading)
  const unknownCategory =
    selectedCategory !== 'all' && !categoriesLoading && !activeCategory

  const activeCategoryName = searchQuery
    ? `Results for "${searchQuery}"`
    : selectedCategory === 'all'
      ? 'All Products'
      : (activeCategory?.name ?? 'Category not found')

  usePageTitle(
    activeCategoryName,
    activeCategory
      ? `Shop ${activeCategory.name} online at Vana Power Mart. Delivery across Uganda, pay on delivery or with mobile money.`
      : undefined,
  )

  const categoryProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (selectedCategory === 'all' || selectedSlugs.includes(product.categorySlug)) &&
          matchesSearch(product, searchQuery),
      ),
    [products, selectedCategory, searchQuery],
  )

  const availableBrands = useMemo(
    () =>
      [
        ...new Set(
          categoryProducts
            .map((product) => product.brand?.trim())
            .filter((brand): brand is string => Boolean(brand)),
        ),
      ].sort(),
    [categoryProducts],
  )

  const availableCapacities = useMemo(
    () =>
      [
        ...new Set(
          categoryProducts
            .map(getCapacity)
            .filter((capacity) => capacity !== ''),
        ),
      ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [categoryProducts],
  )

  const filteredProducts = useMemo(() => {
    let result = [...categoryProducts]

    if (minPrice !== '') {
      result = result.filter((product) => product.price >= Number(minPrice))
    }

    if (maxPrice !== '') {
      result = result.filter((product) => product.price <= Number(maxPrice))
    }

    if (selectedBrands.length > 0) {
      result = result.filter((product) =>
        selectedBrands.includes(product.brand || ''),
      )
    }

    if (selectedCapacities.length > 0) {
      result = result.filter((product) =>
        selectedCapacities.includes(getCapacity(product)),
      )
    }

    if (inStockOnly) {
      result = result.filter((product) => product.stock > 0)
    }

    if (sort === 'price-low') {
      result.sort((a, b) => a.price - b.price)
    } else if (sort === 'price-high') {
      result.sort((a, b) => b.price - a.price)
    } else if (sort === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      result.sort((a, b) => Number(b.featured) - Number(a.featured))
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
    navigate(category === 'all' ? '/products' : `/categories/${category}`)
    setSelectedBrands([])
    setSelectedCapacities([])
    setMinPrice('')
    setMaxPrice('')
    setInStockOnly(false)
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

  function clearFilters() {
    setMinPrice('')
    setMaxPrice('')
    setSelectedBrands([])
    setSelectedCapacities([])
    setInStockOnly(false)
    setSort('featured')
  }

  function handleAddToCart(product: StoreProduct) {
    addItem(product.id, 1)
    setAddedProductId(product.id)

    window.setTimeout(() => {
      setAddedProductId((current) =>
        current === product.id ? null : current,
      )
    }, 1800)
  }

  const hasActiveFilters =
    minPrice !== '' ||
    maxPrice !== '' ||
    selectedBrands.length > 0 ||
    selectedCapacities.length > 0 ||
    inStockOnly

  return (
    <main className="min-h-screen bg-[#f5f6f5] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        <nav className="mb-5 text-sm text-[#718078]" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-[var(--vana-green)]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="font-medium text-[#10231b]">
            {activeCategoryName}
          </span>
        </nav>

        <div className="grid items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-xl border border-[#e1e7e2] bg-white">
            <div className="border-b border-[#e8ece9] p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase">
                Categories
              </h2>

              {/* Horizontal chips on phones, a vertical list on desktop. */}
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:mx-0 lg:block lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => chooseCategory('all')}
                className={`shrink-0 whitespace-nowrap rounded-full border border-[#e1e7e2] px-3 py-1.5 text-left text-sm lg:mb-2 lg:block lg:w-full lg:whitespace-normal lg:rounded-lg lg:border-0 lg:px-2 lg:py-2 ${
                  selectedCategory === 'all'
                    ? 'bg-[#eaf3ed] font-semibold text-[var(--vana-green)]'
                    : 'hover:bg-gray-50'
                }`}
              >
                All Products
              </button>

              {topLevel.flatMap((parent) => [parent, ...categories.filter((child) => child.parentId === parent.id)]).map(({ slug, name, parentId }) => (
                <button
                  type="button"
                  key={slug}
                  onClick={() => chooseCategory(slug)}
                  className={`shrink-0 whitespace-nowrap rounded-full border border-[#e1e7e2] px-3 py-1.5 text-left text-sm lg:mb-1 lg:block lg:w-full lg:whitespace-normal lg:rounded-lg lg:border-0 lg:py-2 ${
                    parentId ? 'lg:pl-6 lg:pr-2 lg:text-[13px]' : 'lg:px-2'
                  } ${
                    selectedCategory === slug
                      ? 'bg-[#eaf3ed] font-semibold text-[var(--vana-green)]'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {name}
                </button>
              ))}
              </div>
            </div>

            <div className="border-b border-[#e8ece9] p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase">Price (UGX)</h2>
                <button
                  type="button"
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

            <div className="border-b border-[#e8ece9] p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase">Brand</h2>

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
                          toggleValue(brand, selectedBrands, setSelectedBrands)
                        }
                        className="h-4 w-4 accent-[var(--vana-green)]"
                      />
                      {brand}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs leading-5 text-gray-500">
                  Brand filters will appear when products with brand
                  information are added.
                </p>
              )}
            </div>

            {availableCapacities.length > 0 && (
              <div className="border-b border-[#e8ece9] p-4">
                <h2 className="mb-3 text-sm font-semibold uppercase">
                  Capacity
                </h2>
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
              </div>
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
                Out-of-stock products can still be ordered; we confirm
                availability before delivery.
              </p>
            </div>

            {hasActiveFilters && (
              <div className="border-t border-[#e8ece9] p-4">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full rounded-full border border-[var(--vana-green)] px-4 py-2 text-sm font-medium text-[var(--vana-green)] hover:bg-[var(--vana-green)] hover:text-white"
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
                  {activeCategoryName}
                </h1>
                <p className="mt-1 text-sm text-gray-500" aria-live="polite">
                  {loading
                    ? 'Loading products…'
                    : `${filteredProducts.length} products found`}
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <SlidersHorizontal
                  size={16}
                  aria-hidden="true"
                  className="text-gray-500"
                />
                <span className="whitespace-nowrap text-gray-500">Sort by</span>
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

            {loading ? (
              <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse overflow-hidden rounded-xl border border-[#e1e7e2]"
                  >
                    <div className="h-48 bg-[#f0f3f1]" />
                    <div className="space-y-3 p-4">
                      <div className="h-3 w-1/3 rounded bg-gray-200" />
                      <div className="h-4 w-full rounded bg-gray-200" />
                      <div className="h-5 w-2/3 rounded bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-10 text-center">
                <h2 className="font-semibold text-[#10231b]">
                  Products couldn't be loaded
                </h2>
                <p className="mt-2 text-sm text-gray-500">{error}</p>
                <button
                  type="button"
                  onClick={() => void refreshProducts()}
                  className="mt-4 rounded-full bg-[var(--vana-green)] px-5 py-2 text-sm font-semibold text-white"
                >
                  Try again
                </button>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 p-3 sm:grid-cols-3 sm:p-4 xl:grid-cols-4">
                {filteredProducts.map((product) => {
                  const images = product.images
                  const price = product.price
                  const compareAtPrice = product.oldPrice ?? 0
                  const hasDiscount =
                    compareAtPrice > price && price > 0
                  const justAdded = addedProductId === product.id

                  return (
                    <article
                      key={product.id}
                      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#dce5df] bg-white transition hover:-translate-y-1 hover:border-[var(--vana-green)] hover:shadow-md"
                    >
                      <div className="relative flex h-40 items-center justify-center bg-[#f4f7f5] p-3 sm:h-48">
                        <Link
                          to={`/products/${product.slug}`}
                          className="flex h-full w-full items-center justify-center"
                        >
                          <img
                            src={images[0] || FALLBACK_IMAGE}
                            alt={product.name}
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.src = FALLBACK_IMAGE
                            }}
                            className="h-full w-full object-contain"
                          />
                        </Link>

                        {hasDiscount && (
                          <span className="absolute left-2 top-2 rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
                            SALE
                          </span>
                        )}

                      </div>

                      <div className="flex flex-1 flex-col p-3 sm:p-4">
                        <p className="mb-1 text-[11px] text-[#718078]">
                          {product.categoryName}
                        </p>

                        <h2 className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-[#10231b]">
                          <Link
                            to={`/products/${product.slug}`}
                            className="hover:text-[var(--vana-green)]"
                          >
                            {product.name}
                          </Link>
                        </h2>

                        {product.model && (
                          <p className="mt-3 truncate text-[11px] text-[#718078]">
                            {product.model}
                          </p>
                        )}

                        <div className="mt-auto pt-4">
                          <p className="font-bold text-[var(--vana-green)]">
                            {formatPrice(price)}
                          </p>

                          {hasDiscount && (
                            <p className="mt-1 text-xs text-gray-400 line-through">
                              {formatPrice(compareAtPrice)}
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={() => handleAddToCart(product)}
                            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--vana-green)] px-3 py-2.5 text-xs font-medium transition sm:text-sm ${
                              justAdded
                                ? 'bg-[var(--vana-green)] text-white'
                                : 'text-[var(--vana-green)] hover:bg-[var(--vana-green)] hover:text-white'
                            }`}
                          >
                            <ShoppingCart size={15} />
                            {justAdded ? 'Added to cart ✓' : 'Add to cart'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf3ed] text-[var(--vana-green)]">
                  <ShoppingCart size={25} />
                </div>
                <h2 className="mt-4 font-semibold text-[#10231b]">
                  {unknownCategory
                    ? 'This category is not available'
                    : products.length === 0
                      ? 'Your catalogue is getting ready'
                      : categoryProducts.length === 0 && selectedCategory !== 'all' && !searchQuery
                        ? `No products in ${activeCategoryName} yet`
                        : 'No products found'}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                  {unknownCategory
                    ? 'It may have been renamed or removed. Browse all products instead.'
                    : products.length === 0
                      ? 'Products added through the admin dashboard will appear here automatically.'
                      : categoryProducts.length === 0 && selectedCategory !== 'all' && !searchQuery
                        ? 'New products are added regularly. Check back soon or browse other categories.'
                        : 'Try another category or adjust your filters to find what you need.'}
                </p>

                {(unknownCategory || categoryProducts.length === 0) && (
                  <Link
                    to="/products"
                    className="mt-4 inline-block rounded-full border border-[var(--vana-green)] px-5 py-2 text-sm font-semibold text-[var(--vana-green)]"
                  >
                    Browse all products
                  </Link>
                )}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 rounded-full bg-[var(--vana-green)] px-5 py-2 text-sm font-semibold text-white"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}