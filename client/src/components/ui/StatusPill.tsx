import type { ReactNode } from 'react'

export type PillTone = 'neutral' | 'success' | 'warning' | 'error' | 'accent' | 'outline' | 'mark'

const TONES: Record<PillTone, string> = {
  neutral: 'bg-sunken text-content-muted',
  success: 'bg-status-success-bg text-status-success-text',
  warning: 'bg-status-warning-bg text-status-warning-text',
  error: 'bg-status-error-bg text-status-error-text',
  accent: 'bg-accent text-on-accent',
  outline: 'border border-line-strong text-content',
  mark: 'bg-mark text-on-mark',
}

/**
 * Figma « Pastille d'état » 56:14 (the old « Statut » merged into it). Accent = in progress,
 * Contour = to do, Marque = finished. « Point masquable quand le texte porte déjà un symbole. »
 */
export function StatusPill({ tone = 'neutral', dot = true, children }: { tone?: PillTone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold leading-[15px] ${TONES[tone]}`}>
      {dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
