import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconButton } from '@/components/ui/IconButton'
import { StatusBanner } from '@/components/ui/StatusBanner'
import { useModalDialog } from '@/features/notes/useModalDialog'

/** The playlist's videos in a drawer from the right (Ronaldo, 02/10: « ☰ » on every size). */
function ListDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  const onKeyDown = useModalDialog(true, panel, onClose)
  return (
    <div className="fixed inset-0 z-40">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-[rgb(23_20_15/0.4)] motion-safe:animate-[yc-fade_150ms_ease-out]" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
        className="absolute inset-y-0 right-0 flex w-[380px] max-w-[90vw] flex-col gap-2 overflow-y-auto border-l border-line bg-page p-3"
      >
        <div className="flex justify-end">
          <IconButton icon="close" label="Fermer la liste" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  )
}

interface PlayerShellProps {
  back: { to: string; label: string }
  /** The playlist (or « Vidéo seule ») beside the back arrow, then its place in mono. */
  title: string
  meta: string
  /** The playlist's videos: a « ☰ » button opens them; absent for a video on its own. */
  list?: ReactNode
  offline: boolean
  onRetry: () => void
  /** The stage: the player or its state, the controls, the title, the chapters, the card. */
  children: ReactNode
  /** « Mon cahier ». */
  notebook: ReactNode
}

/**
 * The player in focus mode (Figma « Lecteur » 11:475, 12:380, 12:462 ; sombre 45:6284): no app bar
 * (Ronaldo, 02/10), a stage always dark, the notebook beside it on a computer and under it elsewhere.
 */
export function PlayerShell({ back, title, meta, list, offline, onRetry, children, notebook }: PlayerShellProps) {
  const [listOpen, setListOpen] = useState(false)
  return (
    <div className="min-h-screen bg-page xl:flex">
      <main className="dark flex min-w-0 flex-1 flex-col gap-5 bg-page px-4 pb-10 pt-4 text-content md:px-8 md:pt-6">
        {offline && (
          <div className="-mx-4 -mt-4 md:-mx-8 md:-mt-6">
            <StatusBanner kind="offline" action={{ label: 'Réessayer', onClick: onRetry }}>
              Hors ligne. Tes notes sont enregistrées ici et se synchroniseront au retour du réseau.
            </StatusBanner>
          </div>
        )}
        <header className="flex items-center gap-3">
          <Link
            to={back.to}
            aria-label={back.label}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line text-content hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            <span aria-hidden="true" className="text-[20px] leading-none">
              ←
            </span>
          </Link>
          <div className="flex min-w-0 flex-1 flex-col md:flex-row md:items-baseline md:gap-3">
            <p className="truncate font-serif text-title-24 text-content">{title}</p>
            <p className="truncate font-mono text-mono-12 uppercase text-content-muted">{meta}</p>
          </div>
          {list && <IconButton icon="menu" label="Vidéos de la playlist" variant="outline" onClick={() => setListOpen(true)} />}
        </header>
        {children}
      </main>
      <aside aria-label="Mon cahier" className="bg-page px-4 py-6 md:px-8 xl:sticky xl:top-0 xl:h-screen xl:w-[470px] xl:shrink-0 xl:overflow-y-auto xl:px-5">
        {notebook}
      </aside>
      {listOpen && list && (
        <ListDrawer title="Vidéos de la playlist" onClose={() => setListOpen(false)}>
          {list}
        </ListDrawer>
      )}
    </div>
  )
}
