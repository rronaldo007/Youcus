import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { TopNav } from '@/components/layout/TopNav'
import { TopBarMobile } from '@/components/layout/TopBarMobile'
import { BottomNav } from '@/components/layout/BottomNav'

/** Navigation applicative responsive : n'apparaît que pour un utilisateur connecté. */
export function AppNav() {
  const { data: user } = useCurrentUser()
  if (!user) return null

  return (
    <>
      {/* Desktop / tablette */}
      <div className="hidden md:block">
        <TopNav user={user} />
      </div>
      {/* Mobile */}
      <div className="md:hidden">
        <TopBarMobile user={user} />
        <BottomNav />
      </div>
    </>
  )
}
