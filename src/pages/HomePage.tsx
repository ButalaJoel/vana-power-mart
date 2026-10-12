
import { CategorySection } from '../components/store/CategorySection'
import { HeroSlider } from '../components/store/HeroSlider'
import { ProductGrid } from '../components/store/ProductGrid'
import { usePageTitle } from '../hooks/usePageTitle'
import { useProducts } from '../context/ProductContext'

export function HomePage() {
  usePageTitle('Home')

  const { products, loading, error } = useProducts()

  const featuredProducts = products.filter(
    (product) => product.featured && product.price !== undefined,
  )

  return (
    <>
      <HeroSlider />
      <CategorySection />

      {loading ? (
        <p className="py-10 text-center">Loading products...</p>
      ) : error ? (
        <p className="py-10 text-center text-red-600">
          Unable to load products: {error}
        </p>
      ) : (
        <ProductGrid
          products={featuredProducts}
          title="Featured products"
        />
      )}
    </>
  )
}
