import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { Dashboard } from '@/features/dashboard/Dashboard'
import { LandingPage } from '@/routes/public/LandingPage'

export function HomePage() {
  const { data: user, isLoading } = useCurrentUser()

  if (isLoading) return null
  // Visiteur non connecté → page d'accueil (landing).
  if (!user) return <LandingPage />

  // Utilisateur connecté → tableau de bord (Figma « Tableau de bord » 11:5), on the app's background.
  return (
    <div className="min-h-[calc(100vh-64px)] bg-app">
      <Dashboard user={user} />
    </div>
  )
}
