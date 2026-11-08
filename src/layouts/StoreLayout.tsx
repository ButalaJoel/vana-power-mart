import { useEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { initAnalytics, trackPageView } from '../lib/analytics'
import { AnnouncementBar } from '../components/store/AnnouncementBar'
import { CategoryNavigation } from '../components/store/CategoryNavigation'
import { StoreFooter } from '../components/store/StoreFooter'
import { StoreHeader } from '../components/store/StoreHeader'

export function StoreLayout() {
  const location = useLocation()

  useEffect(() => {
    initAnalytics()
  }, [])

  // Wait a moment so the page has set its title before the view is counted.
  useEffect(() => {
    const timer = window.setTimeout(() => trackPageView(location.pathname + location.search), 300)
    return () => window.clearTimeout(timer)
  }, [location.pathname, location.search])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AnnouncementBar />

      <StoreHeader />

      <CategoryNavigation />

      <main className="flex-1">
        <Outlet />
      </main>

      <StoreFooter />
      <ScrollRestoration />
    </div>
  )
}