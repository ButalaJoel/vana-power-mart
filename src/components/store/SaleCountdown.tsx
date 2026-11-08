import { useEffect, useState } from 'react'

// Live "ends in" timer for a flash sale.
export function SaleCountdown({ endsAt, className = '' }: { endsAt: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const left = Math.max(0, Date.parse(endsAt) - now)
  if (left === 0) return <span className={className}>Sale ended</span>

  const days = Math.floor(left / 86_400_000)
  const hours = Math.floor((left % 86_400_000) / 3_600_000)
  const minutes = Math.floor((left % 3_600_000) / 60_000)
  const seconds = Math.floor((left % 60_000) / 1000)
  const pad = (value: number) => String(value).padStart(2, '0')

  return (
    <span className={`tabular-nums ${className}`} aria-label="Time left in the sale">
      Ends in {days > 0 ? `${days}d ` : ''}
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  )
}
