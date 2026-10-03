import { PublicFooter } from '@/components/layout/PublicFooter'
import { PublicNav } from '@/components/layout/PublicNav'
import { StatusPill } from '@/components/ui/StatusPill'
import { FRICTIONS, SHIPPED_LABEL, SOON_LABEL, type Friction } from '@/features/landing/frictions'
import { after, revealClass, useReveal } from '@/features/landing/useReveal'

const ENTER = 'motion-safe:animate-yc-enter'

/** « Pastille d'état » 56:14: Neutre for what is in the app, Contour (to do) for what is not yet. */
function State({ shipped }: { shipped: boolean }) {
  return shipped ? (
    <StatusPill dot={false}>{SHIPPED_LABEL}</StatusPill>
  ) : (
    <StatusPill tone="outline" dot={false}>
      {SOON_LABEL}
    </StatusPill>
  )
}

/**
 * A row enters when it scrolls into view: the friction first, then, a beat later, its correction
 * (the before and after of the canvas, told once instead of in a loop: YC-91, decision of Ronaldo).
 */
function FrictionRow({ f, n }: { f: Friction; n: string }) {
  const { ref, shown } = useReveal<HTMLLIElement>()
  const enter = revealClass(shown)
  return (
    <li ref={ref} className="flex flex-col gap-3 border-b border-line py-6 xl:flex-row xl:items-start xl:gap-10 xl:py-8">
      <div className="flex items-center justify-between xl:contents">
        <p aria-hidden="true" className={`${enter} font-serif text-[34px] leading-9 tracking-[-0.01em] text-accent-text xl:w-16 xl:shrink-0 xl:text-title-56`}>
          {n}
        </p>
        {/* The state arrives last, with a bounce: the verdict of the row. */}
        <div
          style={after(550)}
          className={`xl:order-last xl:w-[140px] xl:shrink-0 ${shown ? 'motion-safe:animate-yc-bounce-in' : 'motion-safe:opacity-0'}`}
        >
          <State shipped={f.shipped} />
        </div>
      </div>
      <div style={after(80)} className={`flex min-w-0 flex-col gap-2 xl:flex-1 ${enter}`}>
        <h2 className="font-serif text-[24px] leading-[25px] text-content xl:text-title-34">{f.title}</h2>
        <p className="text-body-15 text-content-muted">{f.problem}</p>
      </div>
      <div style={after(350)} className={`flex min-w-0 flex-col gap-2 xl:flex-1 ${enter}`}>
        <p className="text-[17px] font-semibold leading-5 text-content">{f.fix}</p>
        <p className="text-body-15 text-content-muted">{f.how}</p>
      </div>
    </li>
  )
}

/**
 * Page publique « Ce qu'on corrige » (Figma 20:191, 20:290, 20:395 ; sombre 47:8664). The texts say what
 * the app does today, checked against the code on 02/10 (decision of Ronaldo): the mock-up promised a
 * « Reprendre » to the next video, chapters on a seek bar and a question per chapter, which do not exist.
 */
export function WhatWeFixPage() {
  const ads = useReveal<HTMLDivElement>()
  const table = useReveal<HTMLDivElement>()
  return (
    <div className="min-h-screen bg-page">
      <PublicNav />
      <main>
        <section className="flex flex-col gap-5 px-4 py-14 md:px-8 md:pb-16 md:pt-20 xl:flex-row xl:items-end xl:gap-12 xl:px-gutter xl:pb-[72px] xl:pt-[120px]">
          <h1 className="flex flex-col font-serif text-[52px] leading-[55px] tracking-[-0.03em] text-content md:text-[80px] md:leading-[76px] xl:flex-1 xl:text-display">
            <span style={after(100)} className={ENTER}>
              Ce qu’on corrige,
            </span>
            <em style={after(300)} className={`text-accent-text ${ENTER}`}>
              et comment.
            </em>
          </h1>
          <p style={after(500)} className={`text-body-16 text-content-muted xl:w-[380px] xl:shrink-0 ${ENTER}`}>
            Six frictions qui transforment une heure de cours en trois heures de dérive. Pour chacune : ce qu’on change, et la
            mécanique derrière.
          </p>
        </section>

        <section aria-label="Les six frictions" className="px-4 pb-14 md:px-8 xl:px-gutter xl:pb-24">
          {/* The rule under the heads of the table draws itself, from the number to the state. */}
          <div ref={table.ref} aria-hidden="true" className="relative hidden gap-10 pb-3.5 font-mono text-mono-12 uppercase text-content-muted xl:flex">
            <span
              className={`absolute inset-x-0 bottom-0 h-px origin-left bg-line-strong ${table.shown ? 'motion-safe:animate-yc-draw-x' : 'motion-safe:scale-x-0'}`}
            />
            <p className="w-16 shrink-0">N°</p>
            <p className="flex-1">La friction</p>
            <p className="flex-1">Notre correction</p>
            <p className="w-[140px] shrink-0">État</p>
          </div>
          <ol>
            {FRICTIONS.map((f, i) => (
              <FrictionRow key={f.title} f={f} n={String(i + 1).padStart(2, '0')} />
            ))}
          </ol>
        </section>

        <section className="px-4 pb-14 md:px-8 xl:px-gutter xl:pb-[120px]">
          <div
            ref={ads.ref}
            className={`flex flex-col gap-4 rounded-[28px] bg-inverse px-6 py-10 text-content-inverse md:p-16 ${revealClass(ads.shown)}`}
          >
            <h2 className="font-serif text-title-34 tracking-[-0.01em] md:text-title-56">Ce qu’on ne corrige pas : les publicités.</h2>
            <p className="text-lead">
              Les conditions de YouTube interdisent de les bloquer ou de les modifier dans le lecteur intégré, et c’est ce qui
              rémunère les gens qui font ces cours. Youcus retire la dérive autour de la vidéo, jamais ce qui la finance.
            </p>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
