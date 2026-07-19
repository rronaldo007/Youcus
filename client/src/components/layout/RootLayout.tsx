import { Outlet } from 'react-router-dom'
import { AppNav } from '@/components/layout/AppNav'

export function RootLayout() {
  return (
    <div className="min-h-screen">
      <AppNav />
      <Outlet />
    </div>
  )
}
