import { PublicFooter } from '@/components/layout/PublicFooter'
import { PublicNav } from '@/components/layout/PublicNav'
import { buttonClass } from '@/components/ui/buttonStyles'
import portrait from '@/assets/ronaldo-portrait.webp'
import { LINKS, MILESTONES, STACK, TESTS_LABEL } from '@/features/landing/creator'
import { CONTACT_EMAIL } from '@/lib/contact'

const external = { target: '_blank', rel: 'noopener noreferrer' } as const

/**
 * Figma « Le créateur » 21:215, 21:328, 21:433 (YC-72). The portrait is the one of the portfolio
 * (rukundo-ronaldo.fr), already public; every fact of the page is checked in `features/landing/creator.ts`.
 */
export function CreatorPage() {
  return (
    <div className="min-h-screen bg-page">
      <PublicNav />
      {/* As wide as the app at most (YC-90: the public pages stretched on a wide screen). */}
      <main className="mx-auto w-full max-w-[1440px]">
        <section className="flex flex-col gap-8 px-4 pb-10 pt-12 md:px-8 md:py-16 xl:flex-row xl:items-center xl:gap-16 xl:px-20 xl:py-24">
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <p className="font-mono text-mono-12 uppercase text-content-muted">Le créateur · Développeur</p>
            <h1 className="flex flex-col font-serif text-[88px] leading-[79px] tracking-[-0.03em] text-content md:text-[140px] md:leading-[124px] xl:text-[200px] xl:leading-[176px]">
              <span>Ronaldo</span>
              <span className="italic text-accent-text">Rukundo</span>
            </h1>
            <p className="font-mono text-[15px] leading-[22px] text-content md:text-lg md:leading-[30px]">
              $ youcus --auteur
              <br />
              {'> conçu, développé et déployé seul, du cahier des charges à la production'}
            </p>
          </div>
          <div className="relative size-[336px] shrink-0 self-center md:size-[420px]">
            <img
              src={portrait}
              alt="Ronaldo Rukundo"
              width={800}
              height={800}
              className="absolute left-8 top-8 size-[272px] rounded-full md:left-10 md:top-10 md:size-[340px]"
            />
            <p className="absolute left-[120px] top-[300px] -rotate-6 whitespace-nowrap rounded-full bg-mark px-3 py-2 text-label-14 font-semibold text-on-mark md:left-[150px] md:top-[346px] md:px-4 md:py-2.5">
              Ouvert à un poste de développeur
            </p>
          </div>
        </section>

        <ul aria-label="Technologies" className="flex flex-wrap gap-3 px-4 pb-16 md:px-8 xl:px-20 xl:pb-24">
          {STACK.map((tech) => (
            <li key={tech} className="rounded-full border border-line px-5 py-3 font-mono text-base leading-4 tracking-[0.04em] text-content">
              {tech}
            </li>
          ))}
        </ul>

        <section aria-labelledby="journal-titre" className="flex flex-col gap-8 px-4 pb-16 md:px-8 xl:flex-row xl:gap-24 xl:px-20 xl:pb-24">
          <div className="flex flex-col gap-5 xl:w-[420px] xl:shrink-0">
            <h2 id="journal-titre" className="font-serif text-title-34 text-content xl:text-title-56">
              Journal de bord.
            </h2>
            <p className="text-body-16 text-content-muted">
              Youcus est mon projet de fin d’études, mené seul pour couvrir tout le cycle d’une application : la concevoir, la
              construire, la tester, la mettre en production.
            </p>
          </div>
          <ol className="flex min-w-0 flex-1 flex-col border-l-2 border-line pl-8">
            {MILESTONES.map((m, i) => (
              <li key={m.title} className="flex flex-col gap-1.5 pb-8">
                <p className={`font-mono text-mono-12 uppercase ${i === MILESTONES.length - 1 ? 'text-accent-text' : 'text-content-muted'}`}>{m.date}</p>
                <h3 className="font-serif text-title-34 text-content">{m.title}</h3>
                <p className="text-body-16 text-content-muted">{m.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="px-4 pb-16 md:px-8 xl:px-20 xl:pb-24">
          <dl className="flex flex-col gap-6 rounded-[28px] bg-surface p-7 md:flex-row md:p-14">
            {[
              { value: TESTS_LABEL, label: 'tests automatisés, serveur et client' },
              { value: '1', label: 'personne, de la conception au déploiement' },
              { value: 'CI/CD', label: 'tests à chaque pull request, mise en ligne à chaque fusion', accent: true },
            ].map((n) => (
              <div key={n.label} className="flex min-w-0 flex-1 flex-col gap-2">
                <dt className="text-body-16 text-content-muted">{n.label}</dt>
                <dd className={`order-first font-serif text-[56px] leading-[56px] tracking-[-0.03em] xl:text-display ${n.accent ? 'text-accent-text' : 'text-content'}`}>{n.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <section aria-labelledby="contact-titre" className="flex flex-col gap-6 px-4 pb-16 md:px-8 xl:flex-row xl:items-end xl:justify-between xl:px-20 xl:pb-24">
          <h2 id="contact-titre" className="flex flex-col font-serif text-[56px] leading-[56px] tracking-[-0.03em] md:text-display">
            <span className="text-content">On en parle ?</span>
            <span className="italic text-accent-text">Je suis disponible.</span>
          </h2>
          <div className="flex flex-col items-start gap-3 xl:items-end">
            <a href={LINKS.github.href} {...external} className={buttonClass('primary')}>
              {LINKS.github.label}
            </a>
            <a href={LINKS.linkedin.href} {...external} className={buttonClass('secondary')}>
              {LINKS.linkedin.label}
            </a>
            <a href={LINKS.portfolio.href} {...external} className={buttonClass('ghost')}>
              Portfolio · {LINKS.portfolio.label}
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-mono text-mono-12 text-content-muted underline-offset-2 hover:text-content hover:underline">
              {CONTACT_EMAIL}
            </a>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
