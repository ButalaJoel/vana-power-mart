import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { apiRequest, formatDateTime } from '../../lib/api'
import { useStore } from '../../context/StoreContext'

interface ReviewData {
  average: number | null
  count: number
  reviews: Array<{
    id: string
    rating: number
    title: string | null
    body: string | null
    isVerified: boolean
    createdAt: string
    author: string
  }>
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex text-amber-500" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star key={index} size={size} fill={index <= Math.round(value) ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

export function ProductReviews({ productSlug }: { productSlug: string }) {
  const { customer } = useStore()
  const [data, setData] = useState<ReviewData | null>(null)
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await apiRequest<{ data: ReviewData }>(`/api/reviews/product/${encodeURIComponent(productSlug)}`)
      setData(result.data)
    } catch {
      setData({ average: null, count: 0, reviews: [] })
    }
  }, [productSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!rating) {
      setMessage('Choose a star rating.')
      return
    }
    try {
      setSending(true)
      setMessage('')
      await apiRequest(`/api/reviews/product/${encodeURIComponent(productSlug)}`, {
        method: 'POST',
        customer: true,
        body: { rating, title, body },
      })
      setMessage('Thank you for your review!')
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save your review.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-[#e1e7e2] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold">Customer reviews</h2>
          {data?.average !== null && data?.average !== undefined && (
            <span className="flex items-center gap-2 text-sm text-gray-600">
              <Stars value={data.average} /> {data.average} out of 5 · {data.count} review{data.count === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {data && data.count === 0 && <p className="mt-3 text-sm text-gray-500">No reviews yet.</p>}

        <ul className="mt-4 divide-y divide-[#eef1ef]">
          {data?.reviews.map((review) => (
            <li key={review.id} className="py-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Stars value={review.rating} size={14} />
                {review.title && <span className="font-semibold">{review.title}</span>}
              </div>
              {review.body && <p className="mt-1 text-sm text-gray-700">{review.body}</p>}
              <p className="mt-1 text-xs text-gray-400">
                {review.author} · {formatDateTime(review.createdAt)}
                {review.isVerified && <span className="ml-2 font-semibold text-[var(--vana-green)]">Verified purchase</span>}
              </p>
            </li>
          ))}
        </ul>

        {customer ? (
          <form onSubmit={submit} className="mt-4 space-y-3 border-t border-[#eef1ef] pt-4">
            <p className="text-sm font-semibold">Write a review</p>
            <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} star${value === 1 ? '' : 's'}`}
                  onClick={() => setRating(value)}
                  className="text-amber-500"
                >
                  <Star size={26} fill={value <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="Title (optional)"
              className="w-full rounded-xl border border-[#d7e1d9] px-3 py-2 text-sm"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="What did you like or dislike?"
              className="w-full rounded-xl border border-[#d7e1d9] px-3 py-2 text-sm"
            />
            {message && <p role="status" className="text-sm text-gray-600">{message}</p>}
            <button type="submit" disabled={sending} className="rounded-full bg-[var(--vana-green)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {sending ? 'Saving…' : 'Submit review'}
            </button>
          </form>
        ) : (
          <p className="mt-4 border-t border-[#eef1ef] pt-4 text-sm text-gray-500">
            <Link to="/account" className="font-semibold text-[var(--vana-green)] underline">Sign in</Link> to write a review.
          </p>
        )}
      </div>
    </section>
  )
}
