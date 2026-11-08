import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { apiRequest, formatDateTime, formatUGX } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { saleIsActive } from '../../services/productService'
import type { ApiProduct } from '../../types/catalog'
import { Badge, Card, Empty, ErrorNote, LoadingRows, Modal, PageHeader, inputClass, primaryButton, secondaryButton } from '../../components/admin/ui'

interface Voucher {
  id: string
  code: string
  description: string | null
  type: 'PERCENT' | 'FIXED'
  value: string
  minOrderAmount: string | null
  maxDiscount: string | null
  usageLimit: number | null
  usedCount: number
  startsAt: string | null
  endsAt: string | null
  isActive: boolean
}

function voucherState(voucher: Voucher) {
  const now = Date.now()
  if (!voucher.isActive) return <Badge>Off</Badge>
  if (voucher.endsAt && Date.parse(voucher.endsAt) <= now) return <Badge>Expired</Badge>
  if (voucher.startsAt && Date.parse(voucher.startsAt) > now) return <Badge tone="blue">Scheduled</Badge>
  if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) return <Badge>Used up</Badge>
  return <Badge tone="green">Live</Badge>
}

// datetime-local needs "YYYY-MM-DDTHH:mm" in local time.
export function toLocalInput(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function AdminPromotionsPage() {
  usePageTitle('Promotions')
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Voucher | 'new' | null>(null)

  const load = useCallback(async () => {
    try {
      const [voucherResult, productResult] = await Promise.all([
        apiRequest<{ data: Voucher[] }>('/api/store/vouchers', { auth: true }),
        apiRequest<{ data: ApiProduct[] }>('/api/products/admin/all', { auth: true }),
      ])
      setVouchers(voucherResult.data)
      setProducts(productResult.data.filter((product) => product.salePrice !== null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load promotions.')
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
        section="Marketing"
        title="Promotions"
        text="Voucher codes customers type at checkout, and flash sales shown on the home page with a countdown."
        action={<button type="button" className={primaryButton} onClick={() => setEditing('new')}><Plus size={18} /> New voucher</button>}
      />
      <ErrorNote message={error} />

      <Card>
        <h2 className="border-b border-[#E7EEE9] px-5 py-4 font-semibold">Voucher codes</h2>
        {loading ? <LoadingRows rows={3} /> : vouchers.length === 0 ? <Empty>No vouchers yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#F5F8F6] text-[#64756A]">
                <tr><th className="px-5 py-3 font-medium">Code</th><th className="px-5 py-3 font-medium">Discount</th><th className="px-5 py-3 font-medium">Conditions</th><th className="px-5 py-3 text-right font-medium">Used</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3"><span className="sr-only">Edit</span></th></tr>
              </thead>
              <tbody className="divide-y divide-[#E7EEE9]">
                {vouchers.map((voucher) => (
                  <tr key={voucher.id}>
                    <td className="px-5 py-3"><span className="font-mono font-semibold">{voucher.code}</span><span className="block text-xs text-[#64756A]">{voucher.description}</span></td>
                    <td className="px-5 py-3">{voucher.type === 'PERCENT' ? `${Number(voucher.value)}%` : formatUGX(voucher.value)}{voucher.maxDiscount && <span className="block text-xs text-[#64756A]">up to {formatUGX(voucher.maxDiscount)}</span>}</td>
                    <td className="px-5 py-3 text-xs text-[#64756A]">
                      {voucher.minOrderAmount && <span className="block">Min order {formatUGX(voucher.minOrderAmount)}</span>}
                      {voucher.endsAt && <span className="block">Ends {formatDateTime(voucher.endsAt)}</span>}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{voucher.usedCount}{voucher.usageLimit !== null ? ` / ${voucher.usageLimit}` : ''}</td>
                    <td className="px-5 py-3">{voucherState(voucher)}</td>
                    <td className="px-5 py-3 text-right"><button type="button" className={secondaryButton} onClick={() => setEditing(voucher)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="border-b border-[#E7EEE9] px-5 py-4 font-semibold">Flash sales</h2>
        <p className="px-5 pt-4 text-sm text-[#64756A]">
          Set a sale price and end time on any product in <Link to="/admin/products" className="text-[#0B6843] underline">Products</Link> (Edit → Flash sale).
        </p>
        {!loading && products.length === 0 ? <Empty>No products have a sale price.</Empty> : (
          <ul className="divide-y divide-[#E7EEE9] p-2">
            {products.map((product) => {
              const live = saleIsActive(product)
              const ended = product.saleEndsAt && Date.parse(product.saleEndsAt) <= Date.now()
              return (
                <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
                  <span className="font-medium">{product.name}</span>
                  <span className="tabular-nums">
                    {formatUGX(product.salePrice)} <span className="text-xs text-[#64756A] line-through">{formatUGX(product.variants[0]?.price ?? product.price)}</span>
                  </span>
                  <span className="text-xs text-[#64756A]">{product.saleEndsAt ? `until ${formatDateTime(product.saleEndsAt)}` : 'no end date'}</span>
                  {live ? <Badge tone="green">Running</Badge> : ended ? <Badge>Ended</Badge> : <Badge tone="blue">Scheduled</Badge>}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {editing && <VoucherForm voucher={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load() }} />}
    </div>
  )
}

function VoucherForm({ voucher, onClose, onSaved }: { voucher: Voucher | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    code: voucher?.code ?? '',
    description: voucher?.description ?? '',
    type: voucher?.type ?? 'PERCENT',
    value: voucher ? String(Number(voucher.value)) : '',
    minOrderAmount: voucher?.minOrderAmount ? String(Number(voucher.minOrderAmount)) : '',
    maxDiscount: voucher?.maxDiscount ? String(Number(voucher.maxDiscount)) : '',
    usageLimit: voucher?.usageLimit?.toString() ?? '',
    startsAt: toLocalInput(voucher?.startsAt),
    endsAt: toLocalInput(voucher?.endsAt),
    isActive: voucher?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      await apiRequest(voucher ? `/api/store/vouchers/${voucher.id}` : '/api/store/vouchers', {
        method: voucher ? 'PUT' : 'POST',
        auth: true,
        body: {
          ...form,
          value: Number(form.value),
          minOrderAmount: form.minOrderAmount || null,
          maxDiscount: form.maxDiscount || null,
          usageLimit: form.usageLimit || null,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        },
      })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={voucher ? `Edit ${voucher.code}` : 'New voucher'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Code *<input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="WELCOME10" className={`${inputClass} font-mono uppercase`} /></label>
          <label className="block text-sm font-medium">Description<input value={form.description} onChange={set('description')} placeholder="For first-time buyers" className={inputClass} /></label>
          <label className="block text-sm font-medium">Type
            <select value={form.type} onChange={set('type')} className={inputClass}><option value="PERCENT">Percentage off</option><option value="FIXED">Fixed amount off (UGX)</option></select>
          </label>
          <label className="block text-sm font-medium">{form.type === 'PERCENT' ? 'Percent *' : 'Amount (UGX) *'}<input required type="number" min="1" max={form.type === 'PERCENT' ? 100 : undefined} value={form.value} onChange={set('value')} className={inputClass} /></label>
          <label className="block text-sm font-medium">Minimum order (UGX)<input type="number" min="0" value={form.minOrderAmount} onChange={set('minOrderAmount')} className={inputClass} /></label>
          {form.type === 'PERCENT' && <label className="block text-sm font-medium">Maximum discount (UGX)<input type="number" min="0" value={form.maxDiscount} onChange={set('maxDiscount')} className={inputClass} /></label>}
          <label className="block text-sm font-medium">Total uses allowed<input type="number" min="1" value={form.usageLimit} onChange={set('usageLimit')} placeholder="Unlimited" className={inputClass} /></label>
          <label className="block text-sm font-medium">Starts<input type="datetime-local" value={form.startsAt} onChange={set('startsAt')} className={inputClass} /></label>
          <label className="block text-sm font-medium">Ends<input type="datetime-local" value={form.endsAt} onChange={set('endsAt')} className={inputClass} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-3">
          <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className={primaryButton}>{saving ? 'Saving…' : 'Save voucher'}</button>
        </div>
      </form>
    </Modal>
  )
}
