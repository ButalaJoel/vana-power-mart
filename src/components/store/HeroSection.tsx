import { Link } from 'react-router-dom'
import heroImage from '../../assets/hero.png'
import { routePaths } from '../../lib/routePaths'

export function HeroSection() {
  return (
    <section className="relative isolate flex min-h-[500px] items-center overflow-hidden bg-[#153a26] sm:min-h-[560px] lg:min-h-[610px]">
      <img
        alt=""
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        src={heroImage}
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#062e1d]/65" />
      <div className="mx-auto w-full max-w-[1440px] px-6 py-16 sm:px-10 lg:px-20 lg:py-24">
        <div className="max-w-[650px] text-white">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.12em] sm:text-xs">
            Everything you need, all in one place
          </p>
          <h1 className="max-w-[620px] text-[42px] font-bold leading-[1.08] sm:text-[52px] lg:text-[60px]">
            Quality for your home.
            <br />
            Value for every day.
          </h1>
          <p className="mt-6 max-w-[560px] text-base leading-7 text-white/90 sm:text-lg sm:leading-8">
            Shop trusted appliances, electronics, furniture and more—with dependable delivery across Uganda.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              className="inline-flex min-h-12 items-center justify-center bg-white px-6 text-sm font-semibold text-[var(--vana-green-dark)] transition-colors hover:bg-[#edf3ee]"
              to={routePaths.products}
            >
              Shop latest deals
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center border border-white/80 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              to={routePaths.products}
            >
              Browse categories
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}