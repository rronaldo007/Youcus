import { Outlet } from 'react-router-dom'
import { AppNav } from '@/components/layout/AppNav'
import { useTheme } from '@/features/theme/useTheme'

export function RootLayout() {
  // The theme is applied here, on every page: the player has no bar, so no theme button, to do it
  // (YC-76: opened by a link in dark, it showed light).
  useTheme()
  return (
    <div className="min-h-screen">
      <AppNav />
      <Outlet />
    </div>
  )
}
