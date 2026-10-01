import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { Logo } from '@/components/ui/Logo'
import { StatusPill } from '@/components/ui/StatusPill'
import { ThemeChoice } from '@/components/ui/ThemeChoice'
import { AccountIdentity, AccountLinks, ROW_CLASS } from '@/components/layout/AccountLinks'
import { APP_TABS, SOON } from '@/components/layout/navItems'
import { SEARCH_PAGE } from '@/features/search/useSearchField'
import { useModalDialog } from '@/features/notes/useModalDialog'
import type { User } from '@/types'

/**
 * Figma « Tiroir de navigation » 108:325, the menu of a phone (button ☰). It slides from the left
 * over a veil; Échap or the veil close it; the focus goes back to the button.
 */
export function NavDrawer({ user, onClose }: { user: User; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const onKeyDown = useModalDialog(true, panel, onClose)
  const { pathname } = useLocation()

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>('[data-drawer-close]')?.focus()
    return () => trigger?.focus()
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-[rgb(23_20_15/0.4)] motion-safe:animate-[yc-fade_150ms_ease-out]" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onKeyDown={onKeyDown}
        className="absolute inset-y-0 left-0 flex w-[320px] max-w-[85vw] flex-col gap-1 overflow-y-auto border-r border-line bg-surface px-4 pb-6 pt-3 motion-safe:animate-[yc-drawer-in_200ms_ease-out]"
      >
        <div className="flex min-h-12 items-center gap-2">
          <Link to="/" onClick={onClose} className="flex h-11 flex-1 items-center rounded-yc-sm">
            <Logo size="drawer" />
          </Link>
          <IconButton icon="close" label="Fermer le menu" onClick={onClose} data-drawer-close />
        </div>

        <Link
          to={SEARCH_PAGE}
          onClick={onClose}
          className="flex min-h-11 items-center gap-2.5 rounded-yc-md bg-sunken px-3.5 text-[15px] text-content-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <Icon name="search" size={18} className="text-content" />
          Rechercher…
        </Link>

        <nav aria-label="Principale" className="mt-2 flex flex-col gap-1">
          {APP_TABS.map((tab) => {
            if (!tab.to) {
              return (
                <span key={tab.label} aria-disabled="true" title={SOON} className={`${ROW_CLASS} cursor-not-allowed opacity-60 hover:bg-transparent hover:text-content-muted`}>
                  <Icon name={tab.icon} size={24} className="text-content" />
                  <span className="flex-1">{tab.label}</span>
                  <StatusPill dot={false}>Bientôt</StatusPill>
                </span>
              )
            }
            const active = tab.match?.(pathname) ?? false
            return (
              <Link
                key={tab.label}
                to={tab.to}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={`${ROW_CLASS} relative ${active ? 'bg-sunken font-semibold text-content' : ''}`}
              >
                {active && <span aria-hidden="true" className="absolute left-0 top-3 h-5 w-[3px] rounded-sm bg-accent" />}
                <Icon name={tab.icon} size={24} className="text-content" />
                {tab.label}
              </Link>
            )
          })}
        </nav>

        <p className="pb-1.5 pl-3 pt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-content-muted">Compte</p>
        <ThemeChoice />
        <AccountLinks onNavigate={onClose} divided={false} />

        <div className="mt-auto pt-6">
          <AccountIdentity user={user} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
