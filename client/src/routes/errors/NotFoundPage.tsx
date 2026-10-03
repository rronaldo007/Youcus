import { PublicFooter } from '@/components/layout/PublicFooter'
import { PublicNav } from '@/components/layout/PublicNav'
import { PageState } from '@/components/ui/PageState'
import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { SEARCH_PAGE } from '@/features/search/useSearchField'

/**
 * Figma « Page introuvable » 98:30548: any address the app does not know (YC-83). Signed in, under
 * the bar of the app, back to the dashboard or to the search; signed out, the public navigation and
 * back to the home page only: the search needs an account, and a visitor has no playlists.
 * « Voir le catalogue » of the frame waits for the catalogue (YC-65): « Rechercher » instead
 * (decision of Ronaldo, 03/10).
 */
export function NotFoundPage() {
  const { data: user, isLoading } = useCurrentUser()
  if (isLoading) return null

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-page">
        <PublicNav />
        <main className="flex-1 px-4 py-16 md:px-8 xl:px-16 xl:py-[120px]">
          <PageState
            kind="no-results"
            title="Cette page n’existe pas"
            text="Le lien est peut-être ancien. Rien d’autre n’a bougé."
            action={{ label: 'Retour à l’accueil', to: '/' }}
          />
        </main>
        <PublicFooter />
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-16 md:px-8 xl:px-16 xl:py-[120px]">
      <PageState
        kind="no-results"
        title="Cette page n’existe pas"
        text="Le lien est peut-être ancien, ou la playlist a été retirée de tes playlists. Rien d’autre n’a bougé."
        action={{ label: 'Retour au tableau de bord', to: '/' }}
        secondaryAction={{ label: 'Rechercher', to: SEARCH_PAGE }}
      />
    </main>
  )
}
