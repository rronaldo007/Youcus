import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { buttonClass } from '@/components/ui/buttonStyles'
import { Avatar } from '@/components/ui/Avatar'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { useDeleteAccount, useDisconnectYouTube, useExportData } from '@/features/account/useAccount'
import { useTheme, type ThemePreference } from '@/features/theme/useTheme'
import { googleYoutubeConnectUrl } from '@/lib/api'

// Réglages › Notes (YC-48) brings the editor's styles and fonts: loaded only on this page.
const NoteSettings = lazy(() => import('@/features/notes/NoteSettings'))

/** The cards of the page, in the order of Figma « Réglages » 17:1239. « #donnees » is the account menu's link. */
const SECTIONS = [
  { id: 'compte', label: 'Compte' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'apparence', label: 'Apparence' },
  { id: 'notes', label: 'Notes' },
  { id: 'donnees', label: 'Données' },
] as const

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'system', label: 'Comme le système' },
]

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titre`} className="flex scroll-mt-6 flex-col items-start gap-4 rounded-[20px] border border-line bg-surface p-6 md:p-7">
      <h2 id={`${id}-titre`} className="font-serif text-title-24 text-content">
        {title}
      </h2>
      {children}
    </section>
  )
}

/** « Connexion YouTube » (Figma 17:1277): read-only access, and the way to withdraw it (YC-80). */
function YouTubeCard({ connected, expired }: { connected: boolean; expired: boolean }) {
  const disconnect = useDisconnectYouTube()
  const [confirming, setConfirming] = useState(false)
  const done = disconnect.data
  return (
    <Card id="youtube" title="Connexion YouTube">
      <p className="text-body-15 text-content-muted">Youcus lit tes playlists en lecture seule. Rien n’est publié, rien n’est modifié sur ton compte.</p>
      {connected ? (
        <>
          <InlineMessage tone="success">Connecté · accès en lecture seule</InlineMessage>
          {confirming ? (
            <div className="flex w-full flex-col gap-3">
              <p className="text-body-15 text-content">
                Youcus oubliera l’accès et Google le retirera. Tes playlists et tes notes restent ; pour importer à nouveau depuis ton compte, il faudra te reconnecter.
              </p>
              <div className="flex flex-col gap-2.5 md:flex-row">
                <button type="button" onClick={() => setConfirming(false)} disabled={disconnect.isPending} className={buttonClass('secondary', 'w-full md:w-auto')}>
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => disconnect.mutate(undefined, { onSettled: () => setConfirming(false) })}
                  disabled={disconnect.isPending}
                  className={buttonClass('danger', 'w-full md:w-auto')}
                >
                  {disconnect.isPending ? 'Déconnexion…' : 'Confirmer la déconnexion'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={buttonClass('secondary', 'w-full md:w-auto')}>
              Déconnecter YouTube
            </button>
          )}
        </>
      ) : (
        <>
          {done && !done.revoked ? (
            // Erased here, but Google did not confirm: the user can withdraw it there.
            <InlineMessage tone="info">
              Accès effacé de Youcus. Google n’a pas confirmé : vérifie les accès de ton compte sur myaccount.google.com/permissions.
            </InlineMessage>
          ) : (
            <InlineMessage tone={expired && !done ? 'error' : 'info'}>
              {done
                ? 'YouTube déconnecté.'
                : expired
                  ? 'Connexion expirée : reconnecte ton compte pour importer tes playlists.'
                  : 'Non connecté : Youcus lit seulement les playlists publiques.'}
            </InlineMessage>
          )}
          <a href={googleYoutubeConnectUrl} className={buttonClass('secondary', 'w-full md:w-auto')}>
            {expired && !done ? 'Reconnecter YouTube' : 'Connecter YouTube'}
          </a>
        </>
      )}
      {disconnect.isError && (
        <div role="alert">
          <InlineMessage tone="error">La déconnexion a échoué. Réessaie dans un instant : rien n’a changé.</InlineMessage>
        </div>
      )}
    </Card>
  )
}

/**
 * Réglages (Figma 17:1219, 17:1615, 17:1702 ; sombre 45:7282, YC-80): the account, YouTube, the theme,
 * the starting settings of notes, the data. The sections are a column on a computer, a row of
 * chips elsewhere. « Objectif de la semaine » waits for the statistics (YC-79).
 */
export function SettingsPage() {
  const { data: user, isLoading } = useCurrentUser()
  const { preference, setPreference } = useTheme()
  const exportData = useExportData()
  const deleteAccount = useDeleteAccount()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const { hash } = useLocation()
  const current = SECTIONS.find((s) => `#${s.id}` === hash)?.id ?? 'compte'

  // A section asked by the address (« Mes données » of the account menu): the router does not scroll to a hash.
  useEffect(() => {
    if (hash && user) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash, user])

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-[calc(100vh-64px)] bg-app">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-16 pt-6 md:px-8 md:pt-8 xl:flex-row xl:items-start xl:gap-12 xl:px-16 xl:pt-10">
        <div className="flex flex-col gap-5 xl:sticky xl:top-6 xl:w-60 xl:shrink-0 xl:gap-1">
          <h1 className="font-serif text-title-34 text-content md:text-title-56">Réglages</h1>
          <nav aria-label="Sections des réglages" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 xl:flex-col xl:overflow-visible [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map((s) => (
              <Link
                key={s.id}
                to={`#${s.id}`}
                aria-current={current === s.id ? 'true' : undefined}
                className={buttonClass(current === s.id ? 'secondary' : 'ghost', 'xl:w-full xl:justify-start')}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Card id="compte" title="Compte">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar user={user} size="menu" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate text-label-14 font-semibold text-content">{user.displayName}</p>
                <p className="truncate text-small-13 font-medium text-content-muted">{user.email}</p>
              </div>
            </div>
            <p className="text-small-13 text-content-muted">Ces informations viennent de ton compte Google et ne se modifient pas ici.</p>
          </Card>

          <YouTubeCard connected={Boolean(user.youtubeConnected)} expired={Boolean(user.youtubeExpired)} />

          <Card id="apparence" title="Apparence">
            <div role="radiogroup" aria-label="Thème" className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={preference === t.value}
                  onClick={() => setPreference(t.value)}
                  className={buttonClass(preference === t.value ? 'primary' : 'secondary', 'w-full md:w-auto')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Card>

          <Card id="notes" title="Notes">
            {/* The full width of the card: the switches sit at its right edge (Figma 42:7100). */}
            <div className="w-full">
              <Suspense fallback={<p className="text-body-15 text-content-muted">Chargement…</p>}>
                <NoteSettings />
              </Suspense>
            </div>
          </Card>

          <Card id="donnees" title="Tes données">
            <p className="text-body-15 text-content-muted">Tout ce que Youcus sait de toi, en un fichier. Supprimer le compte efface aussi tes notes : c’est définitif.</p>
            {confirmingDelete ? (
              <div className="flex w-full flex-col gap-3">
                <p className="text-body-15 text-content">Confirme pour supprimer définitivement ton compte, tes playlists et tes notes.</p>
                <div className="flex flex-col gap-2.5 md:flex-row">
                  <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleteAccount.isPending} className={buttonClass('secondary', 'w-full md:w-auto')}>
                    Annuler
                  </button>
                  <button type="button" onClick={() => deleteAccount.mutate()} disabled={deleteAccount.isPending} className={buttonClass('danger', 'w-full md:w-auto')}>
                    {deleteAccount.isPending ? 'Suppression…' : 'Confirmer la suppression'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
                <button type="button" onClick={() => exportData.mutate()} disabled={exportData.isPending} className={buttonClass('secondary', 'w-full md:w-auto')}>
                  {exportData.isPending ? 'Export…' : 'Exporter mes données'}
                </button>
                {/* « Danger … toujours suivie d'une confirmation » (Figma Bouton 5:117). */}
                <button type="button" onClick={() => setConfirmingDelete(true)} className={buttonClass('danger', 'w-full md:w-auto')}>
                  Supprimer mon compte
                </button>
              </div>
            )}
            {exportData.isError && (
              <div role="alert">
                <InlineMessage tone="error">L’export a échoué. Réessaie plus tard.</InlineMessage>
              </div>
            )}
            {deleteAccount.isError && (
              <div role="alert">
                <InlineMessage tone="error">La suppression a échoué. Réessaie plus tard.</InlineMessage>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  )
}
