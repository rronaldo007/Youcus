import { useId, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, googleYoutubeConnectUrl } from '@/lib/api'
import { buttonClass } from '@/components/ui/buttonStyles'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { StatusPill } from '@/components/ui/StatusPill'
import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { useAddLibraryVideo } from '@/features/library/useLibrary'
import { useModalDialog } from '@/features/notes/useModalDialog'
import { useImportPlaylist } from '@/features/playlists/useImportPlaylist'
import { useImportBatch, useMyPlaylists } from '@/features/playlists/usePlaylists'
import { quotaResetTime } from '@/lib/format'
import { linkKind } from '@/lib/youtubeLink'

/** Messages de retour du flux « connecter YouTube » (paramètre `?youtube=`). */
const YOUTUBE_FLOW_MESSAGES: Record<string, string> = {
  denied: "L'accès à YouTube a été refusé. Accorde-le pour importer les playlists de ton compte.",
  mismatch: 'Connecte le même compte Google que celui de ta session Youcus.',
}

const isQuota = (error: unknown) => error instanceof ApiError && error.code === 'youtube_quota'

/** « Quota YouTube du jour atteint » (Figma 98:27737): what happens, what is kept, when it comes back. */
function QuotaReached({ onClose }: { onClose: () => void }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 px-2 py-6 text-center">
      <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-status-warning-bg text-status-warning-text">
        <Icon name="gauge" size={28} />
      </span>
      <h3 className="font-serif text-[28px] leading-tight text-content">Quota YouTube du jour atteint</h3>
      <p className="max-w-[440px] text-body-15 text-content-muted">
        YouTube limite le nombre d’imports par jour pour toute l’application. Ça reprend à {quotaResetTime()}, heure de Paris. Tes playlists déjà importées restent lisibles, et ton cahier aussi.
      </p>
      <div className="flex flex-col gap-2.5 md:flex-row">
        <button type="button" onClick={onClose} className={buttonClass('primary')}>
          Compris
        </button>
        <Link to="/" className={buttonClass('ghost')}>
          Voir mes playlists
        </Link>
      </div>
    </div>
  )
}

/**
 * « Importer des playlists » (Figma 17:2025, feuille du bas 17:2334, sombre 45:7748 ; Erreur 98:27453,
 * Quota atteint 98:27737, YC-81): a link (a playlist, or a video kept on its own, decision of Ronaldo,
 * 02/10), or the playlists of the YouTube account, added one by one, imported together.
 */
export function ImportModal() {
  const { data: user, isLoading: userLoading } = useCurrentUser()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data, isLoading, error } = useMyPlaylists()
  const importBatch = useImportBatch()
  const importLink = useImportPlaylist()
  const addVideo = useAddLibraryVideo()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const fieldId = useId()
  const errorId = useId()

  function close() {
    navigate('/')
  }
  const onKeyDown = useModalDialog(true, panel, close)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const value = link.trim()
    if (value) {
      const kind = linkKind(value)
      if (!kind) {
        setLinkError('Ce lien n’est ni une playlist ni une vidéo YouTube. Un lien de playlist contient « list= ».')
        return
      }
      setLinkError(null)
      // The video opens in its player; a playlist, on its page.
      if (kind === 'video') addVideo.mutate(value, { onSuccess: (v) => navigate(`/videos/${v.youtubeId}`) })
      else importLink.mutate(value, { onSuccess: (p) => navigate(`/playlists/${p.id}`) })
      return
    }
    if (selected.size > 0) importBatch.mutate([...selected], { onSuccess: () => navigate('/') })
  }

  // La connexion n'accorde que l'identité : l'accès YouTube se demande ici, au premier import.
  const needsConnect = error instanceof ApiError && error.status === 403
  const flowMessage = YOUTUBE_FLOW_MESSAGES[params.get('youtube') ?? '']
  const pending = importBatch.isPending || importLink.isPending || addVideo.isPending
  const failed = [importBatch, importLink, addVideo].find((m) => m.isError)?.error
  const quota = isQuota(error) || isQuota(failed)
  const action = link.trim()
    ? linkKind(link) === 'video'
      ? 'Ajouter la vidéo'
      : 'Importer le lien'
    : selected.size > 0
      ? `Importer ${selected.size} playlist${selected.size > 1 ? 's' : ''}`
      : 'Importer'

  // Without a session there is nothing to import into: the sign-in, never « Authentification requise » in the window.
  if (!userLoading && !user) return <Navigate to="/login" replace />

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-4">
      <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-[rgb(18_17_16/0.45)] motion-safe:animate-[yc-fade_150ms_ease-out]" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="relative flex max-h-[90vh] w-full flex-col gap-5 overflow-hidden rounded-t-[20px] border border-line bg-surface px-4 pb-4 pt-6 shadow-[0_24px_64px_rgb(23_20_15/0.22)] md:w-[600px] md:rounded-[20px] md:p-8"
      >
        <div className="flex items-start gap-3">
          <h2 id={titleId} className="flex-1 font-serif text-title-34 text-content">
            Importer des playlists
          </h2>
          <IconButton icon="close" label="Fermer" onClick={close} />
        </div>

        {flowMessage && (
          <div role="alert">
            <InlineMessage tone="error">{flowMessage}</InlineMessage>
          </div>
        )}

        {quota ? (
          <QuotaReached onClose={close} />
        ) : (
          <>
            <form onSubmit={submit} className="flex flex-col gap-1.5">
              {/* No asterisk: the field is optional, the account's playlists import without it. */}
              <label htmlFor={fieldId} className="text-label-14 font-semibold text-content">
                Lien d’une playlist ou d’une vidéo
              </label>
              <input
                id={fieldId}
                type="text"
                inputMode="url"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value)
                  setLinkError(null)
                }}
                placeholder="youtube.com/playlist?list=PL…"
                aria-invalid={linkError ? true : undefined}
                aria-describedby={linkError ? errorId : undefined}
                className={`h-10 w-full rounded-yc-md border bg-surface px-3 text-body-15 text-content placeholder:text-content-muted focus:border-2 focus:outline-none ${
                  linkError ? 'border-2 border-error' : 'border-line focus:border-line-strong'
                }`}
              />
              {linkError && <InlineMessage tone="error" id={errorId}>{linkError}</InlineMessage>}
            </form>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-mono-12 uppercase text-content-muted">Ou dans ton compte YouTube</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            {needsConnect ? (
              <div className="flex flex-col items-start gap-3 rounded-yc-lg border border-dashed border-line p-4">
                <p className="text-body-15 text-content">Connecte ton compte YouTube pour voir tes playlists.</p>
                <InlineMessage tone="info">L’accès YouTube est en lecture seule.</InlineMessage>
                <a href={googleYoutubeConnectUrl} className={buttonClass('secondary')}>
                  Connecter YouTube
                </a>
              </div>
            ) : isLoading ? (
              <p className="text-body-15 text-content-muted">Chargement de tes playlists…</p>
            ) : error ? (
              <div role="alert">
                <InlineMessage tone="error">{(error as Error).message}</InlineMessage>
              </div>
            ) : !data || data.length === 0 ? (
              <p className="text-body-15 text-content-muted">Aucune playlist sur ton compte YouTube.</p>
            ) : (
              // The list scrolls on its own: with 200 playlists the field and the buttons stay in view.
              <ul aria-label="Mes playlists YouTube" className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
                {data.map((pl) => {
                  const added = selected.has(pl.youtubeId)
                  return (
                    <li key={pl.youtubeId} className="flex items-center gap-3.5 border-t border-line py-2.5">
                      <span className="relative hidden h-[45px] w-20 shrink-0 overflow-hidden rounded-lg bg-stage md:block">
                        {pl.thumbnailUrl && <img src={pl.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-label-14 font-semibold text-content">{pl.title}</span>
                        <span className="text-small-13 font-medium text-content-muted">
                          {pl.videoCount} vidéo{pl.videoCount > 1 ? 's' : ''}
                        </span>
                      </span>
                      {pl.alreadyImported ? (
                        <StatusPill dot={false}>✓ Déjà importée</StatusPill>
                      ) : (
                        <button
                          type="button"
                          aria-pressed={added}
                          aria-label={`${added ? 'Retirer' : 'Ajouter'} ${pl.title}`}
                          onClick={() => toggle(pl.youtubeId)}
                          className={buttonClass(added ? 'primary' : 'secondary')}
                        >
                          {added ? '✓ Ajoutée' : 'Ajouter'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {failed && !isQuota(failed) && (
              <div role="alert">
                <InlineMessage tone="error">{(failed as Error).message}</InlineMessage>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2.5 md:flex-row md:justify-end">
              <button type="button" onClick={close} className={buttonClass('secondary', 'w-full md:w-auto')}>
                Annuler
              </button>
              <button type="button" onClick={() => submit()} disabled={pending || (!link.trim() && selected.size === 0)} className={buttonClass('primary', 'w-full md:w-auto')}>
                {pending ? 'Import…' : action}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
