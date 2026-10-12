import { Search } from 'lucide-react'
import { routePaths } from '../../lib/routePaths'

export function SearchBar() {
  return (
    <form
      action={routePaths.search}
      className="flex h-12 w-full items-center overflow-hidden rounded-full border border-[#cfd9d1] bg-white p-1 focus-within:border-[var(--vana-green)] focus-within:ring-2 focus-within:ring-[var(--vana-green)]/10"
      role="search"
    >
      <input
        aria-label="Search products"
        className="min-w-0 flex-1 bg-transparent px-4 text-sm text-[var(--vana-text)] outline-none placeholder:text-[#87938b]"
        name="q"
        placeholder="Search products, brands and more"
        type="search"
      />
      <button
        aria-label="Search"
        className="flex h-10 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--vana-green)] text-white transition-colors hover:bg-[var(--vana-green-dark)] sm:w-14"
        type="submit"
      >
        <Search aria-hidden="true" size={19} strokeWidth={2} />
      </button>
    </form>
  )
}