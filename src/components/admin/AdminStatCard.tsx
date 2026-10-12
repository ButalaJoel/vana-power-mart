
import type { ReactNode } from 'react'

interface AdminStatCardProps {
  title: string
  value: string | number
  description?: string
  icon: ReactNode
}

export function AdminStatCard({
  title,
  value,
  description,
  icon,
}: AdminStatCardProps) {
  return (
    <article className="rounded-xl border border-[#D9E5DD] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#64756A]">{title}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#064E32]">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EAF2EC] text-[#064E32]">
          {icon}
        </div>
      </div>

      {description && (
        <p className="mt-4 text-xs text-[#64756A]">{description}</p>
      )}
    </article>
  )
}
