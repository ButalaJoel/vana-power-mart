import { routePaths } from '../lib/routePaths'
import type { NavigationLink } from '../types/routes'

export const primaryNavigation: NavigationLink[] = [
  { label: 'Home', to: routePaths.home },
  { label: 'Products', to: routePaths.products },
  { label: 'Search', to: routePaths.search },
  { label: 'Cart', to: routePaths.cart },
  { label: 'My account', to: routePaths.account },
]

export const footerNavigation: NavigationLink[] = [
  { label: 'Terms & Conditions', to: routePaths.terms },
  { label: 'Privacy Policy', to: routePaths.privacy },
  { label: 'Contact', to: routePaths.contact },
]