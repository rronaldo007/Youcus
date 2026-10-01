import { describe, expect, it } from 'vitest'
import { chartHeight, chartMarkup, chartToSvg, chartWords, highest, parseValue, readChart, sliceColor, LIGHT_PALETTE, type Chart } from './chart'

// The drawing of a chart (YC-54), Figma « Bloc de note › Graphique » 65:2230.

const week: Chart = {
  title: 'Temps d’étude par jour (min)',
  kind: 'bar',
  rows: [
    { label: 'L', value: 32 },
    { label: 'M', value: 55 },
    { label: 'M', value: null },
    { label: 'V', value: 68 },
  ],
}
const rects = (svg: string) => [...svg.matchAll(/<rect x="[^"]+" y="([^"]+)" width="[^"]+" height="([^"]+)"[^>]* fill="([^"]+)"/g)].map((m) => ({ h: +m[2], fill: m[3] }))

describe('chart data (YC-54)', () => {
  it('reads a value the French way; refuses a negative, a word, a too big one', () => {
    expect(parseValue('12,5')).toBe(12.5)
    expect(parseValue(' 1 200 ')).toBe(1200)
    expect(parseValue('')).toBeNull()
    expect(parseValue('-3')).toBeUndefined()
    expect(parseValue('douze')).toBeUndefined()
    expect(parseValue('2000000000')).toBeUndefined()
  })

  it('reads what a node holds, an unknown kind as bars, no row as the three to fill', () => {
    expect(readChart({ title: 'T', kind: 'pie', rows: [{ label: 'a', value: 3 }] })).toEqual({ title: 'T', kind: 'pie', rows: [{ label: 'a', value: 3 }] })
    const odd = readChart({ kind: 'radar', rows: [] })
    expect(odd.kind).toBe('bar')
    expect(odd.rows).toHaveLength(3)
  })

  it('says the chart in words: its title, then each label and value', () => {
    expect(chartWords(week)).toBe('Temps d’étude par jour (min) : L 32, M 55, M —, V 68')
  })
})

describe('chart drawing (YC-54)', () => {
  it('bars: the tallest is 136 px and green, the others blue in proportion, an empty one a 2 px line and « — »', () => {
    const svg = chartMarkup(week, 700, LIGHT_PALETTE)
    expect(highest(week.rows)).toBe(68)
    expect(rects(svg)).toEqual([
      { h: 64, fill: '#1d4e89' },
      { h: 110, fill: '#1d4e89' },
      { h: 2, fill: '#1d4e89' },
      { h: 136, fill: '#1e6e40' },
    ])
    expect(svg).toContain('>—</text>')
  })

  it('line: an empty value breaks it in two, the highest point is green', () => {
    const svg = chartMarkup({ ...week, kind: 'line' }, 700, LIGHT_PALETTE)
    // L–M before the gap; V alone after it draws no line.
    expect(svg.match(/<polyline/g)).toHaveLength(1)
    // Two points on each side: two lines, none across the gap.
    const two = chartMarkup({ ...week, kind: 'line', rows: [...week.rows, { label: 'S', value: 20 }] }, 700, LIGHT_PALETTE)
    expect([...two.matchAll(/<polyline points="([^"]+)"/g)].map((m) => m[1].split(' ').length)).toEqual([2, 2])
    expect(svg.match(/<circle [^>]*fill="#1e6e40"/g)).toHaveLength(1)
  })

  it('pie: a slice per value in turn of colour, the legend in percent; nothing to share says so', () => {
    const svg = chartMarkup({ ...week, kind: 'pie' }, 700, LIGHT_PALETTE)
    expect(svg.match(/<path /g)).toHaveLength(3)
    expect(svg).toContain('L · 32 (21 %)')
    expect(svg).toContain('M · —')
    expect(chartMarkup({ ...week, kind: 'pie', rows: [{ label: 'a', value: null }] }, 700, LIGHT_PALETTE)).toContain('Aucune valeur à répartir')
    // On a narrow block the legend goes under the pie: the block grows.
    expect(chartHeight({ ...week, kind: 'pie' }, 300)).toBeGreaterThan(chartHeight({ ...week, kind: 'pie' }, 700))
  })

  it('pie colours: seven in turn, and the last slice never takes the colour of the first it touches', () => {
    expect(Array.from({ length: 7 }, (_, i) => sliceColor(i, 7))).toEqual(['bleu', 'vert', 'orange', 'violet', 'rouge', 'prune', 'gris'])
    expect(sliceColor(7, 8)).toBe('vert')
    expect(sliceColor(7, 9)).toBe('bleu')
  })

  it('many rows: the labels thin out instead of overlapping', () => {
    const rows = Array.from({ length: 24 }, (_, i) => ({ label: `J${i + 1}`, value: i }))
    const svg = chartMarkup({ ...week, rows }, 300, LIGHT_PALETTE)
    const labels = svg.match(/>J\d+<\/text>/g) ?? []
    expect(labels.length).toBeLessThan(24)
    expect(labels.length).toBeGreaterThan(5)
  })

  it('exports a standalone light SVG, its title on top, its text escaped', () => {
    const { svg, width } = chartToSvg({ ...week, title: 'A < B & C' })
    expect(width).toBe(600)
    expect(svg).toContain('A &lt; B &amp; C')
    expect(svg).not.toContain('var(--')
  })
})
