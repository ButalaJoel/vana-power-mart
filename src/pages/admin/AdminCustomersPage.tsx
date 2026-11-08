import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { apiRequest, formatDateTime, formatUGX } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { Stars } from '../../components/store/ProductReviews'
import { Badge, Card, Empty, ErrorNote, LoadingRows, PageHeader, secondaryButton } from '../../components/admin/ui'

interface CustomerRow {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string | null
  createdAt: string
  hasAccount: boolean
  orderCount: number
  totalSpent: number
  lastOrderAt: string | null
}

interface ReviewRow {
  id: string
  rating: number
  title: string | null
  body: string | null
  isVerified: boolean
  isVisible: boolean
  createdAt: string
  product: { name: string; slug: string }
  customer: { firstName: string; lastName: string; phone: string }
}

export function AdminCustomersPage() {
  usePageTitle('Customers')
  const [tab, setTab] = useState<'customers' | 'reviews'>('customers')

  return (
    <div className="space-y-6">
      <PageHeader section="Customers" title={tab === 'customers' ? 'Customers' : 'Product reviews'} />
      <div className="flex gap-2">
        {(['customers', 'reviews'] as const).map((value) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-full border px-4 py-1.5 text-sm ${tab === value ? 'border-[#064E32] bg-[#064E32] text-white' : 'border-[#D9E5DD] bg-white'}`}>
            {value === 'customers' ? 'Customers' : 'Reviews'}
          </button>
        ))}
      </div>
      {tab === 'customers' ? <CustomerList /> : <ReviewList />}
    </div>
  )
}

function CustomerList() {
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const result = await apiRequest<{ data: CustomerRow[] }>(`/api/customers${query ? `?search=${encodeURIComponent(query)}` : ''}`, { auth: true })
      setRows(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load customers.')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(search.trim())
  }

  return (
    <>
      <ErrorNote message={error} />
      <form onSubmit={submit} className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64756A]" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone or email" aria-label="Search customers" className="w-full rounded-lg border border-[#D9E5DD] py-2.5 pl-9 pr-3 text-sm" />
      </form>
      <Card>
        {loading ? <LoadingRows /> : rows.length === 0 ? <Empty>No customers yet. They're created when someone places an order or signs up.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#F5F8F6] text-[#64756A]">
                <tr><th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Contact</th><th className="px-5 py-3 text-right font-medium">Orders</th><th className="px-5 py-3 text-right font-medium">Spent</th><th className="px-5 py-3 font-medium">Last order</th></tr>
              </thead>
              <tbody className="divide-y divide-[#E7EEE9]">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{row.firstName} {row.lastName}</p>
                      {row.hasAccount ? <Badge tone="green">Account</Badge> : <Badge>Guest</Badge>}
                    </td>
                    <td className="px-5 py-3"><a href={`tel:${row.phone}`} className="text-[#0B6843] underline">{row.phone}</a>{row.email && <span className="block text-xs text-[#64756A]">{row.email}</span>}</td>
                    <td className="px-5 py-3 text-right tabular-nums"><Link to={`/admin/orders?search=${encodeURIComponent(row.phone.replace('+256', ''))}`} className="underline">{row.orderCount}</Link></td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatUGX(row.totalSpent)}</td>
                    <td className="px-5 py-3 text-xs">{formatDateTime(row.lastOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

function ReviewList() {
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await apiRequest<{ data: ReviewRow[] }>('/api/reviews/admin', { auth: true })
      setRows(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reviews.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(row: ReviewRow) {
    try {
      await apiRequest(`/api/reviews/admin/${row.id}`, { method: 'PATCH', auth: true, body: { isVisible: !row.isVisible } })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update.')
    }
  }

  return (
    <>
      <ErrorNote message={error} />
      <Card>
        {!rows ? <LoadingRows /> : rows.length === 0 ? <Empty>No reviews yet.</Empty> : (
          <ul className="divide-y divide-[#E7EEE9]">
            {rows.map((row) => (
              <li key={row.id} className={`flex flex-wrap items-start justify-between gap-3 px-5 py-4 text-sm ${row.isVisible ? '' : 'opacity-60'}`}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2"><Stars value={row.rating} size={14} /> <strong>{row.title}</strong> {row.isVerified && <Badge tone="green">Verified</Badge>}</p>
                  {row.body && <p className="mt-1">{row.body}</p>}
                  <p className="mt-1 text-xs text-[#64756A]">{row.customer.firstName} {row.customer.lastName} · {row.product.name} · {formatDateTime(row.createdAt)}</p>
                </div>
                <button type="button" className={secondaryButton} onClick={() => void toggle(row)}>{row.isVisible ? 'Hide' : 'Show'}</button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
