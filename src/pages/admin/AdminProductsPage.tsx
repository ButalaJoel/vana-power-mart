
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search,
  Package,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { ProductForm } from "./ProductForm";
import { apiRequest } from '../../lib/api'
import type { ApiProduct, Category } from '../../types/catalog'

const PAGE_SIZE = 10

// Admin list rows are full API products (including inactive ones).
type Product = ApiProduct

function formatPrice(price: number | string) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(Number(price))
}

function ProductTableSkeleton() {
  return (
    <div aria-label="Loading products" aria-busy="true" className="overflow-x-auto">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-[#F5F8F6] text-[#64756A]">
          <tr>
            {['Product', 'SKU', 'Category', 'Price', 'Status', 'Actions'].map((heading) => (
              <th key={heading} className="px-5 py-3 font-medium">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E7EEE9]">
          {Array.from({ length: 6 }, (_, index) => (
            <tr key={index}>
              {Array.from({ length: 6 }, (_, cell) => (
                <td key={cell} className="px-5 py-5">
                  <div className="h-4 w-24 animate-pulse rounded bg-[#E7EEE9]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sr-only">Loading products from the database…</p>
    </div>
  )
}

export function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isProductFormOpen, setIsProductFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  // Categories are loaded on their own, so empty categories still appear.
  const [categories, setCategories] = useState<Category[]>([])

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const [productResult, categoryResult] = await Promise.all([
        apiRequest<{ data: Product[] }>('/api/products/admin/all', { auth: true }),
        apiRequest<{ data: Category[] }>('/api/categories/admin/all', { auth: true }),
      ])

      setProducts(productResult.data)
      setCategories(categoryResult.data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while loading products.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        (product.category?.name ?? '').toLowerCase().includes(query)

      const matchesCategory =
        selectedCategory === '' || product.category?.id === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [products, search, selectedCategory])

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE)

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(totalPages, 1)))
  }, [totalPages])

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredProducts.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredProducts, currentPage])

  const startItem =
    filteredProducts.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1

  const endItem = Math.min(currentPage * PAGE_SIZE, filteredProducts.length)

  function clearFilters() {
    setSearch('')
    setSelectedCategory('')
    setCurrentPage(1)
  }

  function openCreateForm() {
    setActionError('')
    setEditingProduct(null)
    setIsProductFormOpen(true)
  }

  function openEditForm(product: Product) {
    setActionError('')
    setEditingProduct(product)
    setIsProductFormOpen(true)
  }

  async function handleDeleteProduct() {
    if (!deleteTarget) return

    try {
      setDeleteLoading(true)
      setActionError('')

      await apiRequest(`/api/products/${deleteTarget.id}`, {
        method: 'DELETE',
        auth: true,
      })

      setDeleteTarget(null)
      await loadProducts()
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Unable to delete this product.',
      )
    } finally {
      setDeleteLoading(false)
    }
  }

  // Display the form as a separate view with a back button.
  if (isProductFormOpen) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[#64756A]">Management / Products</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17241C]">
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </h1>
            <p className="mt-2 text-sm text-[#64756A]">
              {editingProduct
                ? 'Update product information in your catalogue.'
                : 'Add a product to your Vana Power Mart catalogue.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsProductFormOpen(false)
              setEditingProduct(null)
              setActionError('')
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#D9E5DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#17241C] transition hover:bg-[#F5F8F6]"
          >
            <ChevronLeft size={18} />
            Back to Products
          </button>
        </div>

        <ProductForm
          categories={categories}
          product={editingProduct}
          onClose={() => {
            setIsProductFormOpen(false)
            setEditingProduct(null)
          }}
          onSaved={async () => {
            await loadProducts()
            setIsProductFormOpen(false)
            setEditingProduct(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#64756A]">Management</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17241C]">
            Products
          </h1>
          <p className="mt-2 text-sm text-[#64756A]">
            Manage your Vana Power Mart product catalogue.
          </p>
        </div>

        {/* The Add Product action stays on the far right. */}
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#064E32] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B6843] focus:outline-none focus:ring-2 focus:ring-[#0B6843]/30"
        >
          <Plus size={18} aria-hidden="true" />
          Add Product
        </button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError('')}
            aria-label="Dismiss error"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-[#D9E5DD] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#D9E5DD] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-[#17241C]">Product catalogue</h2>
            <p className="mt-1 text-sm text-[#64756A]" aria-live="polite">
              {loading
                ? 'Loading products…'
                : `${filteredProducts.length} of ${products.length} products`}
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search
              size={18}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64756A]"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search name, SKU or category"
              aria-label="Search products"
              className="w-full rounded-lg border border-[#D9E5DD] py-2 pl-10 pr-3 text-sm outline-none transition focus:border-[#0B6843] focus:ring-2 focus:ring-[#0B6843]/10"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-[#D9E5DD] p-5 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2 text-sm text-[#64756A]">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <label htmlFor="product-category-filter">Category</label>
          </div>

          <select
            id="product-category-filter"
            value={selectedCategory}
            onChange={(event) => {
              setSelectedCategory(event.target.value)
              setCurrentPage(1)
            }}
            className="w-full rounded-lg border border-[#D9E5DD] bg-white px-3 py-2 text-sm text-[#17241C] outline-none focus:border-[#0B6843] focus:ring-2 focus:ring-[#0B6843]/10 sm:w-64"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          {(search || selectedCategory) && (
            <button
              type="button"
              onClick={clearFilters}
              className="self-start text-sm font-medium text-[#0B6843] hover:underline sm:self-center"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading && <ProductTableSkeleton />}

        {!loading && error && (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertCircle size={26} className="text-red-600" />
            </div>
            <h3 className="mt-4 font-semibold text-red-700">
              Could not load products
            </h3>
            <p className="mt-2 max-w-md text-sm text-[#64756A]">{error}</p>
            <p className="mt-1 text-sm text-[#64756A]">
              Check your connection and make sure the backend server is running.
            </p>
            <button
              type="button"
              onClick={() => void loadProducts()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#064E32] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0B6843] focus:outline-none focus:ring-2 focus:ring-[#0B6843]/30"
            >
              <RotateCcw size={16} />
              Try again
            </button>
          </div>
        )}

        {!loading && !error && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F0F5F1]">
              <Package size={26} className="text-[#64756A]" />
            </div>
            <h3 className="mt-4 font-semibold text-[#17241C]">
              {products.length === 0
                ? 'Your catalogue is empty'
                : 'No products found'}
            </h3>
            <p className="mt-2 max-w-md text-sm text-[#64756A]">
              {products.length === 0
                ? 'Products returned by the API will appear here once available.'
                : 'Try another search term or select a different category.'}
            </p>

            {products.length === 0 ? (
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#064E32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B6843]"
              >
                <Plus size={18} />
                Add your first product
              </button>
            ) : (search || selectedCategory) ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-sm font-semibold text-[#0B6843] hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        )}
        
        {!loading && !error && paginatedProducts.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#F5F8F6] text-[#64756A]">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Product</th>
                    <th scope="col" className="px-5 py-3 font-medium">SKU</th>
                    <th scope="col" className="px-5 py-3 font-medium">Category</th>
                    <th scope="col" className="px-5 py-3 font-medium">Price</th>
                    <th scope="col" className="px-5 py-3 font-medium">Stock</th>
                    <th scope="col" className="px-5 py-3 font-medium">Status</th>
                    <th scope="col" className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E7EEE9]">
                  {paginatedProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="transition-colors hover:bg-[#F8FAF8]"
                    >
                      <td className="px-5 py-4 font-medium text-[#17241C]">
                        {product.name}
                      </td>
                      <td className="px-5 py-4 text-[#64756A]">
                        {product.sku}
                      </td>
                      <td className="px-5 py-4 text-[#64756A]">
                        {product.category?.name ?? 'Uncategorised'}
                      </td>
                      <td className="px-5 py-4 font-medium text-[#17241C]">
                        {formatPrice(product.variants[0]?.price ?? product.price)}
                      </td>
                      <td className="px-5 py-4">
                        {(() => {
                          const quantity = product.inventory?.quantity ?? 0
                          const low = quantity <= (product.inventory?.reorderLevel ?? 0)
                          return (
                            <span className={low ? 'font-semibold text-amber-700' : 'text-[#17241C]'}>
                              {quantity}
                              {low && <span className="ml-1 text-xs font-normal">low</span>}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            product.isActive
                              ? 'bg-[#E6F4EA] text-[#166534]'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(product)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E5DD] px-3 py-2 text-sm font-medium text-[#17241C] hover:bg-[#F5F8F6]"
                            aria-label={`Edit ${product.name}`}
                          >
                            <Pencil size={15} />
                            Edit
                          </button>

                          {product.isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionError('')
                              setDeleteTarget(product)
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                            aria-label={`Deactivate ${product.name}`}
                          >
                            <Trash2 size={15} />
                            Deactivate
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t border-[#D9E5DD] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#64756A]" aria-live="polite">
                Showing{' '}
                <span className="font-medium text-[#17241C]">
                  {startItem}–{endItem}
                </span>{' '}
                of{' '}
                <span className="font-medium text-[#17241C]">
                  {filteredProducts.length}
                </span>{' '}
                products
              </p>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D9E5DD] px-3 py-2 text-sm font-medium text-[#17241C] transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <span className="whitespace-nowrap text-sm text-[#64756A]">
                  Page {currentPage} of {Math.max(totalPages, 1)}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D9E5DD] px-3 py-2 text-sm font-medium text-[#17241C] transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Ask for confirmation before attempting to delete a product. */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !deleteLoading
            ) {
              setDeleteTarget(null)
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="delete-product-title"
                  className="text-lg font-semibold text-[#17241C]"
                >
                  Deactivate product?
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#64756A]">
                  <strong>{deleteTarget.name}</strong> will be hidden from the
                  storefront. It stays in your catalogue and order history, and
                  you can reactivate it at any time by editing it.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                aria-label="Close delete confirmation"
                className="rounded p-1 text-[#64756A] hover:bg-[#F5F8F6] disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="rounded-lg border border-[#D9E5DD] px-4 py-2.5 text-sm font-medium text-[#17241C] hover:bg-[#F5F8F6] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleDeleteProduct()}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={16} />
                {deleteLoading ? 'Deactivating…' : 'Deactivate product'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

