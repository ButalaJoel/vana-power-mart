import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest, formatDateTime, formatUGX, statusLabel } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { Badge, Card, Empty, ErrorNote, LoadingRows, Modal, PageHeader, inputClass, primaryButton, secondaryButton } from '../../components/admin/ui'

interface ReturnRow {
  id: string
  reason: string
  details: string | null
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'REFUNDED'
  refundAmount: string | null
  refundMethod: string | null
  adminNote: string | null
  createdAt: string
  order: {
    id: string
    orderNumber: string
    total: string
    paymentStatus: string
    deliveredAt: string | null
    customerName: string | null
    customerPhone: string | null
    items: Array<{ id: string; productName: string; quantity: number; unitPrice: string }>
  }
}

const TONE = { REQUESTED: 'amber', APPROVED: 'blue', REJECTED: 'gray', RECEIVED: 'blue', REFUNDED: 'green' } as const
const NEXT: Record<ReturnRow['status'], ReturnRow['status'][]> = {
  REQUESTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['RECEIVED', 'REJECTED'],
  RECEIVED: ['REFUNDED', 'REJECTED'],
  REJECTED: [],
  REFUNDED: [],
}

export function AdminReturnsPage() {
  usePageTitle('Returns')
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<ReturnRow | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await apiRequest<{ data: ReturnRow[] }>(`/api/returns/admin${status ? `?status=${status}` : ''}`, { auth: true })
      setRows(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load returns.')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <PageHeader section="Customers" title="Returns" text="Customers request returns from the tracking page within the return window. Approve, receive (optionally back into stock) and refund here; the customer gets an SMS at each step." />
      <ErrorNote message={error} />
      <div className="flex flex-wrap gap-2">
        {['', 'REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED', 'REJECTED'].map((value) => (
          <button key={value} type="button" onClick={() => setStatus(value)} className={`rounded-full border px-3 py-1.5 text-sm ${status === value ? 'border-[#064E32] bg-[#064E32] text-white' : 'border-[#D9E5DD] bg-white'}`}>
            {value ? statusLabel(value) : 'All'}
          </button>
        ))}
      </div>
      <Card>
        {loading ? <LoadingRows /> : rows.length === 0 ? <Empty>No returns.</Empty> : (
          <ul className="divide-y divide-[#E7EEE9]">
            {rows.map((row) => (
              <li key={row.id}>
                <button type="button" onClick={() => setOpen(row)} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#F8FAF8]">
                  <div>
                    <p className="font-medium">{row.order.orderNumber} · {row.order.customerName}</p>
                    <p className="text-sm text-[#64756A]">{row.reason} · {formatDateTime(row.createdAt)}</p>
                  </div>
                  <Badge tone={TONE[row.status]}>{statusLabel(row.status)}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {open && <ReturnDetail row={open} onClose={() => setOpen(null)} onSaved={async () => { setOpen(null); await load() }} />}
    </div>
  )
}

function ReturnDetail({ row, onClose, onSaved }: { row: ReturnRow; onClose: () => void; onSaved: () => Promise<void> }) {
  const [next, setNext] = useState<ReturnRow['status'] | ''>('')
  const [note, setNote] = useState(row.adminNote ?? '')
  const [restock, setRestock] = useState(true)
  const [refundAmount, setRefundAmount] = useState(String(Number(row.refundAmount ?? row.order.total)))
  const [refundMethod, setRefundMethod] = useState(row.refundMethod ?? 'Mobile money')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      await apiRequest(`/api/returns/admin/${row.id}`, {
        method: 'PATCH',
        auth: true,
        body: {
          adminNote: note,
          ...(next ? { status: next } : {}),
          ...(next === 'RECEIVED' ? { restock } : {}),
          ...(next === 'REFUNDED' ? { refundAmount: Number(refundAmount), refundMethod } : {}),
        },
      })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Return · ${row.order.orderNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 text-sm">
        <div className="rounded-lg bg-[#F5F8F6] p-3">
          <p><strong>{row.reason}</strong></p>
          {row.details && <p className="mt-1 whitespace-pre-line">{row.details}</p>}
          <p className="mt-2 text-xs text-[#64756A]">
            {row.order.customerName} · <a className="underline" href={`tel:${row.order.customerPhone}`}>{row.order.customerPhone}</a> · delivered {formatDateTime(row.order.deliveredAt)}
          </p>
        </div>
        <ul className="text-xs text-[#64756A]">
          {row.order.items.map((item) => <li key={item.id}>{item.quantity} × {item.productName} ({formatUGX(item.unitPrice)})</li>)}
        </ul>
        <p>Status: <Badge tone={TONE[row.status]}>{statusLabel(row.status)}</Badge> · <Link to={`/admin/orders?search=${row.order.orderNumber}`} className="text-[#0B6843] underline">Open order</Link></p>

        {NEXT[row.status].length > 0 && (
          <label className="block font-medium">Move to
            <select value={next} onChange={(event) => setNext(event.target.value as ReturnRow['status'])} className={inputClass}>
              <option value="">Keep as {statusLabel(row.status)}</option>
              {NEXT[row.status].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
            </select>
          </label>
        )}
        {next === 'RECEIVED' && <label className="flex items-center gap-2"><input type="checkbox" checked={restock} onChange={(event) => setRestock(event.target.checked)} /> Put the items back into sellable stock</label>}
        {next === 'REFUNDED' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block font-medium">Refund amount (UGX)<input type="number" min="0" max={Number(row.order.total)} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} className={inputClass} /></label>
            <label className="block font-medium">Refunded by<input value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)} className={inputClass} /></label>
            <p className="text-xs text-[#64756A] sm:col-span-2">Send the money first (e.g. mobile money), then record it here. A full refund marks the order Refunded.</p>
          </div>
        )}
        <label className="block font-medium">Internal note<textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} /></label>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-3">
          <button type="button" className={secondaryButton} onClick={onClose}>Close</button>
          <button type="submit" disabled={saving} className={primaryButton}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}
