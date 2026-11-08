import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Truck } from 'lucide-react'
import { apiRequest, formatUGX } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { Badge, Card, Empty, ErrorNote, LoadingRows, Modal, PageHeader, daysAgo, inputClass, primaryButton, secondaryButton } from '../../components/admin/ui'

export interface Supplier {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  location: string | null
  notes: string | null
  deliversDirect: boolean
  leadTimeDays: number | null
  isActive: boolean
  _count?: { products: number; procurements: number }
  staleConfirmations?: number
  lastConfirmedAt?: string | null
}

interface SupplierDetail extends Supplier {
  products: Array<{
    id: string
    wholesalePrice: string
    availableQuantity: number
    confirmedAt: string | null
    isPreferred: boolean
    product: { id: string; name: string; sku: string; price: string; isActive: boolean }
  }>
}

const emptySupplier = { name: '', contactPerson: '', phone: '', email: '', location: '', notes: '', deliversDirect: false, leadTimeDays: '', isActive: true }

export function AdminSuppliersPage() {
  usePageTitle('Suppliers')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError('')
      const result = await apiRequest<{ data: Supplier[] }>('/api/suppliers', { auth: true })
      setSuppliers(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load suppliers.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <PageHeader
        section="Operations"
        title="Suppliers"
        text="The businesses you buy from. Record what each supplier offers and at what price in Inventory, then pick a supplier for each order item in Orders."
        action={
          <button type="button" className={primaryButton} onClick={() => setEditing('new')}>
            <Plus size={18} /> Add supplier
          </button>
        }
      />
      <ErrorNote message={error} />

      <Card>
        {loading ? (
          <LoadingRows />
        ) : suppliers.length === 0 ? (
          <Empty>No suppliers yet. Add the first business you source products from.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-[#F5F8F6] text-[#64756A]">
                <tr>
                  <th className="px-5 py-3 font-medium">Supplier</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 text-right font-medium">Products</th>
                  <th className="px-5 py-3 font-medium">Stock confirmed</th>
                  <th className="px-5 py-3 font-medium">Delivery</th>
                  <th className="px-5 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EEE9]">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-[#F8FAF8]">
                    <td className="px-5 py-4">
                      <button type="button" onClick={() => setViewing(supplier.id)} className="font-medium text-[#17241C] hover:underline">
                        {supplier.name}
                      </button>
                      <p className="text-xs text-[#64756A]">{supplier.location}</p>
                      {!supplier.isActive && <Badge>Inactive</Badge>}
                    </td>
                    <td className="px-5 py-4">
                      <p>{supplier.contactPerson}</p>
                      {supplier.phone && <a href={`tel:${supplier.phone}`} className="text-xs text-[#0B6843] underline">{supplier.phone}</a>}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">{supplier._count?.products ?? 0}</td>
                    <td className="px-5 py-4">
                      <p>{daysAgo(supplier.lastConfirmedAt)}</p>
                      {(supplier.staleConfirmations ?? 0) > 0 && <Badge tone="amber">{supplier.staleConfirmations} need re-checking</Badge>}
                    </td>
                    <td className="px-5 py-4">
                      {supplier.deliversDirect ? <Badge tone="green">Delivers to customers</Badge> : <Badge>We collect</Badge>}
                      {supplier.leadTimeDays !== null && <p className="mt-1 text-xs text-[#64756A]">{supplier.leadTimeDays} day lead time</p>}
                    </td>
                    <td className="px-5 py-4">
                      <button type="button" className={secondaryButton} onClick={() => setEditing(supplier)}>
                        <Pencil size={15} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <SupplierForm
          supplier={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
      {viewing && <SupplierView id={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function SupplierForm({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(() =>
    supplier
      ? {
          name: supplier.name,
          contactPerson: supplier.contactPerson ?? '',
          phone: supplier.phone ?? '',
          email: supplier.email ?? '',
          location: supplier.location ?? '',
          notes: supplier.notes ?? '',
          deliversDirect: supplier.deliversDirect,
          leadTimeDays: supplier.leadTimeDays?.toString() ?? '',
          isActive: supplier.isActive,
        }
      : emptySupplier,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      await apiRequest(supplier ? `/api/suppliers/${supplier.id}` : '/api/suppliers', {
        method: supplier ? 'PUT' : 'POST',
        auth: true,
        body: { ...form, leadTimeDays: form.leadTimeDays === '' ? null : Number(form.leadTimeDays) },
      })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={supplier ? `Edit ${supplier.name}` : 'Add supplier'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">Business name *<input required value={form.name} onChange={set('name')} className={inputClass} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Contact person<input value={form.contactPerson} onChange={set('contactPerson')} className={inputClass} /></label>
          <label className="block text-sm font-medium">Phone<input type="tel" value={form.phone} onChange={set('phone')} className={inputClass} /></label>
          <label className="block text-sm font-medium">Email<input type="email" value={form.email} onChange={set('email')} className={inputClass} /></label>
          <label className="block text-sm font-medium">Location<input value={form.location} onChange={set('location')} placeholder="e.g. Kikuubo, Kampala" className={inputClass} /></label>
          <label className="block text-sm font-medium">Usual lead time (days)<input type="number" min="0" value={form.leadTimeDays} onChange={set('leadTimeDays')} className={inputClass} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.deliversDirect} onChange={(event) => setForm((current) => ({ ...current, deliversDirect: event.target.checked }))} />
          Can deliver directly to our customers
        </label>
        <label className="block text-sm font-medium">Notes<textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Payment terms, opening hours, who to call…" className={inputClass} /></label>
        {supplier && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            Active
          </label>
        )}
        <ErrorNote message={error} />
        <div className="flex justify-end gap-3">
          <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className={primaryButton}>{saving ? 'Saving…' : 'Save supplier'}</button>
        </div>
      </form>
    </Modal>
  )
}

function SupplierView({ id, onClose }: { id: string; onClose: () => void }) {
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<{ data: SupplierDetail }>(`/api/suppliers/${id}`, { auth: true })
      .then((result) => setSupplier(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load.'))
  }, [id])

  return (
    <Modal title={supplier?.name ?? 'Supplier'} onClose={onClose} wide>
      <ErrorNote message={error} />
      {!supplier && !error && <LoadingRows rows={3} />}
      {supplier && (
        <div className="space-y-4 text-sm">
          <p className="text-[#64756A]">
            {[supplier.contactPerson, supplier.phone, supplier.email, supplier.location].filter(Boolean).join(' · ')}
          </p>
          {supplier.notes && <p className="whitespace-pre-line rounded-lg bg-[#F5F8F6] p-3">{supplier.notes}</p>}
          <h3 className="flex items-center gap-2 font-semibold"><Truck size={16} /> Products from this supplier</h3>
          {supplier.products.length === 0 ? (
            <p className="text-[#64756A]">
              None yet. Add prices from <Link to="/admin/inventory" className="text-[#0B6843] underline">Inventory</Link>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead className="text-[#64756A]">
                  <tr>
                    <th className="py-2 font-medium">Product</th>
                    <th className="py-2 text-right font-medium">Wholesale</th>
                    <th className="py-2 text-right font-medium">Our price</th>
                    <th className="py-2 text-right font-medium">Stock</th>
                    <th className="py-2 font-medium">Confirmed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EEE9]">
                  {supplier.products.map((offer) => (
                    <tr key={offer.id}>
                      <td className="py-2">
                        {offer.product.name} {offer.isPreferred && <Badge tone="green">Preferred</Badge>}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatUGX(offer.wholesalePrice)}</td>
                      <td className="py-2 text-right tabular-nums">{formatUGX(offer.product.price)}</td>
                      <td className="py-2 text-right tabular-nums">{offer.availableQuantity}</td>
                      <td className="py-2">{daysAgo(offer.confirmedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
