import { Navigate, useSearchParams } from 'react-router-dom'
import { googleLoginUrl } from '@/lib/api'
import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

/**
 * Écran de connexion Youcus qui amène vers le consentement Google.
 * (L'écran « Choisir un compte » du design 61:534 est celui de Google, rendu par Google.)
 */
export function LoginPage() {
  const { data: user, isLoading } = useCurrentUser()
  const [params] = useSearchParams()

  if (isLoading) return null
  // Déjà connecté → pas d'écran de connexion, retour à l'app.
  if (user) return <Navigate to="/" replace />

  const denied = params.get('auth') === 'denied'

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="flex items-center justify-between px-6 py-4">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-card border border-line bg-canvas p-8 text-center">
          <div className="flex justify-center">
            <Logo />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-content">Se connecter à Youcus</h1>
          <p className="mt-1 text-sm text-content-muted">pour importer tes playlists et étudier sans distraction</p>

          {denied && (
            <p role="alert" className="mt-4 rounded-card bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
              La connexion a été annulée. Réessaie pour continuer.
            </p>
          )}

          <a
            href={googleLoginUrl}
            className="mt-6 flex w-full items-center justify-center rounded-lg bg-brand-purple px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-purple-dark"
          >
            Continuer avec Google
          </a>

          <p className="mt-6 text-xs leading-relaxed text-content-muted">
            Pour continuer, Google partagera votre nom, votre adresse e-mail et votre photo de profil avec Youcus.
          </p>
        </div>
      </main>
    </div>
  )
}
