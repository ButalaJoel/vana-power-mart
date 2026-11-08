import { Link, useLocation } from 'react-router-dom'

// Placeholder for admin sections planned after launch.
export function AdminComingSoonPage() {
  const { pathname } = useLocation()
  const section = pathname.split('/').pop() ?? ''
  const title = section.charAt(0).toUpperCase() + section.slice(1)

  return (
    <section className="rounded-2xl border border-[#D9E5DD] bg-white p-8 text-center">
      <h1 className="text-xl font-bold text-[#17241C]">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#64756A]">
        This section is planned for a later release. Stock levels can be
        updated from each product, and orders are managed under Orders.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link
          to="/admin/products"
          className="rounded-full bg-[#064E32] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Go to Products
        </Link>
        <Link
          to="/admin/orders"
          className="rounded-full border border-[#064E32] px-5 py-2.5 text-sm font-semibold text-[#064E32]"
        >
          Go to Orders
        </Link>
      </div>
    </section>
  )
}
