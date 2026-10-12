
 // Example orders for the prototype.
 // These are not real customer orders and must be replaced by API data.
const recentOrders = [
  {
    id: 'VPM-1001',
    customer: 'Demo Customer One',
    date: '12 Oct 2026',
    total: 850000,
    status: 'Pending',
  },
  {
    id: 'VPM-1002',
    customer: 'Demo Customer Two',
    date: '12 Oct 2026',
    total: 420000,
    status: 'Processing',
  },
  {
    id: 'VPM-1003',
    customer: 'Demo Customer Three',
    date: '11 Oct 2026',
    total: 1250000,
    status: 'Out for delivery',
  },
]

// Format amounts as Ugandan shillings without decimal places.
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

// Assign a subtle badge style based on the order's current status.
function getStatusStyle(status: string) {
  switch (status) {
    case 'Pending':
      return 'bg-amber-50 text-amber-800'
    case 'Processing':
      return 'bg-blue-50 text-blue-800'
    case 'Out for delivery':
      return 'bg-emerald-50 text-emerald-800'
    default:
      return 'bg-[#EDF2EE] text-[#34483B]'
  }
}

export function RecentOrdersTable() {
  return (
    <section className="overflow-hidden rounded-xl border border-[#D9E5DD] bg-white">
      {/* Table heading */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E6ECE8] p-5">
        <div>
          <h2 className="font-semibold text-[#17241C]">
            Recent orders
          </h2>
          <p className="mt-1 text-sm text-[#64756A]">
            Latest order activity · demo data
          </p>
        </div>

        <span className="rounded-lg border border-[#D9E5DD] px-3 py-2 text-xs text-[#064E32]">
          Prototype
        </span>
      </div>

      {/* Allow horizontal scrolling on smaller screens */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="bg-[#F5F8F6] text-[#64756A]">
            <tr>
              <th className="px-5 py-3 font-medium">Order</th>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>

          <tbody>
            {/* Render a row for every example order */}
            {recentOrders.map((order) => (
              <tr
                key={order.id}
                className="border-t border-[#E6ECE8] hover:bg-[#FAFCFA]"
              >
                <td className="whitespace-nowrap px-5 py-4 font-semibold text-[#064E32]">
                  {order.id}
                </td>
                <td className="px-5 py-4 text-[#34483B]">
                  {order.customer}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-[#64756A]">
                  {order.date}
                </td>
                <td className="whitespace-nowrap px-5 py-4 font-medium">
                  {formatCurrency(order.total)}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(order.status)}`}
                  >
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Keep the prototype data clearly identified */}
      <p className="border-t border-[#E6ECE8] px-5 py-3 text-xs text-[#64756A]">
        Example records for presentation only. No real orders are shown here yet.
      </p>
    </section>
  )
}
