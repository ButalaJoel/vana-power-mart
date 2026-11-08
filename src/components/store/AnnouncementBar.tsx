import { Link } from 'react-router-dom'
import { useStore } from '../../context/StoreContext'
import { formatUGX } from '../../lib/api'

// Top bar: free-delivery threshold and phone come from Admin → Settings.
export function AnnouncementBar() {
  const { config } = useStore()

  return (
    <div className="bg-[var(--vana-green-dark)] text-white">
      <div className="mx-auto flex min-h-9 w-full max-w-[1440px] items-center justify-between gap-3 px-4 text-[11px] font-medium sm:px-6 sm:text-xs lg:px-10">
        <p>
          {config?.freeDeliveryThreshold
            ? `Free delivery on orders of ${formatUGX(config.freeDeliveryThreshold)} or more`
            : 'Delivery across Uganda · Pay with mobile money or cash on delivery'}
        </p>
        <p className="flex shrink-0 items-center gap-3">
          <Link to="/track" className="underline-offset-2 hover:underline">Track order</Link>
          {config?.storePhone && (
            <a href={`tel:${config.storePhone}`} className="hidden hover:underline sm:inline">
              Need help? {config.storePhone}
            </a>
          )}
        </p>
      </div>
    </div>
  )
}
