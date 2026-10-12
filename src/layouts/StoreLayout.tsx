import { Outlet } from 'react-router-dom'
import { AnnouncementBar } from '../components/store/AnnouncementBar'
import { CategoryNavigation } from '../components/store/CategoryNavigation'
import { StoreFooter } from '../components/store/StoreFooter'
import { StoreHeader } from '../components/store/StoreHeader'

export function StoreLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AnnouncementBar />

      <StoreHeader />

      <CategoryNavigation />

      <main className="flex-1">
        <Outlet />
      </main>

      <StoreFooter />
    </div>
  )
}