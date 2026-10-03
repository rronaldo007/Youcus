import { PublicFooter } from '@/components/layout/PublicFooter'
import { PublicNav } from '@/components/layout/PublicNav'
import { buttonClass } from '@/components/ui/buttonStyles'
import portrait from '@/assets/ronaldo-portrait.webp'
import { LINKS, MILESTONES, STACK, TESTS_COUNT, TESTS_LABEL } from '@/features/landing/creator'
import { CONTACT_EMAIL } from '@/lib/contact'
import { after, revealClass, useReveal } from '@/features/landing/useReveal'
import { CountUp } from '@/features/landing/CountUp'

const external = { target: '_blank', rel: 'noopener noreferrer' } as const

const ENTER = 'motion-safe:animate-yc-enter'

/**
 * A word of the name, letter by letter, each one rising out of a clipped line (canvas of 29/09, YC-91).
 * Hidden from assistive technology: the heading says the name once, whole.
 */
function Letters({ word, from, className = '' }: { word: string; from: number; className?: string }) {
  return (
    // The padding keeps the descenders in the clip; the negative margin gives the line its height back.
    <span aria-hidden="true" className={`-mb-[0.08em] block overflow-hidden pb-[0.08em] ${className}`}>
      {[...word].map((letter, i) => (
        <span key={i} style={after(from + i * 50)} className="inline-block motion-safe:animate-yc-letter">
          {letter}
        </span>
      ))}
    </span>
  )
}

/**
 * Figma « Le créateur » 21:215, 21:328, 21:433 (YC-72). The portrait is the one of the portfolio
 * (rukundo-ronaldo.fr), already public; every fact of the page is checked in `features/landing/creator.ts`.
 */
export function CreatorPage() {
  const stack = useReveal<HTMLUListElement>()
  const journal = useReveal<HTMLDivElement>()
  const figures = useReveal<HTMLDListElement>()
  const contact = useReveal<HTMLElement>()
  return (
    <div className="min-h-screen bg-page">
      <PublicNav />
      <main>
        <section className="flex flex-col gap-8 px-4 pb-10 pt-12 md:px-8 md:py-16 xl:flex-row xl:items-center xl:gap-16 xl:px-gutter xl:py-24">
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <p style={after(100)} className={`font-mono text-mono-12 uppercase text-content-muted ${ENTER}`}>
              Le créateur · Développeur
            </p>
            <h1 className="flex flex-col font-serif text-[88px] leading-[79px] tracking-[-0.03em] text-content md:text-[140px] md:leading-[124px] xl:text-[200px] xl:leading-[176px]">
              <span className="sr-only">Ronaldo Rukundo</span>
              <Letters word="Ronaldo" from={200} />
              <Letters word="Rukundo" from={600} className="italic text-accent-text" />
            </h1>
            <p style={after(1100)} className={`font-mono text-[15px] leading-[22px] text-content md:text-lg md:leading-[30px] ${ENTER}`}>
              $ youcus --auteur
              <br />
              {'> conçu, développé et déployé seul, du cahier des charges à la '}
              {/* The caret stays with the last word, never alone on a line. */}
              <span className="whitespace-nowrap">
                production
                <span aria-hidden="true" className="ml-1.5 inline-block h-[1em] w-[0.5em] translate-y-[0.12em] bg-mark motion-safe:animate-yc-blink" />
              </span>
            </p>
          </div>
          <div style={after(600)} className={`relative size-[336px] shrink-0 self-center md:size-[420px] ${ENTER}`}>
            {/* The ring of the canvas: what one person did, turning slowly around the portrait (YC-91). */}
            <svg viewBox="0 0 420 420" aria-hidden="true" className="absolute inset-0 size-full fill-current text-content-muted motion-safe:animate-yc-orbit">
              <defs>
                <path id="creator-ring" d="M210,210 m-196,0 a196,196 0 1,1 392,0 a196,196 0 1,1 -392,0" />
              </defs>
              <text className="font-mono text-[14px] tracking-[0.2em]">
                <textPath href="#creator-ring" textLength={1225} lengthAdjust="spacing">
                  CONCEPTION · DÉVELOPPEMENT · TESTS · CI/CD · DOCKER · DÉPLOIEMENT ·
                </textPath>
              </text>
            </svg>
            <img
              src={portrait}
              alt="Ronaldo Rukundo"
              width={800}
              height={800}
              className="absolute left-8 top-8 size-[272px] rounded-full md:left-10 md:top-10 md:size-[340px]"
            />
            {/* It floats a little: an offer that is open. */}
            <p className="absolute left-[120px] top-[300px] -rotate-6 whitespace-nowrap motion-safe:animate-yc-float rounded-full bg-mark px-3 py-2 text-label-14 font-semibold text-on-mark md:left-[150px] md:top-[346px] md:px-4 md:py-2.5">
              Ouvert à un poste de développeur
            </p>
          </div>
        </section>

        <ul ref={stack.ref} aria-label="Technologies" className="flex flex-wrap gap-3 px-4 pb-16 md:px-8 xl:px-gutter xl:pb-24">
          {STACK.map((tech, i) => (
            <li
              key={tech}
              style={after(i * 40)}
              className={`rounded-full border border-line px-5 py-3 font-mono text-base leading-4 tracking-[0.04em] text-content transition-colors duration-200 ease-out hover:bg-inverse hover:text-content-inverse ${revealClass(stack.shown)}`}
            >
              {tech}
            </li>
          ))}
        </ul>

        <section aria-labelledby="journal-titre" className="flex flex-col gap-8 px-4 pb-16 md:px-8 xl:flex-row xl:gap-24 xl:px-gutter xl:pb-24">
          <div className="flex flex-col gap-5 xl:w-[420px] xl:shrink-0">
            <h2 id="journal-titre" className="font-serif text-title-34 text-content xl:text-title-56">
              Journal de bord.
            </h2>
            <p className="text-body-16 text-content-muted">
              Youcus est mon projet de fin d’études, mené seul pour couvrir tout le cycle d’une application : la concevoir, la
              construire, la tester, la mettre en production.
            </p>
          </div>
          {/* The spine of the journal draws itself down, the milestones come in along it. */}
          <div ref={journal.ref} className="relative min-w-0 flex-1 pl-8">
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 w-0.5 origin-top bg-line ${journal.shown ? 'motion-safe:animate-yc-draw-y' : 'motion-safe:scale-y-0'}`}
            />
            <ol className="flex flex-col">
              {MILESTONES.map((m, i) => (
                <li key={m.title} style={after(300 + i * 400)} className={`relative flex flex-col gap-1.5 pb-8 ${revealClass(journal.shown)}`}>
                {/* A point on the spine for each milestone, the last one in the mark: where it stands today. */}
                <span
                  aria-hidden="true"
                  style={after(200 + i * 400)}
                  className={`absolute -left-[39px] top-0.5 size-4 rounded-full ${i === MILESTONES.length - 1 ? 'bg-mark' : 'bg-accent'} ${
                    journal.shown ? 'motion-safe:animate-yc-bounce-in' : 'motion-safe:opacity-0'
                  }`}
                />
                  <p className={`font-mono text-mono-12 uppercase ${i === MILESTONES.length - 1 ? 'text-accent-text' : 'text-content-muted'}`}>{m.date}</p>
                  <h3 className="font-serif text-title-34 text-content">{m.title}</h3>
                  <p className="text-body-16 text-content-muted">{m.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="px-4 pb-16 md:px-8 xl:px-gutter xl:pb-24">
          <dl ref={figures.ref} className="flex flex-col gap-6 rounded-[28px] bg-surface p-7 md:flex-row md:p-14">
            {[
              { value: TESTS_LABEL, label: 'tests automatisés, serveur et client', count: TESTS_COUNT },
              { value: '1', label: 'personne, de la conception au déploiement' },
              { value: 'CI/CD', label: 'tests à chaque pull request, mise en ligne à chaque fusion', accent: true },
            ].map((n, i) => (
              <div key={n.label} style={after(i * 120)} className={`flex min-w-0 flex-1 flex-col gap-2 ${revealClass(figures.shown)}`}>
                <dt className="text-body-16 text-content-muted">{n.label}</dt>
                <dd className={`order-first font-serif text-[56px] leading-[56px] tracking-[-0.03em] xl:text-display ${n.accent ? 'text-accent-text' : 'text-content'}`}>
                  {n.count ? <CountUp to={n.count} suffix="+" run={figures.shown} /> : n.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <section
          ref={contact.ref}
          aria-labelledby="contact-titre"
          className="flex flex-col gap-6 px-4 pb-16 md:px-8 xl:flex-row xl:items-end xl:justify-between xl:px-gutter xl:pb-24"
        >
          <h2 id="contact-titre" className="flex flex-col font-serif text-[56px] leading-[56px] tracking-[-0.03em] md:text-display">
            <span className={`text-content ${revealClass(contact.shown)}`}>On en parle ?</span>
            <span style={after(200)} className={`italic text-accent-text ${revealClass(contact.shown)}`}>
              Je suis disponible.
            </span>
          </h2>
          <div style={after(400)} className={`flex flex-col items-start gap-3 xl:items-end ${revealClass(contact.shown)}`}>
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
