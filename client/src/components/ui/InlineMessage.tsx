import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'

export type MessageTone = 'error' | 'success' | 'info'

const TONES: Record<MessageTone, { icon: IconName; className: string }> = {
  error: { icon: 'alert', className: 'text-error' },
  success: { icon: 'check', className: 'text-success' },
  info: { icon: 'clock', className: 'text-content-muted' },
}

/**
 * Figma « Message » 5:156, placed under the field it is about. « Toujours une icône ET un texte qui
 * nomme le problème : jamais la couleur seule. »
 */
export function InlineMessage({ tone, id, children }: { tone: MessageTone; id?: string; children: ReactNode }) {
  const { icon, className } = TONES[tone]
  return (
    <p id={id} data-tone={tone} className={`flex items-center gap-2 text-small-13 font-medium ${className}`}>
      <Icon name={icon} size={16} />
      <span>{children}</span>
    </p>
  )
}
