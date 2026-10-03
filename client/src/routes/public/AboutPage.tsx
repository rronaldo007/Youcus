import { Link } from 'react-router-dom'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { PublicNav } from '@/components/layout/PublicNav'
import { buttonClass } from '@/components/ui/buttonStyles'

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
  { value: '100 %', label: 'de tes notes exportables', accent: true },
]

/** Page publique « À propos » (Figma 19:179, 19:1662, 19:1723 ; sombre 47:8492). */
export function AboutPage() {
  return (
    <div className="min-h-screen bg-page">
      <PublicNav />
      <main>
        <section className="flex flex-col gap-6 px-4 py-14 md:px-8 md:pb-16 md:pt-20 xl:px-20 xl:pb-24 xl:pt-[120px]">
          <p className="font-mono text-mono-12 uppercase text-content-muted">À propos</p>
          <h1 className="font-serif text-[52px] leading-[55px] tracking-[-0.03em] md:text-[72px] md:leading-[72px] xl:text-display">
            <span className="block text-content">YouTube est la plus grande école du monde.</span>
            <em className="block text-content-muted">Elle n’a pas été construite pour apprendre.</em>
          </h1>
        </section>

        <section className="flex flex-col gap-6 px-4 pb-14 md:flex-row md:gap-12 md:px-8 md:pb-16 xl:gap-24 xl:px-20 xl:pb-[120px]">
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

        <section aria-labelledby="principes" className="flex flex-col gap-10 px-4 pb-14 md:px-8 md:pb-16 xl:px-20 xl:pb-[120px]">
          <h2 id="principes" className="font-serif text-title-34 tracking-[-0.01em] text-content xl:text-title-56">
            Quatre principes, tenus dans le code.
          </h2>
          <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-5">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title} className="flex flex-col gap-4 rounded-yc-xl border border-line bg-surface px-7 py-8">
                <p aria-hidden="true" className="font-mono text-[12px] font-bold leading-4 text-accent-text">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="font-serif text-title-24 text-content">{p.title}</h3>
                <p className="text-body-15 text-content-muted">{p.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="En chiffres" className="bg-inverse px-4 py-14 md:px-8 md:py-16 xl:px-20 xl:py-[72px]">
          <dl className="grid gap-6 md:grid-cols-2 md:gap-y-12 xl:grid-cols-4">
            {FIGURES.map((f) => (
              <div key={f.label} className="flex flex-col-reverse gap-2">
                <dt className="text-body-16 text-content-inverse">{f.label}</dt>
                <dd
                  className={`font-serif text-[52px] leading-[55px] tracking-[-0.03em] md:text-[80px] md:leading-[76px] xl:text-display ${
                    f.accent ? 'text-[color:var(--yc-text-accent-on-inverse)]' : 'text-content-inverse'
                  }`}
                >
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="flex flex-col gap-6 px-4 py-14 md:px-8 md:py-16 xl:flex-row xl:items-center xl:justify-between xl:px-20 xl:py-[120px]">
          <h2 className="font-serif text-title-34 tracking-[-0.01em] text-content md:text-[40px] md:leading-[44px] xl:w-[760px] xl:text-title-56">
            Un projet mené seul, du cahier des charges à la production.
          </h2>
          {/* The page of the maker, since YC-72. */}
          <Link to="/le-createur" className={buttonClass('primary', 'w-full xl:w-auto')}>
            Rencontrer le créateur
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
