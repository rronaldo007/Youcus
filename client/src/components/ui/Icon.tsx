import type { CSSProperties } from 'react'
import alert from './icons/alert.svg'
import bookmark from './icons/bookmark.svg'
import download from './icons/download.svg'
import expand from './icons/expand.svg'
import grid from './icons/grid.svg'
import logout from './icons/logout.svg'
import moon from './icons/moon.svg'
import settings from './icons/settings.svg'
import star from './icons/star.svg'
import sun from './icons/sun.svg'
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
const ICONS = { alert, bookmark, check, clock, close, download, expand, gauge, grid, logout, menu, moon, offline, play, plus, search, settings, star, sun }

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
