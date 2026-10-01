import { describe, expect, it } from 'vitest'
import css from './tokens.css?raw'

// The Figma design system promises « contraste 5:1 pour tout texte »; WCAG AA asks 4.5:1. Every
// text token is checked on every background it is meant for, light and dark (YC-66).

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const body = css.slice(start, css.indexOf('\n}', start))
  return Object.fromEntries([...body.matchAll(/--yc-([\w-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]))
}

const light = tokens(':root')
const dark = { ...light, ...tokens('.dark') }

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const texts = ['text-primary', 'text-muted', 'text-accent', 'text-error', 'text-success']
const grounds = ['bg-page', 'bg-surface', 'bg-sunken', 'bg-app']
const pairs: [string, string][] = [
  ...texts.flatMap((t) => grounds.map((b): [string, string] => [t, b])),
  ['text-on-accent', 'bg-accent'],
  ['text-on-accent', 'bg-accent-hover'],
  ['text-inverse', 'bg-inverse'],
  ['text-on-mark', 'bg-mark'],
  ['text-on-stage', 'bg-stage'],
  ['text-accent-on-inverse', 'bg-inverse'],
  ['text-error', 'bg-error'],
  ['text-success', 'bg-success'],
  ['status-success-text', 'status-success-bg'],
  ['status-warning-text', 'status-warning-bg'],
  ['status-error-text', 'status-error-bg'],
]

describe('design tokens (YC-66)', () => {
  it('the light and dark themes define the same tokens', () => {
    const colours = (t: Record<string, string>) => Object.keys(t).filter((k) => !k.startsWith('space') && !k.startsWith('radius'))
    expect(Object.keys(tokens('.dark')).sort()).toEqual(colours(light).sort())
  })

  it.each([
    ['light', light],
    ['dark', dark],
  ])('every text reads at 4.5:1 at least on its backgrounds, %s', (_name, theme) => {
    const weak = pairs.filter(([t, b]) => contrast(theme[t], theme[b]) < 4.5).map(([t, b]) => `${t} on ${b}`)
    expect(weak).toEqual([])
  })

  it('a pair known to be weak is caught (the check can fail)', () => {
    expect(contrast(light['border-default'], light['bg-page'])).toBeLessThan(4.5)
  })
})
