
import { lazy, Suspense, type ComponentType } from 'react'
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
import { PaymentPage } from '../pages/PaymentPage'
import { TrackOrderPage } from '../pages/TrackOrderPage'
import { AccountPage, WishlistPage } from '../pages/AccountPage'
import { ContactPage, ErrorPage, NotFoundPage, PrivacyPage, TermsPage } from '../pages/InfoPages'

// Admin dashboard imports.
import { AdminLayout } from '../layouts/AdminLayout'

// Admin pages load separately, so shoppers don't download the dashboard.
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })))
const AdminProductsPage = lazy(() => import('../pages/admin/AdminProductsPage').then((m) => ({ default: m.AdminProductsPage })))
const AdminCategoriesPage = lazy(() => import('../pages/admin/AdminCategoriesPage').then((m) => ({ default: m.AdminCategoriesPage })))
const AdminOrdersPage = lazy(() => import('../pages/admin/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })))
const AdminComingSoonPage = lazy(() => import('../pages/admin/AdminComingSoonPage').then((m) => ({ default: m.AdminComingSoonPage })))
const AdminSuppliersPage = lazy(() => import('../pages/admin/AdminSuppliersPage').then((m) => ({ default: m.AdminSuppliersPage })))
const AdminInventoryPage = lazy(() => import('../pages/admin/AdminInventoryPage').then((m) => ({ default: m.AdminInventoryPage })))
const AdminDeliveryPage = lazy(() => import('../pages/admin/AdminDeliveryPage').then((m) => ({ default: m.AdminDeliveryPage })))
const AdminPromotionsPage = lazy(() => import('../pages/admin/AdminPromotionsPage').then((m) => ({ default: m.AdminPromotionsPage })))
const AdminReturnsPage = lazy(() => import('../pages/admin/AdminReturnsPage').then((m) => ({ default: m.AdminReturnsPage })))
const AdminCustomersPage = lazy(() => import('../pages/admin/AdminCustomersPage').then((m) => ({ default: m.AdminCustomersPage })))
const AdminSettingsPage = lazy(() => import('../pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })))

function admin(Page: ComponentType) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-[#E7EEE9]" />}>
      <Page />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    element: <StoreLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: routePaths.home, element: <HomePage /> },
      { path: routePaths.products, element: <ProductsPage /> },
      { path: routePaths.category, element: <ProductsPage /> },
      { path: routePaths.search, element: <ProductsPage /> },
      { path: routePaths.productDetails, element: <ProductDetailsPage /> },
      { path: routePaths.cart, element: <CartPage /> },
      { path: routePaths.checkout, element: <CheckoutPage /> },
      { path: '/payment/:orderNumber', element: <PaymentPage /> },
      { path: routePaths.orderConfirmation, element: <OrderConfirmationPage /> },
      { path: '/track', element: <TrackOrderPage /> },
      { path: routePaths.account, element: <AccountPage /> },
      { path: routePaths.accountOrders, element: <AccountPage /> },
      { path: routePaths.wishlist, element: <WishlistPage /> },
      { path: routePaths.privacy, element: <PrivacyPage /> },
      { path: routePaths.terms, element: <TermsPage /> },
      { path: routePaths.contact, element: <ContactPage /> },
      // Remaining account pages keep the placeholder until written.
      ...customerRoutes
        .filter(({ path }) =>
          [routePaths.addresses, routePaths.accountSettings].includes(
            path as never,
          ),
        )
        .map(({ path, title, description }) => ({
          path,
          element: <CustomerPage title={title} description={description} />,
        })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  {
    path: '/admin',
    element: <AdminLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: admin(AdminDashboardPage),
      },
      {
        path: 'products',
        element: admin(AdminProductsPage),
      },
      {
        path: 'categories',
        element: admin(AdminCategoriesPage),
      },
      {
        path: 'orders',
        element: admin(AdminOrdersPage),
      },
      { path: 'inventory', element: admin(AdminInventoryPage) },
      { path: 'suppliers', element: admin(AdminSuppliersPage) },
      { path: 'delivery', element: admin(AdminDeliveryPage) },
      { path: 'promotions', element: admin(AdminPromotionsPage) },
      { path: 'returns', element: admin(AdminReturnsPage) },
      { path: 'customers', element: admin(AdminCustomersPage) },
      { path: 'settings', element: admin(AdminSettingsPage) },
      // Reports are planned after launch.
      { path: 'reports', element: admin(AdminComingSoonPage) },
    ],
  },
])
