import { Link } from 'react-router-dom'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { PublicNav } from '@/components/layout/PublicNav'
import { buttonClass } from '@/components/ui/buttonStyles'
import { after, revealClass, useReveal } from '@/features/landing/useReveal'
import { CountUp } from '@/features/landing/CountUp'

/** Each one checked against the code on 02/10 (YC-70): the sign-in scopes, the import, the export. */
const PRINCIPLES = [
  {
    title: 'Rien n’est téléchargé',
    text: 'Les vidéos passent par le lecteur officiel, les playlists par les APIs officielles de YouTube.',
  },
  {
    title: 'Les publicités restent',
    text: 'Les règles de YouTube l’interdisent, et les créateurs en vivent. On supprime la dérive, pas leur revenu.',
  },
  {
    title: 'Lecture seule',
    text: 'La connexion ne demande que ton identité. L’accès aux playlists se demande au premier import.',
  },
  {
    title: 'Tes notes t’appartiennent',
    text: 'Export complet depuis les réglages. Suppression du compte en un geste.',
  },
]

/**
 * The mock-up said « 0 Short, jamais »: Youcus does not filter Shorts (a playlist that holds one imports
 * it), so Ronaldo chose a figure the code keeps, « 0 lecture automatique » (decision of 02/10).
 */
const FIGURES = [
  { value: '0', label: 'recommandation à côté de ta vidéo' },
  { value: '0', label: 'lecture automatique' },
  { value: '1', label: 'lecteur, pour ta playlist seulement' },
  { value: '100 %', label: 'de tes notes exportables', accent: true, count: 100 },
]

const ENTER = 'motion-safe:animate-yc-enter'

/** Page publique « À propos » (Figma 19:179, 19:1662, 19:1723 ; sombre 47:8492). Mouvement : canevas du 29/09 (YC-91). */
export function AboutPage() {
  const intro = useReveal<HTMLElement>()
  const principles = useReveal<HTMLOListElement>()
  const figures = useReveal<HTMLDListElement>()
  const closing = useReveal<HTMLElement>()
  return (
    <div className="min-h-screen bg-page">
      <PublicNav />
      <main>
        <section className="flex flex-col gap-6 px-4 py-14 md:px-8 md:pb-16 md:pt-20 xl:px-gutter xl:pb-24 xl:pt-[120px]">
          <p className={`font-mono text-mono-12 uppercase text-content-muted ${ENTER}`}>À propos</p>
          <h1 className="font-serif text-[52px] leading-[55px] tracking-[-0.03em] md:text-[72px] md:leading-[72px] xl:text-display">
            <span style={after(150)} className={`block text-content ${ENTER}`}>
              YouTube est la plus grande{' '}
              <span className="relative whitespace-nowrap">
                école
                {/* The word that matters, underlined in the signal once the line is in. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-[0.08em] h-[0.06em] origin-left bg-accent motion-safe:animate-yc-draw-x"
                  style={after(1100)}
                />
              </span>{' '}
              du monde.
            </span>
            <em style={after(300)} className={`block text-content-muted ${ENTER}`}>
              Elle n’a pas été construite pour apprendre.
            </em>
          </h1>
        </section>

        <section
          ref={intro.ref}
          className={`flex flex-col gap-6 px-4 pb-14 md:flex-row md:gap-12 md:px-8 md:pb-16 xl:gap-24 xl:px-gutter xl:pb-[120px] ${revealClass(intro.shown)}`}
        >
          <p className="font-serif text-[26px] leading-[27px] text-content md:flex-1 xl:text-title-34">
            Les meilleurs cours du monde sont gratuits, et ils sont sur YouTube. Mais la page qui les entoure est faite pour que
            tu restes, pas pour que tu retiennes.
          </p>
          <p className="text-lead text-content-muted md:flex-1">
            Youcus garde les vidéos et retire ce qui te fait dériver : colonne de suggestions, lecture automatique, Shorts. À la
            place, il pose ce qu’une école a toujours eu : un endroit pour regarder, un cahier pour écrire, une trace de ce que tu
            as déjà fait.
          </p>
        </section>

        <section aria-labelledby="principes" className="flex flex-col gap-10 px-4 pb-14 md:px-8 md:pb-16 xl:px-gutter xl:pb-[120px]">
          <h2 id="principes" className="font-serif text-title-34 tracking-[-0.01em] text-content xl:text-title-56">
            Quatre principes, tenus dans le code.
          </h2>
          <ol ref={principles.ref} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-5">
            {PRINCIPLES.map((p, i) => (
              <li
                key={p.title}
                style={after(i * 100)}
                className={`flex flex-col gap-4 rounded-yc-xl border border-line bg-surface px-7 py-8 transition-[transform,border-color] duration-200 ease-out hover:border-line-strong motion-safe:hover:-translate-y-1.5 ${revealClass(principles.shown)}`}
              >
                <p aria-hidden="true" className="font-mono text-[12px] font-bold leading-4 text-accent-text">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="font-serif text-title-24 text-content">{p.title}</h3>
                <p className="text-body-15 text-content-muted">{p.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="En chiffres" className="bg-inverse px-4 py-14 md:px-8 md:py-16 xl:px-gutter xl:py-[72px]">
          <dl ref={figures.ref} className="grid gap-6 md:grid-cols-2 md:gap-y-12 xl:grid-cols-4">
            {FIGURES.map((f, i) => (
              <div key={f.label} style={after(i * 120)} className={`flex flex-col-reverse gap-2 ${revealClass(figures.shown)}`}>
                <dt className="text-body-16 text-content-inverse">{f.label}</dt>
                <dd
                  className={`font-serif text-[52px] leading-[55px] tracking-[-0.03em] md:text-[80px] md:leading-[76px] xl:text-display ${
                    f.accent ? 'text-[color:var(--yc-text-accent-on-inverse)]' : 'text-content-inverse'
                  }`}
                >
                  {/* The share of notes fills up to 100 when the band comes in (YC-91). */}
                  {f.count ? <CountUp to={f.count} suffix=" %" run={figures.shown} /> : f.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          ref={closing.ref}
          className={`flex flex-col gap-6 px-4 py-14 md:px-8 md:py-16 xl:flex-row xl:items-center xl:justify-between xl:px-gutter xl:py-[120px] ${revealClass(closing.shown)}`}
        >
          <h2 className="font-serif text-title-34 tracking-[-0.01em] text-content md:text-[40px] md:leading-[44px] xl:w-[760px] xl:text-title-56">
            Un projet mené seul, du cahier des charges à la production.
          </h2>
          {/* The page of the maker, since YC-72. */}
          <Link to="/le-createur" className={buttonClass('primary', 'group w-full xl:w-auto')}>
            Rencontrer le créateur <span aria-hidden="true" className="inline-block transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-1">→</span>
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
