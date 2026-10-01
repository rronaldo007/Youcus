import type { CSSProperties } from 'react'
import { Icon } from '@/components/ui/Icon'
import { TimestampChip } from '@/components/ui/Timestamp'
import { useFitScale } from '@/features/landing/useFitScale'

const WIDTH = 600
const HEIGHT = 520

/** The chapters of the progress bar, cut where each one starts (Figma « Barre de progression › Chapitres »). */
const CHAPTERS = [
  { left: '0%', right: '92.5%' },
  { left: '8.33%', right: '72.78%' },
  { left: '28.06%', right: '41.11%' },
  { left: '59.72%', right: '14.17%' },
  { left: '86.67%', right: '0.56%' },
]

/** Where the playhead stops in the frame: 162 of 512 px. */
const PLAYHEAD_AT = '31.6%'

const NOTES = [
  { seconds: 245, text: 'Le tableau de dépendances' },
  { seconds: 520, text: 'Toujours nettoyer l’effet' },
  { seconds: 754, text: 'Les pièges à éviter' },
]

/**
 * The scene of the hero (Figma « Accueil » 13:38): a video on the stage, its playhead running, and
 * a page of notes laid across it. Drawn at 600 × 520 and scaled down to its box. Decorative: the
 * text of the hero says the same thing.
 */
export function HeroScene() {
  const { ref, scale } = useFitScale<HTMLDivElement>(WIDTH)
  return (
    <div ref={ref} aria-hidden="true" className="w-full max-w-[600px]" style={{ height: HEIGHT * scale }}>
      <div className="relative origin-top-left" style={{ width: WIDTH, height: HEIGHT, transform: `scale(${scale})` }}>
        <div
          className="absolute left-0 top-[30px] h-[315px] w-[560px] overflow-hidden rounded-yc-lg bg-stage shadow-modal motion-safe:animate-yc-pop"
          style={{ animationDelay: '150ms' }}
        >
          <span className="absolute left-[258px] top-[135px] flex size-11 items-center justify-center rounded-full bg-accent text-on-accent">
            <Icon name="play" />
          </span>
          <div className="absolute left-6 top-[261px] h-4 w-[512px]">
            {CHAPTERS.map((c) => (
              <span key={c.left} className="absolute top-1.5 h-1 rounded-sm bg-line" style={{ left: c.left, right: c.right }} />
            ))}
            <div
              data-playhead=""
              className="absolute left-0 top-0 flex h-4 w-[var(--yc-playhead-to)] items-center motion-safe:animate-yc-playhead"
              style={{ '--yc-playhead-to': PLAYHEAD_AT, animationDelay: '450ms' } as CSSProperties}
            >
              <span className="-mr-2 h-1 flex-1 rounded-sm bg-accent" />
              <span className="size-4 shrink-0 rounded-full border-2 border-[color:var(--yc-text-on-stage)] bg-stage" />
            </div>
          </div>
        </div>
        <div className="absolute left-[243px] top-[285px] motion-safe:animate-yc-rise" style={{ animationDelay: '300ms' }}>
          <div className="flex w-[340px] -rotate-2 flex-col gap-3 rounded-[14px] border border-line bg-surface px-[22px] py-5 shadow-toast">
            <p className="font-serif text-title-24 text-content">Mes notes</p>
            {NOTES.map((n) => (
              <p key={n.seconds} className="flex items-center gap-2.5 whitespace-nowrap text-body-15 text-content">
                <TimestampChip seconds={n.seconds} />
                {n.text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
