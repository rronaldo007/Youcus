import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'

export type BannerKind = 'offline' | 'warning' | 'error' | 'info'

const KINDS: Record<BannerKind, { icon: IconName; className: string }> = {
  offline: { icon: 'offline', className: 'bg-sunken text-content' },
  warning: { icon: 'alert', className: 'bg-status-warning-bg text-status-warning-text' },
  error: { icon: 'alert', className: 'bg-status-error-bg text-status-error-text' },
  info: { icon: 'clock', className: 'bg-sunken text-content' },
}

interface StatusBannerProps {
  kind: BannerKind
  children: ReactNode
  /** One action, underlined (« Réessayer »). */
  action?: { label: string; onClick: () => void }
  /** « Fermable sauf Hors ligne et Erreur. » */
  onClose?: () => void
}

/**
 * Figma « Bandeau d'état » 96:180: full width under the navigation, for a state of the whole
 * session (offline, quota, expired token). One line, one action.
 */
export function StatusBanner({ kind, children, action, onClose }: StatusBannerProps) {
  const { icon, className } = KINDS[kind]
  const closable = onClose && kind !== 'offline' && kind !== 'error'
  return (
    <div
      role={kind === 'error' || kind === 'offline' ? 'alert' : 'status'}
      className={`flex w-full items-center gap-3 border-b border-line px-4 py-2.5 sm:px-6 ${className}`}
    >
      <Icon name={icon} />
      <p className="min-w-0 flex-1 text-label-14 font-medium">{children}</p>
      {action && (
        <button type="button" onClick={action.onClick} className="shrink-0 text-label-14 font-semibold underline underline-offset-2">
          {action.label}
        </button>
      )}
      {closable && (
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="-my-3 -mr-3 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-[rgb(23_20_15/0.06)]"
        >
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  )
}
