import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { useDeleteAccount, useExportData } from '@/features/account/useAccount'
import { useTheme } from '@/features/theme/useTheme'

type Theme = 'light' | 'dark'
const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Clair', icon: '☀' },
  { value: 'dark', label: 'Sombre', icon: '☾' },
]

/**
 * Écran Réglages : profil (avatar/nom/email), préférence de thème et zone RGPD.
 * Conteneur qui héberge les actions « Exporter / Supprimer mes données » (CS-22).
 * Réf. design Figma Settings 38:350 (clair) / 38:395 (sombre).
 */
export function SettingsPage() {
  const { data: user, isLoading } = useCurrentUser()
  const { theme, toggle } = useTheme()
  const exportData = useExportData()
  const deleteAccount = useDeleteAccount()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />

  const selectTheme = (value: Theme) => {
    if (value !== theme) toggle()
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 sm:px-10">
      <h1 className="text-2xl font-bold text-content">Réglages</h1>
      <p className="mt-1 text-sm text-content-muted">Gère ton compte et tes préférences.</p>

      {/* Profil */}
      <section aria-labelledby="settings-profil" className="mt-8 rounded-card border border-line bg-canvas p-6">
        <h2 id="settings-profil" className="text-sm font-semibold uppercase tracking-wide text-content-muted">
          Profil
        </h2>
        <div className="mt-4 flex items-center gap-4">
          <Avatar user={user} />
          <div className="min-w-0">
            <p className="truncate font-medium text-content">{user.displayName}</p>
            <p className="truncate text-sm text-content-muted">{user.email}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-content-muted">
          Ces informations proviennent de ton compte Google et ne sont pas modifiables ici.
        </p>
      </section>

      {/* Préférences */}
      <section aria-labelledby="settings-theme" className="mt-6 rounded-card border border-line bg-canvas p-6">
        <h2 id="settings-theme" className="text-sm font-semibold uppercase tracking-wide text-content-muted">
          Apparence
        </h2>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-content">Thème</p>
            <p className="text-sm text-content-muted">Choisis l'apparence claire ou sombre.</p>
          </div>
          <div role="group" aria-label="Thème" className="flex rounded-lg border border-line p-1">
            {THEME_OPTIONS.map((opt) => {
              const active = theme === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectTheme(opt.value)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    active ? 'bg-brand-purple text-white' : 'text-content-muted hover:bg-surface-2'
                  }`}
                >
                  <span aria-hidden>{opt.icon}</span>
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Données personnelles (RGPD) — héberge CS-22 */}
      <section aria-labelledby="settings-rgpd" className="mt-6 rounded-card border border-line bg-canvas p-6">
        <h2 id="settings-rgpd" className="text-sm font-semibold uppercase tracking-wide text-content-muted">
          Données personnelles
        </h2>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-content">Exporter mes données</p>
            <p className="text-sm text-content-muted">Télécharge une copie de tes données au format JSON.</p>
          </div>
          <button
            type="button"
            onClick={() => exportData.mutate()}
            disabled={exportData.isPending}
            className="shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-medium text-content transition hover:bg-surface-2 disabled:opacity-60"
          >
            {exportData.isPending ? 'Export…' : 'Exporter'}
          </button>
        </div>
        {exportData.isError && (
          <p role="alert" className="mt-2 text-sm text-accent-red">
            L'export a échoué. Réessaie plus tard.
          </p>
        )}

        <hr className="my-5 border-line" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-accent-red">Supprimer mon compte</p>
            <p className="text-sm text-content-muted">Cette action est définitive et supprime toutes tes données.</p>
          </div>
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="shrink-0 rounded-lg border border-accent-red/40 px-4 py-2 text-sm font-medium text-accent-red transition hover:bg-accent-red/10"
            >
              Supprimer
            </button>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleteAccount.isPending}
                className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-content transition hover:bg-surface-2 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => deleteAccount.mutate()}
                disabled={deleteAccount.isPending}
                className="rounded-lg bg-accent-red px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {deleteAccount.isPending ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            </div>
          )}
        </div>
        {confirmingDelete && (
          <p className="mt-2 text-sm text-content-muted">
            Confirme pour supprimer définitivement ton compte et toutes tes données.
          </p>
        )}
        {deleteAccount.isError && (
          <p role="alert" className="mt-2 text-sm text-accent-red">
            La suppression a échoué. Réessaie plus tard.
          </p>
        )}
      </section>
    </main>
  )
}
