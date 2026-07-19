import { googleLoginUrl } from '@/lib/api'
import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { ImportPlaylistForm } from '@/features/playlists/ImportPlaylistForm'
import { PlaylistLibrary } from '@/features/playlists/PlaylistLibrary'

export function HomePage() {
  const { data: user, isLoading } = useCurrentUser()

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        You<span className="text-brand-purple">cus</span>
      </h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400">
        Une couche d'étude sans distraction par-dessus YouTube : playlists, lecteur
        focus, notes Markdown et suivi de progression.
      </p>

      {isLoading ? null : user ? (
        <div className="flex w-full flex-col items-center gap-4">
          <p className="text-lg font-medium">
            Bonjour <span className="text-brand-purple">{user.displayName}</span> — importez une
            playlist pour commencer.
          </p>
          <ImportPlaylistForm />
          <section className="mt-6 w-full">
            <h2 className="mb-4 text-left text-lg font-semibold text-content">Mes playlists</h2>
            <PlaylistLibrary />
          </section>
        </div>
      ) : (
        <a
          href={googleLoginUrl}
          className="rounded-card bg-brand-purple px-6 py-3 font-semibold text-white transition hover:bg-brand-purple-dark"
        >
          Se connecter avec Google
        </a>
      )}
    </main>
  )
}
