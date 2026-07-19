import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { UserMenu } from '@/components/layout/UserMenu'
import type { User } from '@/types'

// Liens de navigation (routes à venir dans de futurs tickets).
const NAV_LINKS = [
  { label: 'Tableau de bord', active: true },
  { label: 'Statistiques', active: false },
  { label: 'Mes notes', active: false },
]

/** Barre de navigation desktop (cf. Figma TopNav 32:6). */
export function TopNav({ user }: { user: User }) {
  return (
    <header className="flex h-16 items-center justify-between gap-6 border-b border-line bg-surface px-7">
      <Logo />

      <nav className="flex items-center gap-[22px] text-sm font-medium">
        {NAV_LINKS.map((link) => (
          <button
            key={link.label}
            type="button"
            className={link.active ? 'text-content' : 'text-content-muted transition hover:text-content'}
          >
            {link.label}
          </button>
        ))}
      </nav>

      <input
        type="search"
        placeholder="Rechercher une playlist, une vidéo…"
        className="w-full min-w-0 max-w-[560px] flex-1 rounded-[22px] border border-line bg-surface-2 px-4 py-2.5 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
      />

      <div className="flex shrink-0 items-center gap-3.5">
        <Button variant="primary">+ Importer</Button>
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  )
}
