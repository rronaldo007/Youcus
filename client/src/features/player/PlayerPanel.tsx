import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'

/**
 * What the stage shows in place of the video (Figma « Lecteur › Vidéo indisponible » 98:28789 and
 * « Hors ligne » 98:29065): a sign, what happens, what is kept, and what to do.
 */
export function PlayerPanel({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex w-full flex-col items-center justify-center gap-4 bg-surface px-6 py-10 text-center md:aspect-video">
      <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-status-error-bg text-status-error-text">
        <Icon name={icon} size={28} />
      </span>
      <h2 className="font-serif text-title-34 text-content">{title}</h2>
      <p className="max-w-[520px] text-body-15 text-content-muted">{text}</p>
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2.5">{children}</div>}
    </div>
  )
}
