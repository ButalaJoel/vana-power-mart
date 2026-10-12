export type StoreCategory = {
  id: string
  name: string
  slug: string
  image: string
}

export const storeCategories: StoreCategory[] = [
  {
    id: 'home-appliances',
    name: 'Home Appliances',
    slug: 'home-appliances',
    image: '/categories/home-appliances.jpg',
  },
  {
    id: 'phones-electronics',
    name: 'Phones & Electronics',
    slug: 'phones-electronics',
    image: '/categories/phones-electronics.jpg',
  },
  {
    id: 'furniture-home',
    name: 'Furniture & Home',
    slug: 'furniture-home',
    image: '/categories/furniture-home.jpg',
  },
  {
    id: 'beddings',
    name: 'Beddings',
    slug: 'beddings',
    image: '/categories/beddings.jpg',
  },
  {
    id: 'bags-accessories',
    name: 'Bags & Accessories',
    slug: 'bags-accessories',
    image: '/categories/bags-accessories.jpg',
  },
]