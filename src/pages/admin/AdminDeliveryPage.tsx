import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { apiRequest, formatUGX } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { Badge, Card, Empty, ErrorNote, LoadingRows, Modal, PageHeader, inputClass, primaryButton, secondaryButton } from '../../components/admin/ui'

interface Zone {
  id: string
  name: string
  fee: string
  estimatedTime: string | null
  isActive: boolean
  sortOrder: number
  _count: { orders: number }
}

export function AdminDeliveryPage() {
  usePageTitle('Delivery')
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Zone | 'new' | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await apiRequest<{ data: Zone[] }>('/api/store/delivery-zones', { auth: true })
      setZones(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load zones.')
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
        title="Delivery zones"
        text="Customers pick their zone at checkout and its fee is added to the order. Set the free-delivery threshold in Settings. Assign riders or supplier-direct delivery on each order."
        action={<button type="button" className={primaryButton} onClick={() => setEditing('new')}><Plus size={18} /> Add zone</button>}
      />
      <ErrorNote message={error} />
      <Card>
        {loading ? <LoadingRows /> : zones.length === 0 ? (
          <Empty>No zones yet. Until you add one, checkout charges no delivery fee and you confirm it by phone.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-[#F5F8F6] text-[#64756A]">
                <tr><th className="px-5 py-3 font-medium">Zone</th><th className="px-5 py-3 text-right font-medium">Fee</th><th className="px-5 py-3 font-medium">Delivery time</th><th className="px-5 py-3 text-right font-medium">Orders</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-[#E7EEE9]">
                {zones.map((zone) => (
                  <tr key={zone.id}>
                    <td className="px-5 py-3 font-medium">{zone.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{Number(zone.fee) === 0 ? 'Free' : formatUGX(zone.fee)}</td>
                    <td className="px-5 py-3">{zone.estimatedTime}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{zone._count.orders}</td>
                    <td className="px-5 py-3">{zone.isActive ? <Badge tone="green">Active</Badge> : <Badge>Hidden</Badge>}</td>
                    <td className="px-5 py-3 text-right"><button type="button" className={secondaryButton} onClick={() => setEditing(zone)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-sm text-[#64756A]">
        Dispatch and delivery details (rider, supplier-direct, cost, proof of delivery) are recorded on each order in <Link to="/admin/orders" className="text-[#0B6843] underline">Orders</Link>.
      </p>
      {editing && <ZoneForm zone={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load() }} />}
    </div>
  )
}

function ZoneForm({ zone, onClose, onSaved }: { zone: Zone | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    name: zone?.name ?? '',
    fee: zone ? String(Number(zone.fee)) : '',
    estimatedTime: zone?.estimatedTime ?? '',
    sortOrder: String(zone?.sortOrder ?? 0),
    isActive: zone?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      await apiRequest(zone ? `/api/store/delivery-zones/${zone.id}` : '/api/store/delivery-zones', {
        method: zone ? 'PUT' : 'POST',
        auth: true,
        body: { ...form, fee: Number(form.fee), sortOrder: Number(form.sortOrder || 0) },
      })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={zone ? `Edit ${zone.name}` : 'Add delivery zone'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">Zone name *<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Kampala Central" className={inputClass} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Fee (UGX) *<input required type="number" min="0" value={form.fee} onChange={(event) => setForm({ ...form, fee: event.target.value })} className={inputClass} /></label>
          <label className="block text-sm font-medium">Delivery time<input value={form.estimatedTime} onChange={(event) => setForm({ ...form, estimatedTime: event.target.value })} placeholder="e.g. Same day, 1–2 days" className={inputClass} /></label>
          <label className="block text-sm font-medium">Order in list<input type="number" min="0" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} className={inputClass} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Show at checkout</label>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-3">
          <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className={primaryButton}>{saving ? 'Saving…' : 'Save zone'}</button>
        </div>
      </form>
    </Modal>
  )
}
