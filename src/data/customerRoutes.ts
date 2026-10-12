import { routePaths } from '../lib/routePaths'
import type { CustomerRouteDefinition } from '../types/routes'

export const customerRoutes: CustomerRouteDefinition[] = [
  {
    path: routePaths.home,
    title: 'Home',
    description: 'The Vana Power Mart storefront.',
  },
  {
    path: routePaths.products,
    title: 'Products',
    description: 'Browse the product catalogue.',
  },
  {
    path: routePaths.category,
    title: 'Category listing',
    description: 'Browse products in a category.',
  },
  {
    path: routePaths.search,
    title: 'Search results',
    description: 'Review products matching a search.',
  },
  {
    path: routePaths.productDetails,
    title: 'Product details',
    description: 'View information about a product.',
  },
  {
    path: routePaths.cart,
    title: 'Cart',
    description: 'Review items in your cart.',
  },
  {
    path: routePaths.checkout,
    title: 'Checkout',
    description: 'Provide details for an order.',
  },
  {
    path: routePaths.payment,
    title: 'Payment',
    description: 'Complete payment for an order.',
  },
  {
    path: routePaths.orderConfirmation,
    title: 'Order confirmation',
    description: 'Review a placed order.',
  },
  {
    path: routePaths.orderTracking,
    title: 'Order tracking',
    description: 'View the status of an order.',
  },
  {
    path: routePaths.account,
    title: 'My account',
    description: 'View your account overview.',
  },
  {
    path: routePaths.accountOrders,
    title: 'Orders',
    description: 'Review your orders.',
  },
  {
    path: routePaths.wishlist,
    title: 'Wishlist',
    description: 'Review your saved products.',
  },
  {
    path: routePaths.addresses,
    title: 'Addresses',
    description: 'Manage your delivery addresses.',
  },
  {
    path: routePaths.productReviews,
    title: 'Product reviews',
    description: 'Read and write product reviews.',
  },
  {
    path: routePaths.accountSettings,
    title: 'Account settings',
    description: 'Manage your account settings.',
  },
  {
    path: routePaths.terms,
    title: 'Terms & Conditions',
    description: 'Vana Power Mart terms and conditions.',
  },
  {
    path: routePaths.privacy,
    title: 'Privacy Policy',
    description: 'How Vana Power Mart handles personal information.',
  },
  {
    path: routePaths.contact,
    title: 'Contact / support',
    description: 'Contact Vana Power Mart for support.',
  },
]