import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { ImportPlaylistForm } from '@/features/playlists/ImportPlaylistForm'
import { PlaylistLibrary } from '@/features/playlists/PlaylistLibrary'
import { LandingPage } from '@/routes/public/LandingPage'

export function HomePage() {
  const { data: user, isLoading } = useCurrentUser()

  if (isLoading) return null
  // Visiteur non connecté → page d'accueil (landing).
  if (!user) return <LandingPage />

  // Utilisateur connecté → tableau de bord (fidélité design : CS-59).
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold text-content">
        Bonjour <span className="text-brand-purple">{user.displayName}</span>
      </h1>
      <p className="mt-1 text-content-muted">Importe une playlist pour commencer.</p>
      <div className="mt-6">
        <ImportPlaylistForm />
      </div>
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-content">Mes playlists</h2>
        <PlaylistLibrary />
      </section>
    </main>
  )
}
