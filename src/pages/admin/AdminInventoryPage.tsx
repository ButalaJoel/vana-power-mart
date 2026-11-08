import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { History, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { apiRequest, formatDateTime, formatUGX } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { Badge, Card, Empty, ErrorNote, LoadingRows, Modal, PageHeader, daysAgo, inputClass, primaryButton, secondaryButton } from '../../components/admin/ui'
import type { Supplier } from './AdminSuppliersPage'

interface Offer {
  supplierId: string
  supplierName: string
  wholesalePrice: number
  availableQuantity: number
  confirmedAt: string | null
  isPreferred: boolean
  leadTimeDays: number | null
  stale: boolean
}

interface InventoryRow {
  productId: string
  name: string
  sku: string
  category: string
  isActive: boolean
  sellingPrice: number
  quantity: number
  reservedQuantity: number
  reorderLevel: number
  supplierCount: number
  freshSupplierQuantity: number
  lastConfirmedAt: string | null
  stale: boolean
  noSupplier: boolean
  preferredSupplier: { id: string; name: string } | null
  unitCost: number | null
  unitMargin: number | null
  offers: Offer[]
}

type Filter = 'all' | 'low' | 'stale' | 'no-supplier'

export function AdminInventoryPage() {
  usePageTitle('Inventory')
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null)
  const [offering, setOffering] = useState<{ row: InventoryRow; offer?: Offer } | null>(null)
  const [history, setHistory] = useState<InventoryRow | null>(null)

  const load = useCallback(async () => {
    try {
      setError('')
      const result = await apiRequest<{ data: InventoryRow[]; meta: { stockConfirmationDays: number } }>('/api/inventory', { auth: true })
      setRows(result.data)
      setDays(result.meta.stockConfirmationDays)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inventory.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (query && !`${row.name} ${row.sku} ${row.category}`.toLowerCase().includes(query)) return false
      if (filter === 'low') return row.isActive && row.quantity - row.reservedQuantity <= row.reorderLevel
      if (filter === 'stale') return row.stale
      if (filter === 'no-supplier') return row.noSupplier && row.isActive
      return true
    })
  }, [rows, search, filter])

  const counts = {
    low: rows.filter((row) => row.isActive && row.quantity - row.reservedQuantity <= row.reorderLevel).length,
    stale: rows.filter((row) => row.stale).length,
    noSupplier: rows.filter((row) => row.noSupplier && row.isActive).length,
  }

  async function syncFromSuppliers(row: InventoryRow) {
    try {
      setError('')
      const result = await apiRequest<{ data: { quantity: number } }>(`/api/inventory/${row.productId}/sync-suppliers`, { method: 'POST', auth: true })
      setNotice(`${row.name}: sellable stock set to ${result.data.quantity} from supplier confirmations.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update stock.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        section="Operations"
        title="Inventory"
        text={`Sellable stock is what customers can buy now. Supplier stock is what suppliers last told you they have; confirmations older than ${days} days are flagged for re-checking.`}
      />
      <ErrorNote message={error} />
      {notice && <p role="status" className="rounded-lg bg-[#E6F4EA] p-3 text-sm text-[#166534]">{notice}</p>}

      <div className="flex flex-wrap gap-2">
        {([
          ['all', `All (${rows.length})`],
          ['low', `Low stock (${counts.low})`],
          ['stale', `Needs re-confirming (${counts.stale})`],
          ['no-supplier', `No supplier (${counts.noSupplier})`],
        ] as Array<[Filter, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1.5 text-sm ${filter === value ? 'border-[#064E32] bg-[#064E32] text-white' : 'border-[#D9E5DD] bg-white'}`}
          >
            {label}
          </button>
        ))}
        <label className="relative ml-auto min-w-[220px] flex-1 sm:flex-none">
          <span className="sr-only">Search products</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64756A]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, SKU, category" className="w-full rounded-lg border border-[#D9E5DD] py-2 pl-9 pr-3 text-sm" />
        </label>
      </div>

      <Card>
        {loading ? (
          <LoadingRows />
        ) : visible.length === 0 ? (
          <Empty>No products match.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-[#F5F8F6] text-[#64756A]">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 text-right font-medium">Sellable</th>
                  <th className="px-4 py-3 font-medium">Suppliers</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium">Cost</th>
                  <th className="px-4 py-3 text-right font-medium">Margin</th>
                  <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EEE9]">
                {visible.map((row) => {
                  const available = row.quantity - row.reservedQuantity
                  const low = available <= row.reorderLevel
                  return (
                    <tr key={row.productId} className={`align-top hover:bg-[#F8FAF8] ${row.isActive ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#17241C]">{row.name}</p>
                        <p className="text-xs text-[#64756A]">{row.sku} · {row.category}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-base font-semibold tabular-nums ${low ? 'text-amber-700' : ''}`}>{available}</span>
                        {low && <p className="text-xs text-amber-700">low (alert at {row.reorderLevel})</p>}
                      </td>
                      <td className="px-4 py-3">
                        {row.offers.length === 0 ? (
                          <Badge tone="amber">No supplier</Badge>
                        ) : (
                          <ul className="space-y-1">
                            {row.offers.map((offer) => (
                              <li key={offer.supplierId}>
                                <button type="button" onClick={() => setOffering({ row, offer })} className="text-left hover:underline">
                                  <span className="font-medium">{offer.supplierName}</span>
                                  {offer.isPreferred && <span className="ml-1 text-xs text-[#166534]">★</span>}
                                  <span className="block text-xs text-[#64756A]">
                                    {offer.availableQuantity} in stock · {formatUGX(offer.wholesalePrice)} ·{' '}
                                    <span className={offer.stale ? 'font-semibold text-amber-700' : ''}>{daysAgo(offer.confirmedAt)}</span>
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatUGX(row.sellingPrice)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.unitCost === null ? '—' : formatUGX(row.unitCost)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.unitMargin === null ? '—' : (
                          <span className={row.unitMargin < 0 ? 'font-semibold text-red-700' : ''}>
                            {formatUGX(row.unitMargin)}
                            <span className="block text-xs text-[#64756A]">{Math.round((row.unitMargin / row.sellingPrice) * 100)}%</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" className={secondaryButton} onClick={() => setAdjusting(row)}>
                            <SlidersHorizontal size={14} /> Adjust
                          </button>
                          <button type="button" className={secondaryButton} onClick={() => setOffering({ row })}>
                            <Plus size={14} /> Supplier price
                          </button>
                          {row.freshSupplierQuantity > 0 && row.freshSupplierQuantity !== row.quantity && (
                            <button type="button" className={secondaryButton} onClick={() => void syncFromSuppliers(row)} title="Set sellable stock to what suppliers confirmed">
                              <RefreshCw size={14} /> Use {row.freshSupplierQuantity}
                            </button>
                          )}
                          <button type="button" className={secondaryButton} onClick={() => setHistory(row)} aria-label={`Stock history for ${row.name}`}>
                            <History size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {adjusting && (
        <AdjustStock
          row={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={async (message) => {
            setAdjusting(null)
            setNotice(message)
            await load()
          }}
        />
      )}
      {offering && (
        <SupplierOffer
          row={offering.row}
          offer={offering.offer}
          onClose={() => setOffering(null)}
          onSaved={async (message) => {
            setOffering(null)
            setNotice(message)
            await load()
          }}
        />
      )}
      {history && <StockHistory row={history} onClose={() => setHistory(null)} />}
    </div>
  )
}

function AdjustStock({ row, onClose, onSaved }: { row: InventoryRow; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [mode, setMode] = useState<'set' | 'add'>('set')
  const [value, setValue] = useState(String(row.quantity))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      const result = await apiRequest<{ data: { quantity: number } }>(`/api/inventory/${row.productId}/adjust`, {
        method: 'POST',
        auth: true,
        body: mode === 'set' ? { set: Number(value), note } : { add: Number(value), note },
      })
      await onSaved(`${row.name}: sellable stock is now ${result.data.quantity}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to adjust stock.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Adjust stock: ${row.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-[#64756A]">Currently {row.quantity} sellable.</p>
        <div className="flex gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={mode === 'set'} onChange={() => { setMode('set'); setValue(String(row.quantity)) }} /> Set to</label>
          <label className="flex items-center gap-2"><input type="radio" checked={mode === 'add'} onChange={() => { setMode('add'); setValue('') }} /> Add or remove (use − to remove)</label>
        </div>
        <input required type="number" step="1" min={mode === 'set' ? 0 : undefined} value={value} onChange={(event) => setValue(event.target.value)} className={inputClass} aria-label="Quantity" />
        <label className="block text-sm font-medium">
          Reason
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Supplier confirmed by phone, stock count" className={inputClass} />
        </label>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-3">
          <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className={primaryButton}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

function SupplierOffer({ row, offer, onClose, onSaved }: { row: InventoryRow; offer?: Offer; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState(offer?.supplierId ?? '')
  const [price, setPrice] = useState(offer ? String(offer.wholesalePrice) : '')
  const [quantity, setQuantity] = useState(offer ? String(offer.availableQuantity) : '')
  const [leadTime, setLeadTime] = useState(offer?.leadTimeDays?.toString() ?? '')
  const [preferred, setPreferred] = useState(offer?.isPreferred ?? row.offers.length === 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<{ data: Supplier[] }>('/api/suppliers', { auth: true })
      .then((result) => setSuppliers(result.data.filter((supplier) => supplier.isActive || supplier.id === offer?.supplierId)))
      .catch(() => setError('Unable to load suppliers.'))
  }, [offer?.supplierId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      await apiRequest(`/api/suppliers/${supplierId}/products/${row.productId}`, {
        method: 'PUT',
        auth: true,
        body: {
          wholesalePrice: Number(price),
          availableQuantity: Number(quantity || 0),
          leadTimeDays: leadTime === '' ? null : Number(leadTime),
          isPreferred: preferred,
        },
      })
      await onSaved(`Saved supplier price for ${row.name}, confirmed today.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!offer) return
    try {
      setSaving(true)
      await apiRequest(`/api/suppliers/${offer.supplierId}/products/${row.productId}`, { method: 'DELETE', auth: true })
      await onSaved(`Removed ${offer.supplierName} from ${row.name}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove.')
      setSaving(false)
    }
  }

  return (
    <Modal title={`Supplier price: ${row.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">
          Supplier *
          <select required disabled={Boolean(offer)} value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={inputClass}>
            <option value="">Choose a supplier</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
          {suppliers.length === 0 && <span className="mt-1 block text-xs text-[#64756A]">Add suppliers on the Suppliers page first.</span>}
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">Wholesale price (UGX) *<input required type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} /></label>
          <label className="block text-sm font-medium">They have (units)<input type="number" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={inputClass} /></label>
          <label className="block text-sm font-medium">Lead time (days)<input type="number" min="0" value={leadTime} onChange={(event) => setLeadTime(event.target.value)} className={inputClass} /></label>
        </div>
        {price && <p className="text-xs text-[#64756A]">Our price {formatUGX(row.sellingPrice)} · margin {formatUGX(row.sellingPrice - Number(price))} per unit.</p>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferred} onChange={(event) => setPreferred(event.target.checked)} /> Preferred supplier for this product</label>
        <p className="text-xs text-[#64756A]">Saving marks this as confirmed today{offer?.confirmedAt ? ` (last: ${formatDateTime(offer.confirmedAt)})` : ''}.</p>
        <ErrorNote message={error} />
        <div className="flex justify-between gap-3">
          {offer ? <button type="button" onClick={() => void remove()} className="text-sm font-medium text-red-700">Remove supplier</button> : <span />}
          <div className="flex gap-3">
            <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving || !supplierId} className={primaryButton}>{saving ? 'Saving…' : 'Save and confirm'}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

const REASONS: Record<string, string> = {
  OPENING: 'Starting stock',
  ADJUSTMENT: 'Manual adjustment',
  ORDER: 'Order',
  CANCELLATION: 'Order cancelled / released',
  SUPPLIER_CONFIRMATION: 'From supplier confirmation',
  RETURN: 'Customer return',
}

function StockHistory({ row, onClose }: { row: InventoryRow; onClose: () => void }) {
  const [movements, setMovements] = useState<Array<{ id: string; change: number; quantityAfter: number; reason: string; note: string | null; actor: string | null; createdAt: string }> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<{ data: typeof movements }>(`/api/inventory/${row.productId}/movements`, { auth: true })
      .then((result) => setMovements(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load history.'))
  }, [row.productId])

  return (
    <Modal title={`Stock history: ${row.name}`} onClose={onClose} wide>
      <ErrorNote message={error} />
      {!movements && !error && <LoadingRows rows={3} />}
      {movements?.length === 0 && <Empty>No stock changes recorded yet.</Empty>}
      {movements && movements.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="text-[#64756A]">
            <tr><th className="py-2 font-medium">When</th><th className="py-2 font-medium">Reason</th><th className="py-2 text-right font-medium">Change</th><th className="py-2 text-right font-medium">After</th></tr>
          </thead>
          <tbody className="divide-y divide-[#E7EEE9]">
            {movements.map((movement) => (
              <tr key={movement.id}>
                <td className="py-2 text-xs">{formatDateTime(movement.createdAt)}<span className="block text-[#64756A]">{movement.actor}</span></td>
                <td className="py-2">{REASONS[movement.reason] ?? movement.reason}{movement.note && <span className="block text-xs text-[#64756A]">{movement.note}</span>}</td>
                <td className={`py-2 text-right tabular-nums ${movement.change < 0 ? 'text-red-700' : 'text-[#166534]'}`}>{movement.change > 0 ? '+' : ''}{movement.change}</td>
                <td className="py-2 text-right tabular-nums">{movement.quantityAfter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
