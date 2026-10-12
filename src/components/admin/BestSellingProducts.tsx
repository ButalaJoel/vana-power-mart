
 // Example product rankings for the dashboard prototype.
 // Real rankings will be calculated from completed order items.
const bestSellingProducts = [
  { name: 'Roch Refrigerator 120L', category: 'Refrigerators', unitsSold: 24, revenue: 7200000 },
  { name: 'Twin Tub Washing Machine 7kg', category: 'Washing Machines', unitsSold: 18, revenue: 6300000 },
  { name: 'Chest Freezer 180L', category: 'Freezers', unitsSold: 12, revenue: 5400000 },
]

// Format revenue using Ugandan shillings.
function formatRevenue(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function BestSellingProducts() {
  return (
    <section className="rounded-xl border border-[#D9E5DD] bg-white p-5">
      {/* Panel heading */}
      <div>
        <h2 className="font-semibold text-[#17241C]">
          Best-selling products
        </h2>
        <p className="mt-1 text-sm text-[#64756A]">
          Ranked by example sales
        </p>
      </div>

      {/* Product ranking list */}
      <div className="mt-5 divide-y divide-[#E6ECE8]">
        {bestSellingProducts.map((product, index) => (
          <div
            key={product.name}
            className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"
          >
            {/* Rank indicator */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF2EC] text-sm font-semibold text-[#064E32]">
              {index + 1}
            </div>

            {/* Product information */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#17241C]">
                {product.name}
              </p>
              <p className="mt-1 text-xs text-[#64756A]">
                {product.category} · {product.unitsSold} units
              </p>
            </div>

            {/* Example sales revenue */}
            <p className="shrink-0 text-sm font-semibold text-[#064E32]">
              {formatRevenue(product.revenue)}
            </p>
          </div>
        ))}
      </div>

      {/* Prevent sample rankings from being mistaken for real sales */}
      <p className="mt-5 border-t border-[#E6ECE8] pt-3 text-xs text-[#64756A]">
        Illustrative rankings and revenue — real sales data pending.
      </p>
    </section>
  )
}
