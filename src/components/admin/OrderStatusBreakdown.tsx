
 // Illustrative order counts for the dashboard prototype.
 // Replace these values with real API data when the orders endpoint is ready.
const orderStatuses = [
  { label: 'Pending', count: 12, color: '#D97706' },
  { label: 'Processing', count: 8, color: '#2563EB' },
  { label: 'Out for delivery', count: 5, color: '#0B6843' },
  { label: 'Delivered', count: 24, color: '#64756A' },
]

export function OrderStatusBreakdown() {
  // Calculate the total so each status can be displayed as a percentage.
  const totalOrders = orderStatuses.reduce(
    (total, status) => total + status.count,
    0,
  )

  return (
    <section className="rounded-xl border border-[#D9E5DD] bg-white p-5">
      {/* Section heading and context */}
      <div>
        <h2 className="font-semibold text-[#17241C]">
          Order status
        </h2>
        <p className="mt-1 text-sm text-[#64756A]">
          Distribution by fulfilment stage · demo data
        </p>
      </div>

      {/* Display each order status with its count and proportion */}
      <div className="mt-6 space-y-5">
        {orderStatuses.map((status) => {
          // Calculate how much of the total belongs to this status.
          const percentage =
            totalOrders > 0 ? (status.count / totalOrders) * 100 : 0

          return (
            <div key={status.label}>
              {/* Status name and order count */}
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-[#34483B]">{status.label}</span>
                </div>

                <span className="font-semibold text-[#17241C]">
                  {status.count}
                </span>
              </div>

              {/* Progress bar represents this status's share of all orders */}
              <div className="h-2 overflow-hidden rounded-full bg-[#EDF2EE]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: status.color,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Clearly identify the sample total */}
      <div className="mt-6 border-t border-[#E6ECE8] pt-4">
        <p className="text-sm text-[#64756A]">
          Total sample orders
        </p>
        <p className="mt-1 text-2xl font-bold text-[#064E32]">
          {totalOrders}
        </p>
      </div>
    </section>
  )
}
