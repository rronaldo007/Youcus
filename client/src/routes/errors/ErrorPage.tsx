import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router-dom'
import { PublicNav } from '@/components/layout/PublicNav'
import { Logo } from '@/components/ui/Logo'
import { PageState } from '@/components/ui/PageState'
import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { useTheme } from '@/features/theme/useTheme'
import { CONTACT_EMAIL } from '@/lib/contact'

/**
 * Figma « Erreur serveur » 98:30438: a screen of the app broke (YC-83). It shows when a page throws
 * while it is drawn, not only when the server is down, so it says nothing the app cannot know: the
 * frame's « tes notes sont enregistrées » is not always true (a save can fail, YC-62) and the address
 * is not in the settings. Text checked with Ronaldo, 03/10.
 *
 * Two places. Inside the layout, under the bar of the app, as in the frame. At the root, when the
 * layout itself broke: nothing of the app is drawn there, only the logo, or this page could break too.
 */
export function ErrorPage({ standalone = false }: { standalone?: boolean }) {
  const error = useRouteError()
  useEffect(() => {
    console.error(error)
  }, [error])

  return standalone ? <StandaloneError /> : <LayoutError />
}

function LayoutError() {
  const { data: user, isLoading } = useCurrentUser()
  // Not the public bar nor « l'accueil » to an account whose session is still being read.
  if (isLoading) return null
  return (
    <>
      {/* The layout draws the bar of the app for an account; a visitor gets the public one. */}
      {!user && <PublicNav />}
      <BrokenState signedIn={!!user} />
    </>
  )
}

function StandaloneError() {
  // The layout applies the theme on every page; here there is no layout.
  useTheme()
  const { data: user, isLoading } = useCurrentUser()
  return (
    <div className="min-h-screen bg-page">
      <header className="flex h-16 items-center border-b border-line px-4 md:px-8 xl:px-16">
        <Link to="/" aria-label="Youcus, accueil" className="flex h-11 items-center rounded-yc-sm">
          <Logo />
        </Link>
      </header>
      {!isLoading && <BrokenState signedIn={!!user} />}
    </div>
  )
}

function BrokenState({ signedIn }: { signedIn: boolean }) {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-16 md:px-8 xl:px-16 xl:py-[120px]">
      <PageState
        kind="error"
        title="Quelque chose a cassé de notre côté"
        text={
          <>
            Ce qui était déjà enregistré l’est toujours. Si ça continue, écris-moi :{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-content underline underline-offset-2 hover:text-accent-text">
              {CONTACT_EMAIL}
            </a>
            .
          </>
        }
        action={{ label: 'Réessayer', onClick: () => window.location.reload() }}
        secondaryAction={{ label: signedIn ? 'Retour au tableau de bord' : 'Retour à l’accueil', to: '/' }}
      />
    </main>
  )
}
