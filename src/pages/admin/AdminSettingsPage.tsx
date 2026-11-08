import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { apiRequest, formatDateTime } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { Card, ErrorNote, LoadingRows, PageHeader, inputClass, primaryButton } from '../../components/admin/ui'

interface Settings {
  storeName: string
  storePhone: string
  staffAlertPhones: string[]
  freeDeliveryThreshold: number | null
  stockConfirmationDays: number
  collectionAddress: string
  returnWindowDays: number
  storeEmail: string
  taxId: string
  documentNote: string
}

interface Meta {
  smsConfigured: boolean
  paymentProvider: string | null
  mobileMoneyEnabled: boolean
}

interface AuditRow {
  id: string
  actor: string
  action: string
  entity: string
  entityId: string | null
  createdAt: string
}

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p className={`flex items-start gap-2 text-sm ${ok ? 'text-[#166534]' : 'text-amber-800'}`}>
      {ok ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
      <span>{children}</span>
    </p>
  )
}

export function AdminSettingsPage() {
  usePageTitle('Settings')
  const [form, setForm] = useState<Record<string, string> | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      apiRequest<{ data: Settings; meta: Meta }>('/api/store/settings', { auth: true }),
      apiRequest<{ data: AuditRow[] }>('/api/store/audit', { auth: true }),
    ])
      .then(([settings, log]) => {
        const data = settings.data
        setForm({
          storeName: data.storeName,
          storePhone: data.storePhone,
          staffAlertPhones: data.staffAlertPhones.map((phone) => phone.replace(/^\+256/, '0')).join(', '),
          freeDeliveryThreshold: data.freeDeliveryThreshold?.toString() ?? '',
          stockConfirmationDays: String(data.stockConfirmationDays),
          collectionAddress: data.collectionAddress,
          returnWindowDays: String(data.returnWindowDays),
          storeEmail: data.storeEmail ?? '',
          taxId: data.taxId ?? '',
          documentNote: data.documentNote ?? '',
        })
        setMeta(settings.meta)
        setAudit(log.data)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load settings.'))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    try {
      setSaving(true)
      setError('')
      setSaved(false)
      await apiRequest('/api/store/settings', {
        method: 'PUT',
        auth: true,
        body: {
          ...form,
          freeDeliveryThreshold: form.freeDeliveryThreshold || null,
          stockConfirmationDays: Number(form.stockConfirmationDays),
          returnWindowDays: Number(form.returnWindowDays),
        },
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string) => (event: { target: { value: string } }) => setForm((current) => (current ? { ...current, [key]: event.target.value } : current))

  return (
    <div className="space-y-6">
      <PageHeader section="Settings" title="Store settings" />
      <ErrorNote message={error} />

      {meta && (
        <Card className="space-y-2 p-5">
          <h2 className="mb-2 font-semibold">Connections</h2>
          <Status ok={meta.mobileMoneyEnabled && meta.paymentProvider === 'gateway'}>
            {meta.paymentProvider === 'gateway'
              ? 'Mobile money: live gateway connected.'
              : meta.paymentProvider === 'simulator'
                ? 'Mobile money: TEST MODE. Payments are simulated; no real money moves. Set PAYMENT_PROVIDER=gateway with your gateway keys to go live.'
                : 'Mobile money: off. Customers can pay cash on delivery or by bank transfer. Set PAYMENT_PROVIDER in server/.env to enable it.'}
          </Status>
          <Status ok={meta.smsConfigured}>
            {meta.smsConfigured
              ? 'SMS: Africa’s Talking connected. Customers and staff receive order messages.'
              : 'SMS: not connected. Messages are logged on each order but not sent. Add AT_USERNAME and AT_API_KEY to server/.env.'}
          </Status>
        </Card>
      )}

      {!form ? <Card><LoadingRows rows={4} /></Card> : (
        <Card className="p-5">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Store name<input required value={form.storeName} onChange={set('storeName')} className={inputClass} /></label>
            <label className="block text-sm font-medium">Customer help phone<input value={form.storePhone} onChange={set('storePhone')} placeholder="Shown on the site and in SMS" className={inputClass} /></label>
            <label className="block text-sm font-medium sm:col-span-2">
              Staff phones for new-order SMS alerts
              <input value={form.staffAlertPhones} onChange={set('staffAlertPhones')} placeholder="0772 123 456, 0701 234 567" className={inputClass} />
              <span className="mt-1 block text-xs font-normal text-[#64756A]">Separate numbers with commas. Each gets an SMS for every new order.</span>
            </label>
            <label className="block text-sm font-medium">Free delivery from (UGX)<input type="number" min="0" value={form.freeDeliveryThreshold} onChange={set('freeDeliveryThreshold')} placeholder="Off" className={inputClass} /></label>
            <label className="block text-sm font-medium">Collection address<input value={form.collectionAddress} onChange={set('collectionAddress')} placeholder="Where customers collect orders" className={inputClass} /></label>
            <label className="block text-sm font-medium">Supplier stock stays valid for (days)<input type="number" min="1" max="90" value={form.stockConfirmationDays} onChange={set('stockConfirmationDays')} className={inputClass} /></label>
            <label className="block text-sm font-medium">Return window (days after delivery)<input type="number" min="0" max="60" value={form.returnWindowDays} onChange={set('returnWindowDays')} className={inputClass} /></label>
            <p className="pt-2 text-sm font-semibold text-[#17241C] sm:col-span-2">Invoices and delivery notes</p>
            <label className="block text-sm font-medium">Store email<input type="email" value={form.storeEmail} onChange={set('storeEmail')} placeholder="Shown on documents" className={inputClass} /></label>
            <label className="block text-sm font-medium">URA TIN (optional)<input value={form.taxId} onChange={set('taxId')} placeholder="Taxpayer Identification Number" className={inputClass} /></label>
            <label className="block text-sm font-medium sm:col-span-2">
              Footer note
              <textarea rows={2} value={form.documentNote} onChange={set('documentNote')} placeholder="e.g. Warranty and return terms. Leave empty for the standard thank-you and returns note." className={inputClass} />
            </label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button type="submit" disabled={saving} className={primaryButton}>{saving ? 'Saving…' : 'Save settings'}</button>
              {saved && <span role="status" className="text-sm text-[#166534]">Saved.</span>}
            </div>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="border-b border-[#E7EEE9] px-5 py-4 font-semibold">Recent admin activity</h2>
        {audit.length === 0 ? <p className="p-5 text-sm text-[#64756A]">Nothing recorded yet.</p> : (
          <ul className="max-h-[420px] divide-y divide-[#E7EEE9] overflow-y-auto text-sm">
            {audit.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5">
                <span><strong>{row.actor}</strong> · {row.action.replace('.', ' ')} <span className="text-[#64756A]">{row.entity}</span></span>
                <span className="text-xs text-[#64756A]">{formatDateTime(row.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
