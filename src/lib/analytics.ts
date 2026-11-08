// Google Analytics 4. Off unless VITE_GA_MEASUREMENT_ID is set at build time.
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined

type Gtag = (...args: unknown[]) => void
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

let started = false

export function analyticsEnabled() {
  return Boolean(MEASUREMENT_ID)
}

export function initAnalytics() {
  if (!MEASUREMENT_ID || started || typeof window === 'undefined') return
  started = true

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // gtag expects the arguments object itself.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  // Page views are sent by trackPageView on each route change.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false })
}

function send(event: string, params: Record<string, unknown>) {
  if (!MEASUREMENT_ID || !window.gtag) return
  window.gtag('event', event, params)
}

export function trackPageView(path: string) {
  send('page_view', { page_path: path, page_location: window.location.href, page_title: document.title })
}

export interface AnalyticsItem {
  item_id: string
  item_name: string
  price: number
  quantity: number
}

export function trackAddToCart(item: AnalyticsItem) {
  send('add_to_cart', { currency: 'UGX', value: item.price * item.quantity, items: [item] })
}

export function trackBeginCheckout(value: number, items: AnalyticsItem[]) {
  send('begin_checkout', { currency: 'UGX', value, items })
}

// Sent once per order, even if the confirmation page is reloaded.
export function trackPurchase(orderNumber: string, value: number, items: AnalyticsItem[]) {
  try {
    const key = `vana-ga-purchase-${orderNumber}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    // Storage unavailable: send anyway.
  }
  send('purchase', { transaction_id: orderNumber, currency: 'UGX', value, items })
}
