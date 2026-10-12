import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { routePaths } from '../../lib/routePaths'

type HeroSlide = {
  image: string
  eyebrow: string
  title: string
  description: string
}

const heroSlides: HeroSlide[] = [
  {
    image: '/hero-slider/slide-01.jpg',
    eyebrow: 'Everything you need, all in one place',
    title: 'Quality for your home.',
    description:
      'Shop trusted appliances, electronics, furniture and more—with dependable delivery across Uganda.',
  },
  {
    image: '/hero-slider/slide-02.jpg',
    eyebrow: 'Made for everyday life',
    title: 'Appliances that work for you.',
    description:
      'Find practical appliances and electronics at prices that make sense.',
  },
  {
    image: '/hero-slider/slide-03.jpg',
    eyebrow: 'Upgrade your space',
    title: 'Make your home feel complete.',
    description:
      'Discover furniture, appliances and everyday essentials for modern living.',
  },
]

const SLIDE_DURATION = 5000

export function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const goToNextSlide = () => {
    setCurrentSlide((current) => (current + 1) % heroSlides.length)
  }

  const goToPreviousSlide = () => {
    setCurrentSlide(
      (current) =>
        (current - 1 + heroSlides.length) % heroSlides.length,
    )
  }

  useEffect(() => {
    if (isPaused) {
      return
    }

    const interval = window.setInterval(goToNextSlide, SLIDE_DURATION)

    return () => {
      window.clearInterval(interval)
    }
  }, [isPaused])

  const slide = heroSlides[currentSlide]

  return (
    <section
      aria-label="Featured products"
      className="relative isolate min-h-[520px] overflow-hidden bg-[var(--vana-green-dark)] sm:min-h-[560px] lg:min-h-[610px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Slides */}
      {heroSlides.map((item, index) => (
        <img
          key={item.image}
          src={item.image}
          alt=""
          className={`absolute inset-0 -z-30 h-full w-full object-cover object-center transition-opacity duration-700 ${
            index === currentSlide ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      {/* Left-to-right gradient overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-gradient-to-r from-[var(--vana-green-dark)]/90 via-[var(--vana-green-dark)]/55 to-transparent"
      />

      {/* Content */}
      <div className="mx-auto flex min-h-[520px] w-full max-w-[1440px] items-center px-6 py-16 sm:min-h-[560px] sm:px-10 lg:min-h-[610px] lg:px-20 lg:py-24">
        <div className="max-w-[650px] text-white">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.16em] text-white/90 sm:text-xs">
            {slide.eyebrow}
          </p>

          <h1 className="max-w-[620px] text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-[58px]">
            {slide.title}
          </h1>

          <p className="mt-6 max-w-xl text-[15px] leading-7 text-white/85 sm:text-base lg:text-[17px]">
            {slide.description}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={routePaths.products}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-[var(--vana-green-dark)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#f3f7f4]"
            >
              Shop now
            </Link>

            <Link
              to={routePaths.products}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/70 px-7 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-white hover:bg-white/10"
            >
              Browse categories
            </Link>
          </div>
        </div>
      </div>

      {/* Previous button */}
      <button
        type="button"
        aria-label="Previous slide"
        onClick={goToPreviousSlide}
        className="absolute left-5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--vana-green-dark)] shadow-sm transition-all duration-200 hover:scale-105 hover:bg-white sm:left-6"
      >
        <ChevronLeft size={21} strokeWidth={2} />
      </button>

      {/* Next button */}
      <button
        type="button"
        aria-label="Next slide"
        onClick={goToNextSlide}
        className="absolute right-5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--vana-green-dark)] shadow-sm transition-all duration-200 hover:scale-105 hover:bg-white sm:right-6"
      >
        <ChevronRight size={21} strokeWidth={2} />
      </button>

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {heroSlides.map((item, index) => (
          <button
            key={item.image}
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === currentSlide}
            onClick={() => setCurrentSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? 'w-7 bg-white'
                : 'w-2 bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </section>
  )
}