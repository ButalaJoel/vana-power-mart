
import { CategorySection } from '../components/store/CategorySection'
import { HeroSlider } from '../components/store/HeroSlider'
import { ProductGrid, ProductGridSkeleton } from '../components/store/ProductGrid'
import { usePageTitle } from '../hooks/usePageTitle'
import { FlashSales } from '../components/store/FlashSales'
import { useProducts } from '../context/ProductContext'

export function HomePage() {
  usePageTitle('Home')

  const { products, loading, error } = useProducts()

  const featuredProducts = products.filter(
    (product) => product.featured,
  )

  return (
    <>
      <HeroSlider />
      <FlashSales />
      <CategorySection />

      {loading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <p className="py-10 text-center text-red-600">
          We couldn't load products right now. Please check your connection and refresh the page.
        </p>
      ) : (
        <ProductGrid
          // Fall back to the newest products when none are marked featured.
          products={
            featuredProducts.length > 0
              ? featuredProducts.slice(0, 10)
              : products.slice(0, 10)
          }
          title="Featured products"
        />
      )}
    </>
  )
}
