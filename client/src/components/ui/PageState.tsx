import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SOON } from '@/components/layout/navItems'
import { BUTTON_BASE, buttonClass, type ButtonVariant } from '@/components/ui/buttonStyles'
import { Icon, type IconName } from '@/components/ui/Icon'

export type PageStateKind = 'empty' | 'error' | 'offline' | 'no-results' | 'quota'

const KINDS: Record<PageStateKind, { icon: IconName; className: string }> = {
  empty: { icon: 'plus', className: 'bg-sunken text-content' },
  error: { icon: 'alert', className: 'bg-status-error-bg text-status-error-text' },
  offline: { icon: 'offline', className: 'bg-status-warning-bg text-status-warning-text' },
  'no-results': { icon: 'search', className: 'bg-sunken text-content' },
  quota: { icon: 'gauge', className: 'bg-status-warning-bg text-status-warning-text' },
}

/**
 * A button of the state: a link when it goes somewhere, a button when it does something, greyed with
 * « Bientôt » when its page does not exist yet (the rule of the tabs, decision of 01/10).
 */
export type PageStateAction = { label: string } & (
  | { to: string; onClick?: never; soon?: never }
  | { onClick: () => void; to?: never; soon?: never }
  | { soon: true; to?: never; onClick?: never }
)

function ActionButton({ action, variant }: { action: PageStateAction; variant: ButtonVariant }) {
  if (action.soon) {
    return (
      <span aria-disabled="true" title={SOON} className={`${BUTTON_BASE} cursor-not-allowed text-content opacity-45`}>
        {action.label} · Bientôt
      </span>
    )
  }
  if (action.to !== undefined) {
    return (
      <Link to={action.to} className={buttonClass(variant)}>
        {action.label}
      </Link>
    )
  }
  return (
    <button type="button" onClick={action.onClick} className={buttonClass(variant)}>
      {action.label}
    </button>
  )
}

interface PageStateProps {
  kind: PageStateKind
  title: string
  /** A sentence, or a sentence with a link in it (the address of the error page, YC-83). */
  text: ReactNode
  action?: PageStateAction
  secondaryAction?: PageStateAction
}

/**
 * Figma « État de page » 96:115: an area or a page with nothing to show (first time, error,
 * offline, no result, quota). « Une phrase qui dit ce qui se passe, une qui rassure, une action
 * principale. »
 */
export function PageState({ kind, title, text, action, secondaryAction }: PageStateProps) {
  const { icon, className } = KINDS[kind]
  return (
    <section
      role={kind === 'error' ? 'alert' : undefined}
      className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 px-4 py-14 text-center sm:px-8"
    >
      <span className={`mb-2 flex size-16 items-center justify-center rounded-full ${className}`}>
        <Icon name={icon} size={28} />
      </span>
      <h2 className="font-serif text-[32px] leading-[38px] text-content">{title}</h2>
      <p className="text-body-16 leading-6 text-content-muted">{text}</p>
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap justify-center gap-2.5">
          {action && <ActionButton action={action} variant="primary" />}
          {secondaryAction && <ActionButton action={secondaryAction} variant="ghost" />}
        </div>
      )}
    </section>
  )
}
