import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { buttonClass } from '@/components/ui/buttonStyles'
import { Icon } from '@/components/ui/Icon'
import type { NoteSummary } from '@/features/notes/NoteEditor'

/**
 * The top of a note page (Figma « Note de vidéo » 22:1246, « Note de playlist » 23:1441, YC-77):
 * where it comes from, the title, the save status, « Exporter en .docx » and the main action.
 */
export function NotePageHeader({
  eyebrow,
  title,
  summary,
  extra,
  onExport,
  action,
  children,
}: {
  eyebrow: string
  title: string
  summary: NoteSummary | null
  /** After the status: « 5 repères » for a video. */
  extra?: string
  onExport: () => void
  /** The main action (« Reprendre à 04:05 »), absent when nothing can be resumed. */
  action?: ReactNode
  /** Under the title: the progress of a playlist. */
  children?: ReactNode
}) {
  const status = [summary?.status, extra].filter(Boolean).join(' · ')
  const exporting = summary?.exporting ?? 'idle'
  return (
    <>
      <Link to="/notes" className="self-start font-mono text-mono-12 uppercase text-content-muted hover:text-content">
        ← Mes notes
      </Link>
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between xl:gap-8">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="font-mono text-mono-12 uppercase text-content-muted">{eyebrow}</p>
          <h1 className="break-words font-serif text-title-34 text-content md:text-title-56">{title}</h1>
          {children}
          {status && (
            <p aria-live="polite" className={`flex items-center gap-2 text-small-13 font-medium ${summary?.saved ? 'text-success' : 'text-content-muted'}`}>
              {/* The tick says « saved »: never in front of « Modifié » or « Enregistrement… ». */}
              {summary?.saved && <Icon name="check" size={16} />}
              <span>{status}</span>
            </p>
          )}
          {exporting === 'failed' && (
            <p role="alert" className="text-small-13 font-medium text-error">
              L'export a échoué. Réessaie : ta note n'a pas bougé.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 md:flex-row xl:shrink-0">
          <button type="button" onClick={onExport} aria-busy={exporting === 'busy' || undefined} className={buttonClass('secondary', 'w-full md:w-auto')}>
            {exporting === 'busy' ? 'Export…' : 'Exporter en .docx'}
          </button>
          {action}
        </div>
      </header>
    </>
  )
}
