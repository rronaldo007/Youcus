import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { Logo } from '@/components/ui/Logo'
import { StatusBanner } from '@/components/ui/StatusBanner'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { buttonClass } from '@/components/ui/buttonStyles'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { NavDrawer } from '@/components/layout/NavDrawer'
import { APP_TABS, SOON, isPlayerPath } from '@/components/layout/navItems'
import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { MAX_QUERY } from '@/features/search/search'
import { SEARCH_PAGE, useSearchField } from '@/features/search/useSearchField'
import { useSearchShortcut } from '@/features/search/useSearchShortcut'
import { googleYoutubeConnectUrl } from '@/lib/api'
import type { User } from '@/types'

/** Navigation applicative responsive : n'apparaît que pour un utilisateur connecté. */
export function AppNav() {
  const { data: user } = useCurrentUser()
  const { pathname } = useLocation()
  // The player is in focus mode, without the bar (Figma « Lecteur » 11:475, Ronaldo 02/10).
  if (!user || isPlayerPath(pathname)) return null
  return (
    <>
      <AppBar user={user} />
      {/* A state of the whole session, under the bar, not closable (Figma 98:16852, YC-84). */}
      {user.youtubeExpired && (
        <StatusBanner kind="error" action={{ label: 'Reconnecter YouTube', onClick: () => window.location.assign(googleYoutubeConnectUrl) }}>
          Connexion YouTube expirée : reconnecte ton compte pour importer ou synchroniser. Tes notes ne sont pas concernées.
        </StatusBanner>
      )}
    </>
  )
}

/** The tabs of the bar: the current one underlined in the red signal, those without a page greyed. */
function Tabs() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Principale" className="flex h-16 shrink-0 items-stretch gap-3.5 xl:gap-7">
      {APP_TABS.map((tab) => {
        if (!tab.to) {
          return (
            <span
              key={tab.label}
              aria-disabled="true"
              title={SOON}
              className="flex cursor-not-allowed items-center whitespace-nowrap border-b-2 border-transparent text-body-15 text-content-muted opacity-60"
            >
              {tab.label}
              <span className="sr-only"> ({SOON})</span>
            </span>
          )
        }
        const active = tab.match?.(pathname) ?? false
        return (
          <Link
            key={tab.label}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center whitespace-nowrap border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
              active ? 'border-accent text-label-14 font-semibold text-content' : 'border-transparent text-body-15 text-content-muted hover:text-content'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

/** The search field of a computer (YC-22): « / » comes here, Entrée opens the results. */
function SearchField() {
  const { draft, setDraft, submit, onKeyDown } = useSearchField()
  return (
    <form role="search" onSubmit={submit} className="flex min-w-0 flex-1">
      <input
        type="search"
        data-search-field=""
        aria-label="Rechercher dans tes playlists, tes vidéos et tes notes"
        placeholder="Rechercher une playlist, une vidéo, une note…"
        value={draft}
        maxLength={MAX_QUERY}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        className="h-10 w-full min-w-0 rounded-full bg-sunken px-4 text-body-15 text-content outline-none placeholder:text-content-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-line-strong"
      />
    </form>
  )
}

/**
 * Figma « Barre de navigation » 5:433. Computer: tabs, search field, Importer. Tablet: the search
 * becomes a button. Phone: ☰ opens the drawer with the tabs; « l'action principale (Importer) reste
 * visible hors du menu ». All targets 44 px.
 */
export function AppBar({ user }: { user: User }) {
  useSearchShortcut()
  const [drawer, setDrawer] = useState(false)

  return (
    <header className="relative z-20 border-b border-line bg-page">
      {/* Computer and tablet */}
      <div className="hidden h-16 items-center gap-3 px-6 md:flex xl:gap-10 xl:px-16">
        <Link to="/" aria-label="Youcus, tableau de bord" className="flex h-11 shrink-0 items-center rounded-yc-sm">
          <Logo />
        </Link>
        <Tabs />
        <div className="hidden min-w-0 flex-1 xl:flex">
          <SearchField />
        </div>
        <div className="flex-1 xl:hidden" />
        <Link to={SEARCH_PAGE} aria-label="Rechercher" className="flex size-11 shrink-0 items-center justify-center rounded-full text-content hover:bg-sunken xl:hidden">
          <Icon name="search" />
        </Link>
        <Link to="/import" className={buttonClass('primary')}>
          + Importer
        </Link>
        <div className="flex shrink-0 items-center gap-3 xl:gap-10">
          <ThemeToggle />
          <AccountMenu user={user} />
        </div>
      </div>

      {/* Phone */}
      <div className="flex h-[60px] items-center gap-1 px-2 md:hidden">
        <IconButton icon="menu" label="Ouvrir le menu" aria-expanded={drawer} onClick={() => setDrawer(true)} />
        <Link to="/" aria-label="Youcus, tableau de bord" className="flex h-11 min-w-0 flex-1 items-center rounded-yc-sm">
          <Logo />
        </Link>
        <Link
          to="/import"
          aria-label="Importer une playlist"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent hover:bg-accent-hover"
        >
          <Icon name="plus" />
        </Link>
        <ThemeToggle />
        <AccountMenu user={user} />
      </div>

      {drawer && <NavDrawer user={user} onClose={() => setDrawer(false)} />}
    </header>
  )
}
