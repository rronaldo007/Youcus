import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { TopNav } from '@/components/layout/TopNav'
import { TopBarMobile } from '@/components/layout/TopBarMobile'
import { BottomNav } from '@/components/layout/BottomNav'
import { useSearchShortcut } from '@/features/search/useSearchShortcut'
import type { User } from '@/types'

/** Navigation applicative responsive : n'apparaît que pour un utilisateur connecté. */
export function AppNav() {
  const { data: user } = useCurrentUser()
  if (!user) return null
  return <SignedInNav user={user} />
}

/** The nav of a signed-in user, and « / » to search (YC-22). */
function SignedInNav({ user }: { user: User }) {
  useSearchShortcut()

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
