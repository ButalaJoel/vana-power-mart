// Shared helpers for talking to the Express API.

export const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:4000'
).replace(/\/$/, '')

const TOKEN_KEY = 'vana-power-mart-admin-token'

// Fired when the admin session ends (logout or expired token),
// so the admin layout can show the login screen again.
export const ADMIN_LOGOUT_EVENT = 'vana-admin-logout'

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage can be unavailable (private mode); the session then lasts
    // only until the page is reloaded.
  }

  if (!token) window.dispatchEvent(new Event(ADMIN_LOGOUT_EVENT))
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const CUSTOMER_TOKEN_KEY = 'vana-power-mart-customer-token'

export function getCustomerToken(): string | null {
  try {
    return localStorage.getItem(CUSTOMER_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setCustomerToken(token: string | null) {
  try {
    if (token) localStorage.setItem(CUSTOMER_TOKEN_KEY, token)
    else localStorage.removeItem(CUSTOMER_TOKEN_KEY)
  } catch {
    // Storage unavailable: the customer stays logged in for this visit only.
  }
}

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  // Send the admin JWT with this request.
  auth?: boolean
  // Send the customer's login token, if they are logged in.
  customer?: boolean
}

// Fetch JSON from the API and throw ApiError with the server's message on failure.
export async function apiRequest<T = unknown>(
  path: string,
  { body, auth = false, customer = false, headers, ...options }: ApiOptions = {},
): Promise<T> {
  const requestHeaders = new Headers(headers)

  const isFormData = body instanceof FormData
  if (body !== undefined && !isFormData) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  if (auth) {
    const token = getAdminToken()
    if (token) requestHeaders.set('Authorization', `Bearer ${token}`)
  } else if (customer) {
    const token = getCustomerToken()
    if (token) requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as FormData)
            : JSON.stringify(body),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(
      'Unable to reach the server. Check your connection and try again.',
      0,
    )
  }

  const result = await response.json().catch(() => null)

  if (!response.ok || result?.success === false) {
    // An expired or revoked admin session: return to the login screen.
    if (auth && (response.status === 401 || response.status === 403)) {
      setAdminToken(null)
    }
    if (customer && response.status === 401 && getCustomerToken()) {
      setCustomerToken(null)
      window.dispatchEvent(new Event('vana-customer-logout'))
    }

    throw new ApiError(
      result?.message ?? `Request failed (HTTP ${response.status}).`,
      response.status,
    )
  }

  return result as T
}

export function formatUGX(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)
  return `UGX ${amount.toLocaleString('en-UG', { maximumFractionDigits: 0 })}`
}

// A random key sent with checkout so a retried submit can't create two orders.
export function newIdempotencyKey() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function statusLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
