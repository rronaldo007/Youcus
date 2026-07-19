import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, googleLoginUrl } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { useImportBatch, useMyPlaylists } from '@/features/playlists/usePlaylists'

/** Modal d'import : liste les playlists du compte YouTube à cocher (cf. Figma Import Modal 116:924). */
export function ImportModal() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useMyPlaylists()
  const importBatch = useImportBatch()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function close() {
    navigate('/')
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function onImport() {
    if (selected.size === 0) return
    importBatch.mutate([...selected], { onSuccess: () => navigate('/') })
  }

  // L'utilisateur s'est connecté avant l'ajout du scope YouTube → reconsentement requis.
  const needsReconnect = error instanceof ApiError && error.status === 403

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Importer des playlists YouTube"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-card border border-line bg-surface p-5 text-left">
        <h2 className="text-lg font-semibold text-content">Importer des playlists YouTube</h2>
        <p className="mt-1 text-sm text-content-muted">Vos playlists YouTube — cochez celles à importer.</p>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {needsReconnect ? (
            <div className="rounded-card border border-dashed border-line p-4 text-center">
              <p className="text-sm text-content">Connectez votre compte YouTube pour voir vos playlists.</p>
              <a
                href={googleLoginUrl}
                className="mt-3 inline-block rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple-dark"
              >
                Connecter mon compte YouTube
              </a>
            </div>
          ) : isLoading ? (
            <p className="text-content-muted">Chargement de vos playlists…</p>
          ) : error ? (
            <p role="alert" className="text-accent-red">
              {(error as Error).message}
            </p>
          ) : !data || data.length === 0 ? (
            <p className="text-content-muted">Aucune playlist sur votre compte YouTube.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.map((pl) => (
                <li key={pl.youtubeId}>
                  <label
                    className={`flex items-center gap-3 rounded-card border border-line p-2 ${
                      pl.alreadyImported ? 'opacity-60' : 'cursor-pointer hover:bg-surface-2'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={pl.alreadyImported}
                      checked={selected.has(pl.youtubeId)}
                      onChange={() => toggle(pl.youtubeId)}
                      aria-label={`Sélectionner ${pl.title}`}
                    />
                    {pl.thumbnailUrl && (
                      <img src={pl.thumbnailUrl} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-content">{pl.title}</span>
                      <span className="block text-xs text-content-muted">{pl.videoCount} vidéos</span>
                    </span>
                    {pl.alreadyImported && (
                      <span className="shrink-0 text-xs font-medium text-success">✓ Déjà importée</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {importBatch.isError && (
          <p role="alert" className="mt-2 text-sm text-accent-red">
            {(importBatch.error as Error).message}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Fermer
          </Button>
          <Button type="button" onClick={onImport} disabled={selected.size === 0 || importBatch.isPending}>
            {importBatch.isPending ? 'Import…' : `Importer la sélection${selected.size ? ` (${selected.size})` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
