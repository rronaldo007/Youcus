import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { googleLoginUrl } from '@/lib/api'
import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { buttonClass } from '@/components/ui/buttonStyles'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

/**
 * The brand half (Figma « Marque »): always dark, whatever the theme, so it carries the `dark` class
 * and the tokens resolve to their dark values inside it.
 * On a wide screen its text starts where the other public pages start (YC-90), the dark half still
 * reaching the edge.
 */
function BrandPanel() {
  return (
    <div className="dark flex flex-col bg-page px-5 py-8 sm:p-16 xl:min-h-screen xl:flex-1 xl:justify-between xl:pl-[max(4rem,calc((100vw_-_80rem)/2))]">
      <div className="flex items-center justify-between gap-4">
        <Link to="/" aria-label="Youcus, accueil" className="flex shrink-0 items-center rounded-yc-sm">
          <Logo size="public" />
        </Link>
        <ThemeToggle />
      </div>
      <p className="font-serif text-[44px] leading-[42px] tracking-[-0.03em] sm:text-[72px] sm:leading-[68px] xl:text-[96px] xl:leading-[91px]">
        <span className="block text-content">Regarde moins.</span>
        <em className="block text-accent-text">Retiens plus.</em>
      </p>
      <p className="hidden font-mono text-mono-12 uppercase text-content-muted sm:block">
        APIs officielles YouTube · Rien n’est téléchargé
      </p>
    </div>
  )
}

/**
 * Écran de connexion (Figma « Connexion » 21:538, 21:565, 21:590 ; sombre 47:8950), qui amène vers le
 * consentement Google. La connexion ne demande que l'identité : YouTube se connecte plus tard, à part.
 */
export function LoginPage() {
  const { data: user, isLoading } = useCurrentUser()
  const [params] = useSearchParams()

  if (isLoading) return null
  // Déjà connecté → pas d'écran de connexion, retour à l'app.
  if (user) return <Navigate to="/" replace />

  const denied = params.get('auth') === 'denied'

  return (
    <div className="flex min-h-screen flex-col bg-page xl:flex-row">
      <BrandPanel />
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-12 xl:pr-[max(3rem,calc((100vw_-_80rem)/2))]">
        <div className="flex w-full max-w-[460px] flex-col gap-5 rounded-[24px] border border-line bg-surface px-6 py-8 sm:px-9 sm:py-10">
          <h1 className="font-serif text-title-34 text-content sm:text-title-56">Ton cahier t’attend.</h1>
          <p className="text-body-16 text-content-muted">
            Une seule connexion, avec ton compte Google. Tes playlists, tes notes et ta progression te suivent partout.
          </p>
          <a href={googleLoginUrl} className={buttonClass('primary', 'w-full')}>
            Continuer avec Google
          </a>
          {denied && (
            <div role="alert">
              <InlineMessage tone="error">La connexion a été annulée. Réessaie pour continuer.</InlineMessage>
            </div>
          )}
          <InlineMessage tone="info">On ne demande que ton identité. YouTube, en lecture seule, plus tard.</InlineMessage>
          <hr className="border-line" />
          {/* The design also names terms of use: Youcus has none, so the sentence only names what exists. */}
          <p className="text-small-13 font-medium text-content-muted">
            En continuant, tu acceptes la{' '}
            <Link to="/confidentialite" className="underline underline-offset-2 hover:text-content">
              politique de confidentialité
            </Link>
            . Tes données s’exportent depuis les réglages.
          </p>
        </div>
      </main>
    </div>
  )
}
