import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { UserMenu } from '@/components/layout/UserMenu'
import type { User } from '@/types'

/** Barre supérieure mobile (cf. Figma TopBarMobile 32:149). */
export function TopBarMobile({ user }: { user: User }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4">
      <Logo />
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  )
}
