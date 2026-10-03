import { Link, useLocation } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { buttonClass } from '@/components/ui/buttonStyles'
import { PUBLIC_LINKS, SOON } from '@/components/layout/navItems'

/**
 * Figma « Navigation publique » 87:59. « Lien de la page courante en text/primary, les autres en
 * text/muted. » The links show on a computer only; tablet and phone keep the logo, the theme and
 * « Ouvrir l'app ».
 */
export function PublicNav() {
  const { pathname } = useLocation()
  // Full width, as the bar of the app; the content under it keeps the 1440 px column (Ronaldo, 03/10, YC-90).
  return (
    <header className="flex h-16 items-center justify-between gap-10 border-b border-line px-4 sm:h-[88px] sm:px-8 xl:justify-start xl:px-20">
      <Link to="/" aria-label="Youcus, accueil" className="flex h-11 shrink-0 items-center rounded-yc-sm">
        <Logo size="public" />
      </Link>
      <nav aria-label="Site" className="hidden flex-1 justify-center gap-9 xl:flex">
        {PUBLIC_LINKS.map((l) =>
          l.to ? (
            <Link
              key={l.label}
              to={l.to}
              aria-current={pathname === l.to ? 'page' : undefined}
              // The canvas of 29/09 (YC-91): a line in the signal slides in under the link the pointer is on.
              className={`relative whitespace-nowrap text-body-15 after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-200 after:ease-out hover:text-content hover:after:scale-x-100 ${
                pathname === l.to ? 'text-content' : 'text-content-muted'
              }`}
            >
              {l.label}
            </Link>
          ) : (
            <span key={l.label} aria-disabled="true" title={SOON} className="cursor-not-allowed whitespace-nowrap text-body-15 text-content-muted opacity-60">
              {l.label}
              <span className="sr-only"> ({SOON})</span>
            </span>
          ),
        )}
      </nav>
      <div className="flex shrink-0 items-center gap-2 sm:gap-6">
        <ThemeToggle />
        <Link to="/login" className={buttonClass('primary')}>
          Ouvrir l’app
        </Link>
      </div>
    </header>
  )
}
