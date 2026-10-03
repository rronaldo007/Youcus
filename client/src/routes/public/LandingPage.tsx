import { Link } from 'react-router-dom'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { PublicNav } from '@/components/layout/PublicNav'
import { buttonClass } from '@/components/ui/buttonStyles'
import { CatalogCard } from '@/components/ui/CatalogCard'
import { SOON } from '@/components/layout/navItems'
import { HeroScene } from '@/features/landing/HeroScene'
import { CATALOG_SAMPLES } from '@/features/landing/catalogSamples'

/** What Youcus takes away from YouTube, said in the band under the hero. */
const PROMISES = ['Aucune recommandation', 'Aucun Short', 'Aucune lecture automatique', 'Des notes horodatées']

const STEPS = [
  {
    time: '00:01',
    title: 'Importe',
    text: 'Tes playlists YouTube, publiques ou privées. Un accès en lecture seule, demandé au premier import.',
  },
  { time: '00:02', title: 'Regarde', text: 'Le lecteur focus n’affiche que ta playlist. « Suivant » reste dans ton cours.' },
  { time: '00:03', title: 'Retiens', text: 'Chaque repère garde l’heure de la vidéo. Un clic, et tu es au passage exact.' },
]

/** The entrances of the hero, one after the other (Figma « Mouvement »: 300 ms, ease-out, one axis). */
const RISE = 'motion-safe:animate-yc-rise'
const after = (ms: number) => ({ animationDelay: `${ms}ms` })

function Hero() {
  return (
    <section className="flex flex-col items-start gap-10 px-4 pb-14 pt-10 md:gap-12 md:px-8 md:pb-24 md:pt-14 xl:flex-row xl:gap-16 xl:px-gutter xl:pb-24 xl:pt-[88px]">
      <div className="flex w-full min-w-0 flex-col items-start gap-7 xl:flex-1">
        <p style={after(0)} className={`font-mono text-mono-12 uppercase text-content-muted ${RISE}`}>
          <span aria-hidden="true">● </span>REC 00:00:00 · Mode étude
        </p>
        <h1 className="flex flex-col gap-7 font-serif text-[56px] leading-[54px] tracking-[-0.03em] text-content md:text-[80px] md:leading-[76px] xl:text-[clamp(80px,7.2vw,104px)] xl:leading-[0.92]">
          <span style={after(60)} className={`whitespace-nowrap ${RISE}`}>
            Regarde moins.
          </span>
          <em style={after(120)} className={`whitespace-nowrap text-accent-text ${RISE}`}>
            Retiens plus.
          </em>
        </h1>
        <p style={after(180)} className={`max-w-[640px] text-lead text-content-muted ${RISE}`}>
          Youcus transforme tes playlists YouTube en vrai cours : un lecteur sans détour, des notes qui gardent l’heure exacte, et ta
          progression, vidéo après vidéo.
        </p>
        <div style={after(240)} className={`flex w-full flex-col gap-4 md:w-auto md:flex-row ${RISE}`}>
          <Link to="/login" className={buttonClass('primary', 'w-full md:w-auto')}>
            Continuer avec Google →
          </Link>
          <Link to="/ce-qu-on-corrige" className={buttonClass('ghost', 'w-full md:w-auto')}>
            Voir ce qu’on corrige
          </Link>
        </div>
      </div>
      <div className="w-full max-w-[600px] xl:w-[45%] xl:shrink-0">
        <HeroScene />
      </div>
    </section>
  )
}

/**
 * The band (Figma 13:573). It fits on a computer; narrower, it scrolls slowly, and under
 * prefers-reduced-motion it wraps instead.
 */
function Band() {
  // The line, its dots in the red signal on the ink; `copy` keeps the keys apart when it is drawn twice.
  const line = (copy: string) =>
    PROMISES.flatMap((p, i) => [
      ...(i > 0 ? [<span key={`${copy}-dot-${p}`} className="not-italic text-[color:var(--yc-text-accent-on-inverse)]">●</span>] : []),
      <span key={`${copy}-${p}`}>{p}</span>,
    ])
  return (
    <section aria-label="Ce que Youcus retire" className="overflow-hidden bg-inverse py-[22px]">
      <ul className="sr-only">
        {PROMISES.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <div aria-hidden="true" className="font-serif text-[34px] italic leading-10 tracking-[-0.03em] text-content-inverse">
        {/* Computer: one line, as drawn. */}
        <div className="hidden gap-10 whitespace-nowrap px-20 xl:flex">{line('wide')}</div>
        {/* Narrower: twice the line, sliding by half, so it never ends. */}
        <div className="flex w-max gap-10 whitespace-nowrap pl-4 motion-safe:animate-yc-marquee motion-reduce:hidden xl:hidden">
          {line('a')}
          <span className="not-italic text-[color:var(--yc-text-accent-on-inverse)]">●</span>
          {line('b')}
          <span className="not-italic text-[color:var(--yc-text-accent-on-inverse)]">●</span>
        </div>
        <div className="hidden flex-wrap gap-x-10 px-4 motion-reduce:flex xl:motion-reduce:hidden">{line('still')}</div>
      </div>
    </section>
  )
}

/**
 * Figma « À étudier ce soir » 13:581: real public courses (read from YouTube, see catalogSamples).
 * A visitor adds one by signing in; the full catalogue is not built yet (YC-65).
 */
function ToStudyTonight() {
  return (
    <section aria-labelledby="a-etudier-titre" className="flex flex-col gap-10 px-4 pb-10 pt-14 md:px-8 md:pt-20 xl:px-gutter xl:pt-[120px]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-mono-12 uppercase text-content-muted">À étudier ce soir</p>
          <h2 id="a-etudier-titre" className="font-serif text-title-34 text-content md:text-title-56 md:tracking-[-0.01em]">
            Des cours entiers, gratuits.
          </h2>
        </div>
        <p className="max-w-[380px] text-body-16 text-content-muted">
          Publiés par leurs auteurs sur YouTube. Choisis-en un, Youcus en fait un cours.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-8">
        {CATALOG_SAMPLES.map((item, i) => (
          <li key={item.title} className={i === CATALOG_SAMPLES.length - 1 ? 'md:col-span-2 xl:col-span-1' : undefined}>
            {/* The full-width card of a tablet keeps the 202 px of the frame instead of a 433 px thumbnail. */}
            <CatalogCard
              item={item}
              addTo="/login"
              thumbClassName={i === CATALOG_SAMPLES.length - 1 ? 'aspect-video md:max-xl:aspect-auto md:max-xl:h-[202px]' : undefined}
            />
          </li>
        ))}
      </ul>
      <p aria-disabled="true" title={SOON} className="cursor-not-allowed text-body-16 font-semibold text-content-muted opacity-60">
        Voir tout le catalogue →<span className="sr-only"> ({SOON})</span>
      </p>
    </section>
  )
}

function ThreeSteps() {
  return (
    <section
      id="trois-gestes"
      aria-labelledby="trois-gestes-titre"
      className="flex scroll-mt-4 flex-col gap-10 px-4 py-14 md:px-8 md:py-20 xl:px-gutter xl:py-[120px]"
    >
      <h2 id="trois-gestes-titre" className="font-serif text-title-34 text-content md:text-title-56 md:tracking-[-0.01em]">
        Trois gestes. Pas un de plus.
      </h2>
      <ol className="flex flex-col gap-6 xl:flex-row">
        {STEPS.map((s) => (
          <li key={s.time} className="flex min-w-0 flex-1 flex-col gap-4 rounded-yc-xl border border-line bg-surface p-8">
            <p className="font-mono text-[40px] font-bold leading-[44px] text-accent-text">{s.time}</p>
            <h3 className="font-serif text-title-34 text-content">{s.title}</h3>
            <p className="text-body-16 text-content-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Page d'accueil des visiteurs (Figma « Accueil » 13:2, 13:661, 13:790; sombre 76:20996).
 */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-page">
      <PublicNav />
      <main>
        <Hero />
        <Band />
        <ToStudyTonight />
        <ThreeSteps />
      </main>
      <PublicFooter />
    </div>
  )
}
