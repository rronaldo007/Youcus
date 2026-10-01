import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatDuration, formatTimestamp } from '@/lib/format'
import { isTyping } from '@/lib/keyboard'
import '@/features/notes/note-editor.css'
import './end-card.css'

/** The video that comes next in the playlist, as the card shows it. */
export interface EndCardNext {
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  /** 1-based, as « 5 / 17 ». */
  number: number
  to: string
}

/** Sends the sentence to the note: false when the note cannot take it yet; `done` tells what the server said. */
export type SaveSentence = (text: string, done: { onSuccess: () => void; onError: () => void }) => boolean

/** Where the video was watched: the two contexts of Figma « Fin de vidéo » 102:168. */
export type EndCardContext =
  | {
      kind: 'playlist'
      /** 1-based position of the video that ended, and the length of the playlist. */
      number: number
      total: number
      /** null on the last video of the playlist. */
      next: EndCardNext | null
      playlistTo: string
    }
  /** A video kept on its own (YC-61): nothing comes next, the dashboard is where it lives. */
  | { kind: 'single'; homeTo: string }

interface EndCardProps {
  context: EndCardContext
  /** Where the sentence is timestamped: the end of the video. */
  seconds: number
  onSave: SaveSentence
  onReplay: () => void
}

type Status = 'idle' | 'saving' | 'saved' | 'failed' | 'unavailable'

/**
 * The end of a video (YC-60), Figma « Fin de vidéo » 102:168: over the player when it ends, before
 * YouTube's end screen. « Une phrase pour retenir ? » goes into the note as a line timestamped at
 * the end of the video; the next video waits for a click, never a countdown. Always dark.
 */
export function EndCard({ context, seconds, onSave, onReplay }: EndCardProps) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [skipped, setSkipped] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLAnchorElement>(null)
  const helpId = useId()
  const time = formatTimestamp(seconds)

  // The question takes the focus, unless the user is writing elsewhere (the note): never steal it.
  useEffect(() => {
    if (!isTyping(document.activeElement)) inputRef.current?.focus({ preventScroll: true })
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const sentence = text.trim()
    if (!sentence || status === 'saving') return
    setStatus('saving')
    const sent = onSave(sentence, {
      onSuccess: () => setStatus('saved'),
      onError: () => setStatus('failed'),
    })
    if (!sent) setStatus('unavailable')
  }

  // Échap passes the question: the next step takes the focus.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || status === 'saved') return
    e.preventDefault()
    setSkipped(true)
    requestAnimationFrame(() => nextRef.current?.focus())
  }

  const asking = !skipped && status !== 'saved'

  return (
    <section className="yc-end-wrap" aria-label="Fin de la vidéo">
      <div className="yc-end">
        <p className="yc-end-eyebrow">
          {context.kind === 'single' ? 'VIDÉO SEULE' : `VIDÉO ${context.number} / ${context.total}`} · TERMINÉE ✓
        </p>

        {asking && (
          <>
            <h2 className="yc-end-title">Une phrase pour retenir ?</h2>
            <form className="yc-end-answer" onSubmit={submit} onKeyDown={onKeyDown}>
              <input
                ref={inputRef}
                className="yc-end-input"
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  if (status === 'failed' || status === 'unavailable') setStatus('idle')
                }}
                maxLength={500}
                placeholder="Ce que je retiens : …"
                aria-label="Une phrase pour retenir"
                aria-describedby={helpId}
              />
              <button
                type="submit"
                className="yc-end-save"
                disabled={!text.trim() || status === 'saving'}
                aria-label={status === 'saving' ? 'Envoi…' : 'Dans le cahier'}
              >
                <span className="yc-end-save-long" aria-hidden="true">{status === 'saving' ? 'Envoi…' : 'Dans le cahier'}</span>
                <span className="yc-end-save-short" aria-hidden="true">
                  {status === 'saving' ? '…' : 'OK'}
                </span>
              </button>
            </form>
            {status === 'failed' ? (
              <p id={helpId} role="alert" className="yc-end-help yc-end-error">
                Pas encore enregistrée : la phrase est dans ta note, un nouvel essai part dans un instant.
              </p>
            ) : status === 'unavailable' ? (
              <p id={helpId} role="alert" className="yc-end-help yc-end-error">
                Ta note n'est pas encore prête. Réessaie dans un instant : ta phrase est toujours là.
              </p>
            ) : (
              <p id={helpId} className="yc-end-help">
                Enregistrée à {time} dans ta note, comme un repère. Entrée pour valider, Échap pour passer.
              </p>
            )}
          </>
        )}

        {status === 'saved' && (
          <p role="status" className="yc-end-done">
            ✓ Dans ta note, à {time}.
          </p>
        )}

        <div className="yc-end-gap" aria-hidden="true" />

        {context.kind === 'single' ? (
          <>
            {/* « Voir le catalogue » of 104:212 waits for the catalogue (Sprint 5). */}
            <div className="yc-end-after">
              <p className="yc-end-after-text">Cette vidéo n'appartient à aucune playlist. Sa note reste avec elle.</p>
              <div className="yc-end-actions">
                <button type="button" className="yc-end-btn yc-end-ghost" onClick={onReplay}>
                  Revoir
                </button>
                <Link ref={nextRef} to={context.homeTo} className="yc-end-btn yc-end-secondary">
                  Retour au tableau de bord
                </Link>
              </div>
            </div>
            <p className="yc-end-note">Pas de lecture automatique : c'est toi qui décides quand continuer.</p>
          </>
        ) : context.next ? (
          <>
            <div className="yc-end-next">
              {context.next.thumbnailUrl ? (
                <img className="yc-end-thumb" src={context.next.thumbnailUrl} alt="" loading="lazy" />
              ) : (
                <div className="yc-end-thumb" aria-hidden="true" />
              )}
              <div className="yc-end-next-text">
                <p className="yc-end-next-eyebrow">
                  SUIVANTE · {context.next.number} / {context.total}
                </p>
                <p className="yc-end-next-title">{context.next.title}</p>
                {/* Figma adds the channel: the playlist only knows its own, not the video's. */}
                <p className="yc-end-next-meta">{formatDuration(context.next.durationSeconds)}</p>
              </div>
              <div className="yc-end-actions">
                <button type="button" className="yc-end-btn yc-end-ghost" onClick={onReplay}>
                  Revoir
                </button>
                <Link ref={nextRef} to={context.next.to} state={{ autoplay: true }} className="yc-end-btn yc-end-secondary">
                  Lire la suivante →
                </Link>
              </div>
            </div>
            <p className="yc-end-note">Pas de lecture automatique : c'est toi qui décides quand continuer.</p>
          </>
        ) : (
          <div className="yc-end-actions yc-end-last">
            <button type="button" className="yc-end-btn yc-end-ghost" onClick={onReplay}>
              Revoir
            </button>
            <Link ref={nextRef} to={context.playlistTo} className="yc-end-btn yc-end-secondary">
              Retour à la playlist →
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
