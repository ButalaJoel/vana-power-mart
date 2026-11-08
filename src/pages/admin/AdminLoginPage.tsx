import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { apiRequest, setAdminToken } from '../../lib/api'
import { usePageTitle } from '../../hooks/usePageTitle'

export interface AdminProfile {
  id: string
  name: string
  email: string
  role: string
}

interface LoginResponse {
  token: string
  admin: AdminProfile
}

export function AdminLoginPage({
  onLogin,
  notice,
}: {
  onLogin: (admin: AdminProfile) => void
  notice?: string
}) {
  usePageTitle('Admin login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSubmitting(true)
      setError('')

      const result = await apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })

      setAdminToken(result.token)
      onLogin(result.admin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F8F6] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-2xl font-extrabold text-[#064E32]">Vana Power Mart</p>
          <p className="mt-1 text-sm text-[#64756A]">Administration</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#D9E5DD] bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF2EC] text-[#064E32]">
              <LockKeyhole size={18} aria-hidden="true" />
            </span>
            <h1 className="text-lg font-bold text-[#17241C]">Sign in</h1>
          </div>

          {(error || notice) && (
            <p
              role="alert"
              className={`mb-4 rounded-lg p-3 text-sm ${
                error ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
              }`}
            >
              {error || notice}
            </p>
          )}

          <label htmlFor="admin-email" className="mb-1.5 block text-sm font-semibold">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mb-4 w-full rounded-lg border border-[#D9E5DD] px-3 py-2.5 text-sm outline-none focus:border-[#064E32] focus:ring-2 focus:ring-[#064E32]/15"
          />

          <label htmlFor="admin-password" className="mb-1.5 block text-sm font-semibold">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mb-6 w-full rounded-lg border border-[#D9E5DD] px-3 py-2.5 text-sm outline-none focus:border-[#064E32] focus:ring-2 focus:ring-[#064E32]/15"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[#064E32] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B6843] disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <Link
          to="/"
          className="mt-5 block text-center text-sm font-medium text-[#064E32] hover:underline"
        >
          ← Back to the store
        </Link>
      </div>
    </main>
  )
}
