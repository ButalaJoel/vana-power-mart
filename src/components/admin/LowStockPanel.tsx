
 // Example low-stock items for the prototype.
 // Replace these examples with inventory data from our API.
const lowStockProducts = [
  { name: 'Roch Refrigerator 120L', sku: 'RFR-120S-I', stock: 2, reorderLevel: 5 },
  { name: 'Chest Freezer 180L', sku: 'CF-180L', stock: 1, reorderLevel: 4 },
  { name: 'Water Heater 15L', sku: 'RWH-15VE', stock: 3, reorderLevel: 5 },
]

export function LowStockPanel() {
  return (
    <section className="rounded-xl border border-[#D9E5DD] bg-white p-5">
      {/* Panel heading */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[#17241C]">
            Low-stock alerts
          </h2>
          <p className="mt-1 text-sm text-[#64756A]">
            Products that may need restocking
          </p>
        </div>

        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          {lowStockProducts.length} alerts
        </span>
      </div>

      {/* List products whose sample stock is low */}
      <div className="mt-5 divide-y divide-[#E6ECE8]">
        {lowStockProducts.map((product) => (
          <div
            key={product.sku}
            className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#17241C]">
                {product.name}
              </p>
              <p className="mt-1 text-xs text-[#64756A]">
                SKU: {product.sku}
              </p>
              <p className="mt-1 text-xs text-[#64756A]">
                Reorder level: {product.reorderLevel}
              </p>
            </div>

            {/* Highlight the quantity that needs attention */}
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold text-amber-700">
                {product.stock}
              </p>
              <p className="text-xs text-[#64756A]">units left</p>
            </div>
          </div>
        ))}
      </div>

      {/* Clearly mark the example data */}
      <p className="mt-5 border-t border-[#E6ECE8] pt-3 text-xs text-[#64756A]">
        Illustrative stock data — live inventory connection pending.
      </p>
    </section>
  )
}
