import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import searchIcon from '@/features/search/icons/search.svg'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { UserMenu } from '@/components/layout/UserMenu'
import type { User } from '@/types'

/** Barre supérieure mobile (cf. Figma TopBarMobile 32:149). */
export function TopBarMobile({ user }: { user: User }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4">
      <Logo />
      <div className="flex items-center gap-1.5">
        {/* The search (YC-22): the field is in the page on a phone. */}
        <Link to="/recherche" aria-label="Rechercher" className="flex size-11 items-center justify-center rounded-full text-content">
          <span
            aria-hidden="true"
            className="inline-block size-5 bg-current"
            style={{ mask: `url("${searchIcon}") center / contain no-repeat`, WebkitMask: `url("${searchIcon}") center / contain no-repeat` }}
          />
        </Link>
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  )
}
