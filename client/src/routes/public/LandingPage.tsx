import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const FEATURES = [
  { title: 'Playlists', desc: 'Importe tes playlists YouTube (ou celles de ton compte) en un clic.' },
  { title: 'Lecteur focus', desc: 'Regarde sans recommandations ni distractions, contrôles standards.' },
  { title: 'Notes horodatées', desc: 'Prends des notes Markdown liées à chaque vidéo.' },
  { title: 'Progression', desc: 'Suis ton avancement et reprends là où tu t’étais arrêté.' },
]

/** Page d'accueil pour les visiteurs non connectés (cf. Figma Home 34:2). */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-6 sm:px-7">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            to="/login"
            className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple-dark"
          >
            Continuer avec Google
          </Link>
        </div>
      </header>

      <section className="bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 py-16 lg:flex-row lg:gap-12 lg:py-24">
          <div className="flex-1">
            <h1 className="text-4xl font-bold leading-[1.1] text-content sm:text-5xl">
              Apprends sur YouTube,
              <br />
              sans les distractions.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-content-muted">
              Importe tes playlists, regarde en mode focus, prends des notes horodatées et suis ta
              progression — le meilleur de YouTube et d’Udemy.
            </p>
            <div className="mt-8">
              <Link
                to="/login"
                className="inline-block rounded-lg bg-brand-purple px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-purple-dark"
              >
                Continuer avec Google
              </Link>
            </div>
          </div>

          <div className="flex aspect-video w-full max-w-xl flex-1 items-center justify-center rounded-2xl border border-line bg-surface-2">
            <span className="flex size-16 items-center justify-center rounded-full bg-accent-red pl-1 text-2xl text-white">
              ▶
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-bold text-content">Tout pour étudier sereinement</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-card border border-line bg-surface p-5">
              <h3 className="font-semibold text-content">{f.title}</h3>
              <p className="mt-1 text-sm text-content-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
