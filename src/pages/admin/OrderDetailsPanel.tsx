import { useEffect, useState, type FormEvent } from 'react'
import { Download, FileText, MessageSquare, Printer, Share2, X } from 'lucide-react'
import { API_URL, apiRequest, formatDateTime, formatUGX, getAdminToken, statusLabel } from '../../lib/api'
import { Badge, ErrorNote, inputClass, primaryButton, secondaryButton } from '../../components/admin/ui'
import type { Supplier } from './AdminSuppliersPage'
import { ORDER_STATUSES, PAYMENT_STATUSES, StatusBadge, type AdminOrder, type AdminOrderItem } from './AdminOrdersPage'

const PROCUREMENT_STATUSES = ['PENDING', 'REQUESTED', 'CONFIRMED', 'UNAVAILABLE', 'COLLECTED', 'SUPPLIER_DISPATCHED', 'RECEIVED']
const PROCUREMENT_HELP: Record<string, string> = {
  PENDING: 'Not yet contacted',
  REQUESTED: 'Asked the supplier',
  CONFIRMED: 'Supplier confirmed availability',
  UNAVAILABLE: 'Supplier does not have it',
  COLLECTED: 'We collected it',
  SUPPLIER_DISPATCHED: 'Supplier is delivering to the customer',
  RECEIVED: 'Item is with us',
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E2EAE4] p-4 text-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[#17241C]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function OrderDetails({ order, onClose, onUpdated }: { order: AdminOrder; onClose: () => void; onUpdated: (order: AdminOrder) => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  useEffect(() => {
    apiRequest<{ data: Supplier[] }>('/api/suppliers', { auth: true })
      .then((result) => setSuppliers(result.data.filter((supplier) => supplier.isActive)))
      .catch(() => setSuppliers([]))
  }, [])

  async function reload() {
    const result = await apiRequest<{ data: AdminOrder }>(`/api/orders/${order.id}`, { auth: true })
    onUpdated(result.data)
  }

  const phone = order.customerPhone ?? order.customer.phone

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-labelledby="order-title" className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#D9E5DD] bg-white p-5">
          <div className="min-w-0">
            <h2 id="order-title" className="truncate text-lg font-bold text-[#17241C]">{order.orderNumber}</h2>
            <p className="text-sm text-[#64756A]">Placed {formatDateTime(order.createdAt)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge value={order.status} />
              <StatusBadge value={order.paymentStatus} />
              <Badge>{order.paymentMethod.replace(/-/g, ' ')}</Badge>
            </div>
          </div>
          <button type="button" aria-label="Close order details" onClick={onClose} className="rounded-lg p-2 text-[#64756A] hover:bg-[#F5F8F6]">
            <X size={20} />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <StatusForm order={order} onSaved={onUpdated} />

          <Section title="Customer">
            <p>{order.customerName ?? `${order.customer.firstName} ${order.customer.lastName}`}</p>
            <p className="mt-1"><a href={`tel:${phone}`} className="text-[#0B6843] underline">{phone}</a>
              {' · '}<a href={`https://wa.me/${phone.replace('+', '')}`} target="_blank" rel="noreferrer" className="text-[#0B6843] underline">WhatsApp</a></p>
            {(order.customerEmail ?? order.customer.email) && <p className="mt-1">{order.customerEmail ?? order.customer.email}</p>}
          </Section>

          <Section title={`Items and suppliers (${order.items.length})`}>
            <ul className="space-y-4">
              {order.items.map((item) => <ProcurementRow key={item.id} item={item} suppliers={suppliers} onSaved={reload} />)}
            </ul>
          </Section>

          <DeliverySection order={order} onSaved={onUpdated} />

          <DocumentsSection order={order} />

          <Section title="Money">
            <div className="space-y-1">
              <Row label="Items" value={formatUGX(order.subtotal)} />
              {Number(order.discountAmount) > 0 && <Row label={`Voucher ${order.voucher?.code ?? ''}`} value={`−${formatUGX(order.discountAmount)}`} />}
              <Row label={`Delivery fee${order.deliveryZone ? ` (${order.deliveryZone.name})` : ''}`} value={formatUGX(order.deliveryFee)} />
              <Row label="Customer pays" value={formatUGX(order.total)} strong />
              <div className="my-2 border-t border-[#E7EEE9]" />
              <Row label="Cost of goods (suppliers)" value={`−${formatUGX(order.profit.goodsCost)}`} />
              <Row label="Delivery cost" value={`−${formatUGX(order.profit.deliveryCost)}`} />
              <Row
                label="Gross profit"
                value={`${formatUGX(order.profit.grossProfit)}${order.profit.marginPercent !== null ? ` (${order.profit.marginPercent}%)` : ''}`}
                strong
                tone={order.profit.grossProfit < 0 ? 'text-red-700' : 'text-[#166534]'}
              />
              {!order.profit.costComplete && <p className="text-xs text-amber-700">Incomplete: add a supplier cost for every item and the delivery cost.</p>}
            </div>
            {order.payments.length > 0 && (
              <div className="mt-3 border-t border-[#E7EEE9] pt-3">
                <p className="mb-1 font-medium">Payments</p>
                <ul className="space-y-1 text-xs">
                  {order.payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap justify-between gap-2">
                      <span>{payment.method.replace(/-/g, ' ')} · {payment.provider}{payment.phone ? ` · ${payment.phone}` : ''}<span className="block text-[#64756A]">{payment.providerReference ?? payment.merchantReference}</span></span>
                      <span className="text-right">{formatUGX(payment.amount)} <StatusBadge value={payment.status} />{payment.failureReason && <span className="block text-red-700">{payment.failureReason}</span>}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section title="Delivery address and notes">
            <p>{order.deliveryMethod === 'collection' ? 'Customer collects' : order.deliveryAddress}</p>
            {order.deliveryArea && <p className="mt-1 text-[#64756A]">{order.deliveryArea}</p>}
            {order.customerNotes && <p className="mt-3 whitespace-pre-line rounded-lg bg-[#F5F8F6] p-3">{order.customerNotes}</p>}
          </Section>

          <MessagesSection order={order} onSent={reload} />

          <Section title="History">
            <ol className="space-y-2 text-xs">
              {order.statusHistory.map((entry) => (
                <li key={entry.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    <strong>{statusLabel(entry.status)}</strong>
                    {entry.paymentStatus && ` · payment ${statusLabel(entry.paymentStatus).toLowerCase()}`}
                    {entry.note && <span className="block text-[#64756A]">{entry.note}</span>}
                  </span>
                  <span className="text-right text-[#64756A]">{formatDateTime(entry.createdAt)}<span className="block">{entry.actor}</span></span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </aside>
    </div>
  )
}

function Row({ label, value, strong = false, tone = '' }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'font-semibold' : ''} ${tone}`}>
      <span className={strong ? '' : 'text-[#64756A]'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function StatusForm({ order, onSaved }: { order: AdminOrder; onSaved: (order: AdminOrder) => void }) {
  const [status, setStatus] = useState(order.status)
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus)
  const [reason, setReason] = useState(order.cancellationReason ?? '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setStatus(order.status)
    setPaymentStatus(order.paymentStatus)
  }, [order])

  const cancelled = order.status === 'CANCELLED'
  const changed = status !== order.status || paymentStatus !== order.paymentStatus || note.trim() !== ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      setSaved(false)
      const result = await apiRequest<{ data: AdminOrder }>(`/api/orders/${order.id}`, {
        method: 'PATCH',
        auth: true,
        body: {
          ...(status !== order.status ? { status } : {}),
          ...(paymentStatus !== order.paymentStatus ? { paymentStatus } : {}),
          ...(status === 'CANCELLED' ? { cancellationReason: reason } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      })
      onSaved(result.data)
      setNote('')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border-2 border-[#064E32]/20 bg-[#F8FBF9] p-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-[#64756A]">Order status
          <select value={status} disabled={cancelled} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
            {ORDER_STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-[#64756A]">Payment status
          <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className={inputClass}>
            {PAYMENT_STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </select>
        </label>
      </div>
      {status === 'CANCELLED' && !cancelled && (
        <label className="mt-3 block text-xs font-medium text-[#64756A]">Reason for cancelling (sent to the customer) *
          <input required value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} placeholder="e.g. Out of stock at all suppliers" />
        </label>
      )}
      <label className="mt-3 block text-xs font-medium text-[#64756A]">Note for the history (optional)
        <input value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} placeholder="e.g. Called customer, confirmed delivery Saturday" />
      </label>
      <p className="mt-2 text-xs text-[#64756A]">
        {cancelled
          ? 'Cancelled orders cannot be reopened.'
          : paymentStatus === 'PAID' && order.paymentStatus !== 'PAID'
            ? 'Marking paid records a manual payment (cash or bank). Mobile money is marked paid automatically.'
            : order.status === 'AWAITING_STOCK' && status !== 'AWAITING_STOCK' && status !== 'CANCELLED'
              ? 'Moving on takes the items from sellable stock. Record stock in Inventory first.'
              : 'The customer gets an SMS when the status changes to confirmed, packed, on the way, delivered or cancelled.'}
      </p>
      <ErrorNote message={error} />
      {saved && !changed && <p role="status" className="mt-2 text-sm text-[#166534]">Order updated.</p>}
      <button type="submit" disabled={!changed || saving} className={`mt-3 w-full ${primaryButton}`}>{saving ? 'Saving…' : 'Save changes'}</button>
    </form>
  )
}

function ProcurementRow({ item, suppliers, onSaved }: { item: AdminOrderItem; suppliers: Supplier[]; onSaved: () => Promise<void> }) {
  const procurement = item.procurement
  const [supplierId, setSupplierId] = useState(procurement?.supplier?.id ?? '')
  const [status, setStatus] = useState(procurement?.status ?? 'PENDING')
  const [unitCost, setUnitCost] = useState(procurement?.unitCost ? String(Number(procurement.unitCost)) : '')
  const [notes, setNotes] = useState(procurement?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSupplierId(procurement?.supplier?.id ?? '')
    setStatus(procurement?.status ?? 'PENDING')
    setUnitCost(procurement?.unitCost ? String(Number(procurement.unitCost)) : '')
    setNotes(procurement?.notes ?? '')
  }, [procurement])

  const dirty =
    supplierId !== (procurement?.supplier?.id ?? '') ||
    status !== (procurement?.status ?? 'PENDING') ||
    unitCost !== (procurement?.unitCost ? String(Number(procurement.unitCost)) : '') ||
    notes !== (procurement?.notes ?? '')

  async function save() {
    try {
      setSaving(true)
      setError('')
      const supplierChanged = supplierId !== (procurement?.supplier?.id ?? '')
      await apiRequest(`/api/orders/items/${item.id}/procurement`, {
        method: 'PATCH',
        auth: true,
        body: {
          supplierId: supplierId || null,
          status,
          notes,
          // Leave the cost empty when switching supplier to use their listed price.
          ...(unitCost !== '' || !supplierChanged ? { unitCost: unitCost === '' ? null : Number(unitCost) } : {}),
        },
      })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  const supplier = suppliers.find((entry) => entry.id === supplierId) ?? procurement?.supplier

  return (
    <li className="rounded-lg bg-[#F8FAF8] p-3">
      <div className="flex gap-3">
        {item.product.imageUrls[0] && <img src={item.product.imageUrls[0]} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain" />}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{item.productName}</p>
          <p className="text-xs text-[#64756A]">SKU {item.variant?.sku ?? item.product.sku} · {item.quantity} × {formatUGX(item.unitPrice)}</p>
        </div>
        <p className="shrink-0 font-medium tabular-nums">{formatUGX(Number(item.unitPrice) * item.quantity)}</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-[#64756A]">Supplier
          <select value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setUnitCost('') }} className={inputClass}>
            <option value="">Not chosen</option>
            {suppliers.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-[#64756A]">Cost per unit (UGX)
          <input type="number" min="0" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} placeholder={supplierId ? 'Supplier price' : ''} className={inputClass} />
        </label>
        <label className="text-xs text-[#64756A]">Sourcing status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
            {PROCUREMENT_STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </select>
        </label>
      </div>
      <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes (e.g. collect from Kikuubo shop 12 at 2pm)" className={`${inputClass} text-xs`} aria-label="Sourcing notes" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64756A]">
        <span>
          {PROCUREMENT_HELP[status]}
          {supplier?.phone && <> · <a href={`tel:${supplier.phone}`} className="text-[#0B6843] underline">Call {supplier.name}</a></>}
          {supplier && 'deliversDirect' in supplier && supplier.deliversDirect && ' · can deliver direct'}
        </span>
        {dirty && <button type="button" onClick={() => void save()} disabled={saving} className={secondaryButton}>{saving ? 'Saving…' : 'Save item'}</button>}
      </div>
      <ErrorNote message={error} />
    </li>
  )
}

function DeliverySection({ order, onSaved }: { order: AdminOrder; onSaved: (order: AdminOrder) => void }) {
  const initial = () => ({
    fulfilledBy: order.fulfilledBy ?? '',
    deliveryAssignee: order.deliveryAssignee ?? '',
    deliveryAssigneePhone: order.deliveryAssigneePhone?.replace(/^\+256/, '0') ?? '',
    deliveryCost: order.deliveryCost ? String(Number(order.deliveryCost)) : '',
    deliveryProof: order.deliveryProof ?? '',
    internalNotes: order.internalNotes ?? '',
  })
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setForm(initial()), [order])

  const set = (key: keyof ReturnType<typeof initial>) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      const result = await apiRequest<{ data: AdminOrder }>(`/api/orders/${order.id}`, {
        method: 'PATCH',
        auth: true,
        body: { ...form, fulfilledBy: form.fulfilledBy || null, deliveryCost: form.deliveryCost === '' ? null : Number(form.deliveryCost) },
      })
      onSaved(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title={order.deliveryMethod === 'collection' ? 'Collection' : 'Delivery'}>
      <form onSubmit={submit} className="space-y-3">
        {order.deliveryMethod === 'delivery' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-[#64756A]">Delivered by
              <select value={form.fulfilledBy} onChange={set('fulfilledBy')} className={inputClass}>
                <option value="">Not assigned</option>
                <option value="VANA">Our rider</option>
                <option value="COURIER">Courier / boda</option>
                <option value="SUPPLIER">Supplier delivers direct</option>
              </select>
            </label>
            <label className="text-xs text-[#64756A]">What delivery costs us (UGX)
              <input type="number" min="0" value={form.deliveryCost} onChange={set('deliveryCost')} className={inputClass} />
            </label>
            <label className="text-xs text-[#64756A]">Rider / driver name
              <input value={form.deliveryAssignee} onChange={set('deliveryAssignee')} className={inputClass} />
            </label>
            <label className="text-xs text-[#64756A]">Rider phone (shared with customer)
              <input type="tel" value={form.deliveryAssigneePhone} onChange={set('deliveryAssigneePhone')} className={inputClass} />
            </label>
          </div>
        )}
        <label className="block text-xs text-[#64756A]">Proof of {order.deliveryMethod === 'collection' ? 'collection' : 'delivery'}
          <input value={form.deliveryProof} onChange={set('deliveryProof')} placeholder="e.g. Received by Jane, ID checked, photo on WhatsApp" className={inputClass} />
        </label>
        <label className="block text-xs text-[#64756A]">Internal notes (not shown to customer)
          <textarea rows={2} value={form.internalNotes} onChange={set('internalNotes')} className={inputClass} />
        </label>
        <p className="text-xs text-[#64756A]">
          {order.dispatchedAt ? `Dispatched ${formatDateTime(order.dispatchedAt)}. ` : ''}
          {order.deliveredAt ? `Delivered ${formatDateTime(order.deliveredAt)}.` : 'Dispatch and delivery times are recorded when you set the status.'}
        </p>
        <ErrorNote message={error} />
        <button type="submit" disabled={saving} className={secondaryButton}>{saving ? 'Saving…' : 'Save delivery details'}</button>
      </form>
    </Section>
  )
}

function MessagesSection({ order, onSent }: { order: AdminOrder; onSent: () => Promise<void> }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setSending(true)
      setError('')
      await apiRequest(`/api/orders/${order.id}/sms`, { method: 'POST', auth: true, body: { message } })
      setMessage('')
      await onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Section title="SMS messages">
      <ul className="max-h-60 space-y-2 overflow-y-auto text-xs">
        {order.notifications.length === 0 && <li className="text-[#64756A]">None yet.</li>}
        {order.notifications.map((note) => (
          <li key={note.id} className="rounded-lg bg-[#F8FAF8] p-2">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{note.recipient}</span>
              <span>
                <Badge tone={note.status === 'SENT' ? 'green' : note.status === 'SKIPPED' ? 'gray' : 'red'}>
                  {note.status === 'SKIPPED' ? 'Not sent (SMS off)' : statusLabel(note.status)}
                </Badge>{' '}
                <span className="text-[#64756A]">{formatDateTime(note.createdAt)}</span>
              </span>
            </div>
            <p className="mt-1">{note.message}</p>
            {note.error && note.status === 'FAILED' && <p className="text-red-700">{note.error}</p>}
          </li>
        ))}
      </ul>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input required maxLength={459} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Send the customer a message" aria-label="Message to customer" className={`${inputClass} mt-0`} />
        <button type="submit" disabled={sending} className={secondaryButton}><MessageSquare size={15} />{sending ? '…' : 'Send'}</button>
      </form>
      <ErrorNote message={error} />
    </Section>
  )
}

type DocType = 'invoice' | 'delivery-note'
const DOC_LABELS: Record<DocType, string> = { invoice: 'Invoice / receipt', 'delivery-note': 'Delivery note' }

async function fetchDocument(orderId: string, type: DocType) {
  const response = await fetch(`${API_URL}/api/orders/${encodeURIComponent(orderId)}/document?type=${type}`, {
    headers: { Authorization: `Bearer ${getAdminToken() ?? ''}` },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? 'Unable to create the document.')
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? `${type}.pdf`
  return { blob: await response.blob(), name }
}

// Print, download or share the invoice and delivery note. The documents are
// built from the saved order each time, so this order is the shop's copy.
function DocumentsSection({ order }: { order: AdminOrder }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const phone = (order.customerPhone ?? order.customer.phone).replace('+', '')

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return
    try {
      setBusy(key)
      setError('')
      setNotice('')
      await action()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy('')
    }
  }

  const print = (type: DocType) =>
    run(`print-${type}`, async () => {
      const { blob } = await fetchDocument(order.id, type)
      const url = URL.createObjectURL(blob)
      // Opens the PDF in a new tab, where it can be printed.
      const tab = window.open(url, '_blank')
      if (!tab) setNotice('Allow pop-ups for this site to open documents in a new tab.')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    })

  const download = (type: DocType) =>
    run(`download-${type}`, async () => {
      const { blob, name } = await fetchDocument(order.id, type)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    })

  // Phones share the PDF file itself (WhatsApp, email...). Computers send the
  // customer a WhatsApp message with a link to their invoice instead.
  const share = (type: DocType) =>
    run(`share-${type}`, async () => {
      const { blob, name } = await fetchDocument(order.id, type)
      const file = new File([blob], name, { type: 'application/pdf' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name, text: `${DOC_LABELS[type]} for order ${order.orderNumber}` })
        return
      }
      const links = await apiRequest<{ data: { invoice: string; deliveryNote: string } }>(
        `/api/orders/${encodeURIComponent(order.id)}/document-links`,
        { auth: true },
      )
      const link = type === 'invoice' ? links.data.invoice : links.data.deliveryNote
      const message = `Hello, here is your ${DOC_LABELS[type].toLowerCase()} for order ${order.orderNumber} from Vana Power Mart: ${link}`
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
    })

  const copyLink = () =>
    run('copy', async () => {
      const links = await apiRequest<{ data: { invoice: string } }>(`/api/orders/${encodeURIComponent(order.id)}/document-links`, { auth: true })
      await navigator.clipboard.writeText(links.data.invoice)
      setNotice('Invoice link copied. Paste it into WhatsApp, SMS or email.')
    })

  return (
    <Section title="Documents">
      <p className="mb-3 text-xs text-[#64756A]">
        Print the delivery note for the rider (the customer signs it), and give or send the customer their invoice. It becomes a receipt once the order is paid.
      </p>
      <div className="space-y-3">
        {(['delivery-note', 'invoice'] as DocType[]).map((type) => (
          <div key={type} className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-36 items-center gap-1.5 font-medium"><FileText size={15} /> {DOC_LABELS[type]}</span>
            <button type="button" disabled={Boolean(busy)} onClick={() => void print(type)} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
              <Printer size={14} /> {busy === `print-${type}` ? 'Opening…' : 'Print'}
            </button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void download(type)} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
              <Download size={14} /> {busy === `download-${type}` ? 'Preparing…' : 'Download'}
            </button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void share(type)} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
              <Share2 size={14} /> {busy === `share-${type}` ? 'Preparing…' : 'Share'}
            </button>
          </div>
        ))}
        <button type="button" disabled={Boolean(busy)} onClick={() => void copyLink()} className="text-xs font-semibold text-[#0B6843] underline">
          Copy the customer's invoice link
        </button>
      </div>
      {notice && <p className="mt-2 text-xs text-[#0B6843]">{notice}</p>}
      {error && <div className="mt-2"><ErrorNote message={error} /></div>}
    </Section>
  )
}
