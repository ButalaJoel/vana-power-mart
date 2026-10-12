
const revenueData = [
  { day: 'Mon', amount: 35 },
  { day: 'Tue', amount: 52 },
  { day: 'Wed', amount: 43 },
  { day: 'Thu', amount: 68 },
  { day: 'Fri', amount: 49 },
  { day: 'Sat', amount: 82 },
  { day: 'Sun', amount: 64 },
]

export function RevenueChart() {
  const maxAmount = Math.max(...revenueData.map((item) => item.amount))

  return (
    <section className="rounded-xl border border-[#D9E5DD] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[#17241C]">Revenue trend</h2>
          <p className="mt-1 text-sm text-[#64756A]">
            Weekly overview · illustrative data
          </p>
        </div>

        <span className="rounded-lg border border-[#D9E5DD] px-3 py-2 text-sm text-[#064E32]">
          Last 7 days
        </span>
      </div>

      <div className="mt-6 flex h-48 items-end gap-3">
        {revenueData.map((item) => (
          <div
            key={item.day}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
          >
            <div className="flex h-full w-full items-end">
              <div
                title={`${item.amount} illustrative units`}
                className="w-full rounded-t-md bg-[#0B6843] transition-opacity hover:opacity-75"
                style={{
                  height: `${(item.amount / maxAmount) * 100}%`,
                }}
              />
            </div>

            <span className="text-xs text-[#64756A]">{item.day}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-[#64756A]">
        Sample chart only. Actual UGX revenue will be shown when order data is connected.
      </p>
    </section>
  )
}
