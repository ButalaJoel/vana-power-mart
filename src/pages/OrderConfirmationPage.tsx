
import { Link, useParams } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { routePaths } from '../lib/routePaths'

export function OrderConfirmationPage() {
  const { orderId } = useParams()

  usePageTitle('Order Confirmation')

  return (
    <main className="min-h-[60vh] bg-[#f5f6f5] px-4 py-12 sm:px-6">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[#e1e7e2] bg-white p-6 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eaf3ed] text-3xl text-[var(--vana-green)]">
          ✓
        </div>

        <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-[var(--vana-green)]">
          Order received
        </p>

        <h1 className="mt-2 text-3xl font-bold text-[#10231b]">
          Thank you for your order!
        </h1>

        <p className="mt-4 leading-7 text-gray-600">
          Your demo order reference is:
        </p>

        <p className="mt-2 text-xl font-bold text-[var(--vana-green)]">
          {orderId ?? 'Demo order'}
        </p>

        <div className="mt-6 rounded-xl bg-[#f4f7f5] p-5 text-left">
          <h2 className="font-bold text-[#10231b]">
            What happens next?
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Vana Power Mart will need to verify your order and delivery
            details. No payment has been collected in this prototype.
          </p>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to={routePaths.products}
            className="rounded-full bg-[var(--vana-green)] px-6 py-3 font-semibold text-white hover:bg-[var(--vana-green-dark)]"
          >
            Continue shopping
          </Link>

          <Link
            to={routePaths.home}
            className="rounded-full border border-[#dce5df] px-6 py-3 font-semibold text-[#10231b] hover:bg-[#f4f7f5]"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  )
}
