import { useEffect, type ReactNode } from 'react'
import { AlertCircle, X } from 'lucide-react'

// Small shared building blocks for admin pages, matching the existing style.

export const inputClass =
  'mt-1 w-full rounded-lg border border-[#D9E5DD] bg-white px-3 py-2.5 text-sm font-normal text-[#17241C] outline-none focus:border-[#0B6843] focus:ring-2 focus:ring-[#0B6843]/10'
export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#064E32] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B6843] disabled:opacity-50'
export const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-[#D9E5DD] bg-white px-3 py-2 text-sm font-medium text-[#17241C] hover:bg-[#F5F8F6] disabled:opacity-50'

export function PageHeader({ section, title, text, action }: { section: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[#64756A]">{section}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17241C]">{title}</h1>
        {text && <p className="mt-2 max-w-3xl text-sm text-[#64756A]">{text}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#D9E5DD] bg-white ${className}`}>{children}</section>
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      {message}
    </p>
  )
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-10 animate-pulse rounded bg-[#E7EEE9]" />
      ))}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="p-8 text-center text-sm text-[#64756A]">{children}</p>
}

const BADGE: Record<string, string> = {
  green: 'bg-[#E6F4EA] text-[#166534]',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-blue-50 text-blue-800',
}

export function Badge({ tone = 'gray', children }: { tone?: keyof typeof BADGE; children: ReactNode }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${BADGE[tone]}`}>{children}</span>
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E7EEE9] bg-white px-5 py-4">
          <h2 className="text-lg font-semibold text-[#17241C]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#64756A] hover:bg-[#F5F8F6]">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function daysAgo(value: string | null | undefined) {
  if (!value) return 'never'
  const days = Math.floor((Date.now() - Date.parse(value)) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}
