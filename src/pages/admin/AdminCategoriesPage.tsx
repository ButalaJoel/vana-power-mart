import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Tags,
  Trash2,
  X,
} from 'lucide-react'
import { apiRequest } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import type {
  Category,
  SpecFieldType,
  SpecificationFieldDefinition,
} from '../../types/catalog'

const FIELD_TYPES: Array<{ value: SpecFieldType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'textarea', label: 'Multiline text' },
]

// Suggested starting fields, matched by category slug. Admins can edit them.
const SUGGESTED_FIELDS: Record<string, string[]> = {
  'home-appliances': ['Brand', 'Model', 'Power consumption', 'Capacity', 'Colour', 'Warranty', 'Dimensions'],
  'phones-electronics': ['Brand', 'Model', 'Storage', 'RAM', 'Colour', 'Battery capacity', 'Warranty'],
  'furniture-home': ['Material', 'Dimensions', 'Colour', 'Weight', 'Assembly required'],
  beddings: ['Material', 'Size', 'Colour', 'Fabric type'],
  'bags-accessories': ['Material', 'Size', 'Colour', 'Type'],
}
const DEFAULT_SUGGESTED = ['Brand', 'Model', 'Colour', 'Warranty']

// Editable row in the field builder. Options are typed as comma-separated text.
interface FieldRow {
  rowId: string
  key: string
  label: string
  type: SpecFieldType
  required: boolean
  optionsText: string
  unit: string
}

interface CategoryFormValues {
  id?: string
  parentId: string
  name: string
  slug: string
  slugEdited: boolean
  description: string
  imageUrl: string
  isActive: boolean
  fields: FieldRow[]
}

const emptyForm: CategoryFormValues = {
  parentId: '',
  name: '',
  slug: '',
  slugEdited: false,
  description: '',
  imageUrl: '',
  isActive: true,
  fields: [],
}

const inputClass =
  'mt-1 w-full rounded-lg border border-[#D9E5DD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0B6843] focus:ring-2 focus:ring-[#0B6843]/10'

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

let rowCounter = 0
function newRow(partial: Partial<FieldRow> = {}): FieldRow {
  rowCounter += 1
  return {
    rowId: `row-${rowCounter}`,
    key: '',
    label: '',
    type: 'text',
    required: false,
    optionsText: '',
    unit: '',
    ...partial,
  }
}

function toRows(fields: SpecificationFieldDefinition[] | null): FieldRow[] {
  return (Array.isArray(fields) ? fields : []).map((field) =>
    newRow({
      key: field.key,
      label: field.label,
      type: field.type,
      required: Boolean(field.required),
      optionsText: (field.options ?? []).join(', '),
      unit: field.unit ?? '',
    }),
  )
}

function toDefinitions(rows: FieldRow[]) {
  return rows
    .filter((row) => row.label.trim())
    .map((row) => ({
      key: row.key || undefined,
      label: row.label.trim(),
      type: row.type,
      required: row.required,
      ...(row.type === 'select'
        ? {
            options: row.optionsText
              .split(',')
              .map((option) => option.trim())
              .filter(Boolean),
          }
        : {}),
      ...(row.unit.trim() && (row.type === 'text' || row.type === 'number')
        ? { unit: row.unit.trim() }
        : {}),
    }))
}

export function AdminCategoriesPage() {
  usePageTitle('Categories')

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [editing, setEditing] = useState<Category | null>(null)

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const result = await apiRequest<{ data: Category[] }>(
        '/api/categories/admin/all',
        { auth: true },
      )
      setCategories(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load categories.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  async function toggleActive(category: Category) {
    try {
      setBusyId(category.id)
      setActionError('')
      await apiRequest(`/api/categories/${category.id}`, {
        method: 'PUT',
        auth: true,
        body: { isActive: !category.isActive },
      })
      await loadCategories()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update the category.')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    try {
      setBusyId(deleteTarget.id)
      setActionError('')
      await apiRequest(`/api/categories/${deleteTarget.id}`, {
        method: 'DELETE',
        auth: true,
      })
      setDeleteTarget(null)
      await loadCategories()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete the category.')
      setDeleteTarget(null)
    } finally {
      setBusyId(null)
    }
  }

  if (formOpen) {
    return (
      <CategoryForm
        category={editing}
        categories={categories}
        onCancel={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSaved={async () => {
          setFormOpen(false)
          setEditing(null)
          await loadCategories()
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#64756A]">Management</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17241C]">
            Categories
          </h1>
          <p className="mt-2 text-sm text-[#64756A]">
            Organise the storefront and choose the specification fields each
            category's products use.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setActionError('')
            setEditing(null)
            setFormOpen(true)
          }}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#064E32] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B6843]"
        >
          <Plus size={18} />
          Add Category
        </button>
      </div>

      {actionError && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {actionError}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#D9E5DD] bg-white">
        {loading ? (
          <div aria-busy="true" className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded bg-[#E7EEE9]" />
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <AlertCircle className="mx-auto text-red-600" />
            <p className="mt-3 font-semibold text-[#17241C]">Categories couldn't be loaded</p>
            <p className="mt-1 text-sm text-[#64756A]">{error}</p>
            <button
              type="button"
              onClick={() => void loadCategories()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#D9E5DD] px-4 py-2 text-sm font-medium"
            >
              <RotateCcw size={16} /> Retry
            </button>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-10 text-center">
            <Tags className="mx-auto text-[#0B6843]" />
            <p className="mt-3 font-semibold text-[#17241C]">No categories yet</p>
            <p className="mt-1 text-sm text-[#64756A]">
              Create your first category to start adding products.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#F5F8F6] text-[#64756A]">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Category</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Products</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Spec fields</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                  <th scope="col" className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EEE9]">
                {categories
                  .filter((entry) => !entry.parentId)
                  .flatMap((parent) => [parent, ...categories.filter((entry) => entry.parentId === parent.id)])
                  .map((category) => {
                  const total = category.productCount ?? 0
                  const busy = busyId === category.id

                  return (
                    <tr key={category.id} className="hover:bg-[#F8FAF8]">
                      <td className={`px-5 py-4 ${category.parentId ? 'pl-10' : ''}`}>
                        <p className="font-medium text-[#17241C]">{category.parentId ? '↳ ' : ''}{category.name}</p>
                        <p className="text-xs text-[#64756A]">/{category.slug}</p>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-[#17241C]">
                        {total}
                        {total !== category.activeProductCount && (
                          <span className="block text-xs text-[#64756A]">
                            {category.activeProductCount} active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-[#64756A]">
                        {category.specificationFields?.length ?? 0}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            category.isActive
                              ? 'bg-[#E6F4EA] text-[#166534]'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {category.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActionError('')
                              setEditing(category)
                              setFormOpen(true)
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E5DD] px-3 py-2 text-sm font-medium text-[#17241C] hover:bg-[#F5F8F6]"
                          >
                            <Pencil size={15} /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void toggleActive(category)}
                            className="rounded-lg border border-[#D9E5DD] px-3 py-2 text-sm font-medium text-[#17241C] hover:bg-[#F5F8F6] disabled:opacity-50"
                          >
                            {category.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          {total === 0 && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setDeleteTarget(category)}
                              aria-label={`Delete ${category.name}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 size={15} /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-[#64756A]">
        Categories with products can't be deleted — deactivate them to hide them
        and their products from the storefront.
      </p>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-category-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 id="delete-category-title" className="text-lg font-semibold text-[#17241C]">
              Delete category?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#64756A]">
              <strong>{deleteTarget.name}</strong> has no products and will be
              removed permanently.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-[#D9E5DD] px-4 py-2.5 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === deleteTarget.id}
                onClick={() => void confirmDelete()}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Delete category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryForm({
  category,
  categories,
  onCancel,
  onSaved,
}: {
  category: Category | null
  categories: Category[]
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const [form, setForm] = useState<CategoryFormValues>(() =>
    category
      ? {
          id: category.id,
          parentId: category.parentId ?? '',
          name: category.name,
          slug: category.slug,
          slugEdited: true,
          description: category.description ?? '',
          imageUrl: category.imageUrl ?? '',
          isActive: category.isActive,
          fields: toRows(category.specificationFields),
        }
      : { ...emptyForm, fields: [] },
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const suggested = useMemo(
    () => SUGGESTED_FIELDS[form.slug] ?? DEFAULT_SUGGESTED,
    [form.slug],
  )

  function update<K extends keyof CategoryFormValues>(key: K, value: CategoryFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateRow(rowId: string, patch: Partial<FieldRow>) {
    setForm((current) => ({
      ...current,
      fields: current.fields.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    }))
  }

  function moveRow(index: number, direction: -1 | 1) {
    setForm((current) => {
      const fields = [...current.fields]
      const target = index + direction
      if (target < 0 || target >= fields.length) return current
      ;[fields[index], fields[target]] = [fields[target], fields[index]]
      return { ...current, fields }
    })
  }

  function addSuggested() {
    setForm((current) => {
      const existing = new Set(current.fields.map((row) => row.label.trim().toLowerCase()))
      const additions = suggested
        .filter((label) => !existing.has(label.toLowerCase()))
        .map((label) => newRow({ label }))
      return { ...current, fields: [...current.fields, ...additions] }
    })
  }

  async function uploadImage(file: File) {
    if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) {
      setError('Choose an image file under 15 MB.')
      return
    }

    try {
      setUploading(true)
      setError('')
      const data = new FormData()
      data.append('images', file)
      const result = await apiRequest<{ data: Array<{ url: string }> }>('/api/uploads', {
        method: 'POST',
        body: data,
        auth: true,
      })
      if (result.data[0]?.url) update('imageUrl', result.data[0].url)
    } catch (err) {
      setError(
        `Image upload failed: ${err instanceof Error ? err.message : 'unknown error'} You can paste an image URL instead.`,
      )
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const labels = form.fields.map((row) => row.label.trim().toLowerCase()).filter(Boolean)
    const duplicate = labels.find((label, index) => labels.indexOf(label) !== index)
    if (duplicate) {
      setError(`Two specification fields are called "${duplicate}". Rename one of them.`)
      return
    }

    const emptyDropdown = form.fields.find(
      (row) =>
        row.label.trim() &&
        row.type === 'select' &&
        !row.optionsText.split(',').some((option) => option.trim()),
    )
    if (emptyDropdown) {
      setError(`Add options for the "${emptyDropdown.label}" dropdown, separated by commas.`)
      return
    }

    try {
      setSaving(true)
      await apiRequest(`/api/categories${form.id ? `/${form.id}` : ''}`, {
        method: form.id ? 'PUT' : 'POST',
        auth: true,
        body: {
          name: form.name,
          parentId: form.parentId || null,
          slug: form.slug || undefined,
          description: form.description,
          imageUrl: form.imageUrl,
          isActive: form.isActive,
          specificationFields: toDefinitions(form.fields),
        },
      })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the category.')
    } finally {
      setSaving(false)
    }
  }

  const slugChanged = Boolean(category && form.slug !== category.slug)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#64756A]">Management / Categories</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17241C]">
            {category ? `Edit ${category.name}` : 'Add Category'}
          </h1>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg border border-[#D9E5DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#17241C] hover:bg-[#F5F8F6]"
        >
          <X size={16} /> Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="space-y-4 rounded-2xl border border-[#D9E5DD] bg-white p-5">
          <h2 className="font-semibold text-[#17241C]">Basic information</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-[#17241C]">
              Category name *
              <input
                required
                maxLength={120}
                className={inputClass}
                value={form.name}
                onChange={(event) => {
                  const name = event.target.value
                  setForm((current) => ({
                    ...current,
                    name,
                    slug: current.slugEdited ? current.slug : slugify(name),
                  }))
                }}
              />
            </label>

            <label className="text-sm font-medium text-[#17241C]">
              URL slug
              <input
                maxLength={120}
                className={inputClass}
                value={form.slug}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    // Light clean-up while typing; the server finalises the slug.
                    slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
                    slugEdited: true,
                  }))
                }
                placeholder="generated-from-name"
              />
              <span className="mt-1 block text-xs font-normal text-[#64756A]">
                Storefront link: /categories/{form.slug || '…'}
                {slugChanged && ' — changing this breaks existing links to this category.'}
              </span>
            </label>

            <label className="text-sm font-medium text-[#17241C] sm:col-span-2">
              Description
              <textarea
                rows={3}
                maxLength={2000}
                className={inputClass}
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
              />
            </label>

            <label className="text-sm font-medium text-[#17241C] sm:col-span-2">
              Parent category
              <select
                className={inputClass}
                value={form.parentId}
                onChange={(event) => update('parentId', event.target.value)}
                disabled={Boolean(category && categories.some((entry) => entry.parentId === category.id))}
              >
                <option value="">None (top-level category)</option>
                {categories
                  .filter((entry) => !entry.parentId && entry.id !== category?.id)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-[#64756A]">
                Subcategories appear inside their parent on the storefront.
                {category && categories.some((entry) => entry.parentId === category.id) && ' This category has subcategories, so it stays top-level.'}
              </span>
            </label>

            <div className="text-sm font-medium text-[#17241C] sm:col-span-2">
              Category image
              <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#D9E5DD] bg-[#F5F8F6]">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus size={22} className="text-[#64756A]" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    className={inputClass}
                    value={form.imageUrl}
                    onChange={(event) => update('imageUrl', event.target.value)}
                    placeholder="https://… or /categories/image.jpg"
                  />
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) void uploadImage(file)
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploading || saving}
                      onClick={() => fileInput.current?.click()}
                      className="rounded-lg border border-[#D9E5DD] px-3 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      {uploading ? 'Uploading…' : 'Upload image'}
                    </button>
                    {form.imageUrl && (
                      <button
                        type="button"
                        onClick={() => update('imageUrl', '')}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs font-normal text-[#64756A]">
                    Optional. Without an image, the storefront shows a product photo from this category.
                  </p>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-[#17241C] sm:col-span-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => update('isActive', event.target.checked)}
              />
              Active — show this category and its products on the storefront
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[#D9E5DD] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#17241C]">Product specifications</h2>
              <p className="mt-1 text-xs text-[#64756A]">
                These fields appear on the product form for every product in this category.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addSuggested}
                className="rounded-lg border border-[#D9E5DD] px-3 py-2 text-sm font-medium hover:bg-[#F5F8F6]"
              >
                Add suggested fields
              </button>
              <button
                type="button"
                onClick={() => update('fields', [...form.fields, newRow()])}
                className="inline-flex items-center gap-1 rounded-lg bg-[#064E32] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0B6843]"
              >
                <Plus size={15} /> Add field
              </button>
            </div>
          </div>

          {form.fields.length === 0 ? (
            <p className="rounded-lg bg-[#F5F8F6] p-4 text-sm text-[#64756A]">
              No fields yet. Add your own or start from the suggested fields
              ({suggested.join(', ')}).
            </p>
          ) : (
            <ol className="space-y-3">
              {form.fields.map((row, index) => (
                <li key={row.rowId} className="rounded-xl border border-[#E2EAE4] p-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                    <label className="text-xs font-medium text-[#64756A]">
                      Field label
                      <input
                        className={inputClass}
                        value={row.label}
                        maxLength={80}
                        placeholder="e.g. Capacity"
                        onChange={(event) => updateRow(row.rowId, { label: event.target.value })}
                      />
                    </label>
                    <label className="text-xs font-medium text-[#64756A]">
                      Type
                      <select
                        className={inputClass}
                        value={row.type}
                        onChange={(event) =>
                          updateRow(row.rowId, { type: event.target.value as SpecFieldType })
                        }
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-end gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${row.label || 'field'} up`}
                        disabled={index === 0}
                        onClick={() => moveRow(index, -1)}
                        className="rounded-lg border border-[#D9E5DD] p-2.5 text-[#64756A] disabled:opacity-30"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${row.label || 'field'} down`}
                        disabled={index === form.fields.length - 1}
                        onClick={() => moveRow(index, 1)}
                        className="rounded-lg border border-[#D9E5DD] p-2.5 text-[#64756A] disabled:opacity-30"
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${row.label || 'field'}`}
                        onClick={() =>
                          update('fields', form.fields.filter((item) => item.rowId !== row.rowId))
                        }
                        className="rounded-lg border border-red-200 p-2.5 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-4">
                    {row.type === 'select' && (
                      <label className="min-w-0 flex-1 text-xs font-medium text-[#64756A]">
                        Options (comma-separated)
                        <input
                          className={inputClass}
                          value={row.optionsText}
                          placeholder="e.g. Black, White, Silver"
                          onChange={(event) => updateRow(row.rowId, { optionsText: event.target.value })}
                        />
                      </label>
                    )}
                    {(row.type === 'text' || row.type === 'number') && (
                      <label className="w-32 text-xs font-medium text-[#64756A]">
                        Unit
                        <input
                          className={inputClass}
                          value={row.unit}
                          maxLength={20}
                          placeholder="e.g. litres"
                          onChange={(event) => updateRow(row.rowId, { unit: event.target.value })}
                        />
                      </label>
                    )}
                    <label className="flex items-center gap-2 pb-2.5 text-sm text-[#17241C]">
                      <input
                        type="checkbox"
                        checked={row.required}
                        onChange={(event) => updateRow(row.rowId, { required: event.target.checked })}
                      />
                      Required
                    </label>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-[#D9E5DD] bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="rounded-lg bg-[#064E32] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B6843] disabled:opacity-60"
          >
            {saving ? 'Saving…' : category ? 'Save changes' : 'Create category'}
          </button>
        </div>
      </form>
    </div>
  )
}
