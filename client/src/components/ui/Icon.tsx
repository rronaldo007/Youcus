import type { CSSProperties } from 'react'
import alert from './icons/alert.svg'
import check from './icons/check.svg'
import clock from './icons/clock.svg'
import close from './icons/close.svg'
import gauge from './icons/gauge.svg'
import menu from './icons/menu.svg'
import offline from './icons/offline.svg'
import play from './icons/play.svg'
import plus from './icons/plus.svg'
import search from './icons/search.svg'

/** The design system's icons (Figma page « Icônes » 3:103), 24 × 24, 2 px stroke. */
const ICONS = { alert, check, clock, close, gauge, menu, offline, play, plus, search }

export type IconName = keyof typeof ICONS

/**
 * A Figma icon drawn as a mask in currentColor: it takes the colour of the text around it,
 * light and dark, without a second set. Decorative: the control around it carries the name.
 */
export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  const mask = `url("${ICONS[name]}") center / contain no-repeat`
  const style: CSSProperties = { width: size, height: size, backgroundColor: 'currentColor', mask, WebkitMask: mask }
  return <span aria-hidden="true" data-icon={name} className={`inline-block shrink-0 ${className}`} style={style} />
}
