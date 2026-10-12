import { createBrowserRouter } from 'react-router-dom'

// Customer storefront imports.
import { customerRoutes } from '../data/customerRoutes'
import { routePaths } from '../lib/routePaths'
import { StoreLayout } from '../layouts/StoreLayout'
import { CustomerPage } from '../pages/CustomerPage'
import { HomePage } from '../pages/HomePage'
import { ProductsPage } from '../pages/ProductsPage'
import { ProductDetailsPage } from '../pages/ProductDetailsPage'
import { CartPage } from '../pages/CartPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { OrderConfirmationPage } from '../pages/OrderConfirmationPage'

// Admin dashboard imports.
import { AdminLayout } from '../layouts/AdminLayout'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage'

// Register the storefront and admin as separate route branches.
export const router = createBrowserRouter([
  // Customer-facing storefront.
  {
    element: <StoreLayout />,
    children: customerRoutes.map(({ path, title, description }) => ({
      path,
      element:
        path === routePaths.home ? (
          <HomePage />
        ) : path === routePaths.products ? (
          <ProductsPage />
        ) : path === routePaths.productDetails ? (
          <ProductDetailsPage />
        ) : path === routePaths.cart ? (
          <CartPage />
        ) : path === routePaths.checkout ? (
          <CheckoutPage />
        ) : path === routePaths.orderConfirmation ? (
          <OrderConfirmationPage />
        ) : (
          <CustomerPage title={title} description={description} />
        ),
    })),
  },

  // Admin dashboard.
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <AdminDashboardPage />,
      },
    ],
  },
])