export type ProductCategory =
  | 'refrigerators'
  | 'freezers'
  | 'washing-machines'
  | 'water-heaters'
  | 'kitchen-appliances'
  | 'furniture'

export interface Product {
  id: string
  name: string
  brand?: string
  category: ProductCategory
  model?: string
  capacity?: string | number
  price?: number
  oldPrice?: number
  images: string[]
  shortDescription?: string
  description?: string
  specifications?: Record<string, string | number | boolean>
  stock?: number
  rating?: number
  reviewCount?: number
  featured?: boolean
}

export const products: Product[] = [
  
{
  id: 'rfr-120s-i',
  name: 'Roch Single Door Refrigerator',
  brand: 'Roch',
  category: 'refrigerators',
  model: 'RFR-120S-I',
  capacity: 120,
  price: 420000,

  images: [
    '/products/refrigerators/rfr-120s-i/main.jpeg',
    '/products/refrigerators/rfr-120s-i/front.jpg',
    '/products/refrigerators/rfr-120s-i/side.jpg',
    '/products/refrigerators/rfr-120s-i/inside.jpg',
  ],

  shortDescription:
    'A compact single-door refrigerator for everyday food storage.',

  description:
    'The Roch RFR-120S-I is a single-door refrigerator designed for everyday household use. View its specifications and product images before ordering.',

  specifications: {
    Brand: 'Roch',
    Model: 'RFR-120S-I',
    Capacity: '120 litres',
    'Door Type': 'Single door',
    Colour: 'Silver',
    Warranty: '2 years',
  },

  featured: true,
},

  {
    id: 'rfr-125dt-w',
    name: 'Roch Double Door Refrigerator',
    category: 'refrigerators',
    model: 'RFR-125DT-W',
    price: 550000,
    images: ['/products/refrigerators/rfr-125dt-w/main.jpeg'],
    featured: true,
  },
  {
    id: 'rfr-145db-w',
    name: 'Roch Double Door Refrigerator',
    category: 'refrigerators',
    model: 'RFR-145DB-W',
    price: 650000,
    images: ['/products/refrigerators/rfr-145db-w/main.jpg'],
  },
  {
    id: 'rfr-160l',
    name: 'Roch Double Door Refrigerator',
    category: 'refrigerators',
    model: 'RFR-160L',
    price: 620000,
    images: ['/products/refrigerators/rfr-160l/main.jpg'],
  },
  {
    id: 'rfr-220swd-i',
    name: 'Roch Double Door Refrigerator with Dispenser',
    category: 'refrigerators',
    model: 'RFR-220SWD-I',
    price: 850000,
    images: ['/products/refrigerators/rfr-220swd-i/main.jpg'],
  },
  {
    id: 'chest-freezer-650l',
    name: 'Chest Freezer 650L',
    category: 'freezers',
    price: 1850000,
    images: ['/products/freezers/chest-freezer-650l/main.jpeg'],
    featured: true,
  },
  {
    id: 'chest-freezer-180l',
    name: 'Chest Freezer 180L',
    category: 'freezers',
    price: 650000,
    images: ['/products/freezers/chest-freezer-180l/main.jpg'],
  },
  {
    id: 'twin-tub-7kg',
    name: 'Twin Tub Washing Machine 7kg',
    category: 'washing-machines',
    price: 550000,
    images: ['/products/washing-machines/twin-tub-7kg/main.jpeg'],
    featured: true,
  },
  {
    id: 'twin-tub-10kg',
    name: 'Twin Tub Washing Machine 10kg',
    category: 'washing-machines',
    price: 700000,
    images: ['/products/washing-machines/twin-tub-10kg/main.jpg'],
  },
  {
    id: 'twin-tub-12kg',
    name: 'Twin Tub Washing Machine 12kg',
    category: 'washing-machines',
    price: 870000,
    images: ['/products/washing-machines/twin-tub-12kg/main.jpg'],
  },
  {
    id: 'rwh-10ve',
    name: 'Electric Water Heater',
    category: 'water-heaters',
    model: 'RWH-10VE',
    price: 300000,
    images: ['/products/water-heaters/rwh-10ve/main.jpg'],
  },
  {
    id: 'rwh-15ve',
    name: 'Electric Water Heater',
    category: 'water-heaters',
    model: 'RWH-15VE',
    price: 400000,
    images: ['/products/water-heaters/rwh-15ve/main.jpg'],
  },
  {
    id: 'rwh-30ve',
    name: 'Electric Water Heater',
    category: 'water-heaters',
    model: 'RWH-30VE',
    price: 450000,
    images: ['/products/water-heaters/rwh-30ve/main.jpeg'],
    featured: true,
  },
  {
    id: 'manual-microwave',
    name: 'Manual Microwave',
    category: 'kitchen-appliances',
    price: 210000,
    images: ['/products/kitchen-appliances/manual-microwave/main.jpeg'],
    featured: true,
  },
  {
    id: 'electric-kettle-rek-815-e',
    name: 'Electric Kettle REK-815-E',
    category: 'kitchen-appliances',
    images: ['/products/kitchen-appliances/electric-kettle-rek-815-e/main.jpeg'],
  },
  {
    id: 'pacolator-20l',
    name: 'Pacolator 20L',
    category: 'kitchen-appliances',
    price: 35000,
    images: ['/products/kitchen-appliances/pacolator-20l/main.jpeg'],
    featured: true,
  },
  {
    id: 'living-room-center-table',
    name: 'Living Room Center Table',
    category: 'furniture',
    price: 450000,
    images: ['/products/furniture/living-room-center-table/main.jpeg'],
    featured: true,
  },
  {
    id: 'gold-marble-table',
    name: 'Gold Marble Tables',
    category: 'furniture',
    price: 550000,
    images: ['/products/furniture/gold-marble-table/main.jpeg'],
    featured: true,
  },
  {
  id: 'folding-chair',
  name: 'Folding Chair',
  category: 'furniture',
  price: 200000,
  images: ['/products/furniture/folding-chair/main.jpeg'],
  featured: true,
},
]