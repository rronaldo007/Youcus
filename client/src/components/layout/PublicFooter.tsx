import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'

/** Figma « Pied de page public » 87:60, plus the privacy page, which the site already linked. */
export function PublicFooter() {
  return (
    <footer className="flex flex-col items-start justify-between gap-1 border-t border-line px-4 py-10 sm:px-8 xl:flex-row xl:items-center xl:px-gutter">
      {/* The recording dot closes the page as it opened it (YC-91). */}
      <Logo size="drawer" pulse />
      <p className="text-small-13 font-medium text-content-muted">Conçu, développé et déployé par Ronaldo Rukundo</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <p className="font-mono text-mono-12 uppercase text-content-muted">APIs officielles YouTube · Données exportables</p>
        <Link to="/confidentialite" className="text-small-13 font-medium text-content-muted underline underline-offset-2 hover:text-content">
          Confidentialité
        </Link>
      </div>
    </footer>
  )
}
