/**
 * A chart (YC-54), Figma « Bloc de note › Graphique » 65:2230: a title, a small table of labels and
 * values, drawn as bars, a line or a pie. The same drawing serves the note (colours from the note
 * tokens) and the .docx (their light values): `chartToSvg`.
 */

export const CHART_KINDS = ['bar', 'line', 'pie'] as const
export type ChartKind = (typeof CHART_KINDS)[number]
export const CHART_KIND_LABELS: Record<ChartKind, string> = { bar: 'Barres', line: 'Courbe', pie: 'Secteurs' }

export type ChartRow = { label: string; value: number | null }
export type Chart = { title: string; kind: ChartKind; rows: ChartRow[] }

/** Same limits as the server (server/src/lib/noteDoc.ts). */
export const MAX_ROWS = 24
export const MAX_LABEL = 24
export const MAX_TITLE = 80
export const MAX_VALUE = 1_000_000_000

/** A new chart: three rows to fill, the data editor open (see NoteChartView). */
export const NEW_CHART: Chart = {
  title: '',
  kind: 'bar',
  rows: [
    { label: 'A', value: null },
    { label: 'B', value: null },
    { label: 'C', value: null },
  ],
}

/** A chart from a node attribute, whatever it holds: what cannot be read is left out. */
export function readChart(value: unknown): Chart {
  const v = (value ?? {}) as Partial<Chart>
  const kind = CHART_KINDS.includes(v.kind as ChartKind) ? (v.kind as ChartKind) : 'bar'
  const rows = Array.isArray(v.rows)
    ? v.rows
        .filter((r): r is ChartRow => !!r && typeof r.label === 'string')
        .map((r) => ({ label: r.label, value: typeof r.value === 'number' && Number.isFinite(r.value) ? r.value : null }))
    : []
  return { title: typeof v.title === 'string' ? v.title : '', kind, rows: rows.length ? rows : NEW_CHART.rows }
}

/** « 12,5 », « 12.5 », « 1 200 » → a number; empty → null; anything else, or out of bounds → undefined. */
export function parseValue(text: string): number | null | undefined {
  const t = text.replace(/[\s\u202f\u00a0]/g, '').replace(',', '.')
  if (t === '') return null
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined
  const n = Number(t)
  return n <= MAX_VALUE ? n : undefined
}

/** A value as the French write it: « 12,5 », « 1 200 ». */
export const formatValue = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

/** The colours a drawing uses, by note colour name. */
export type ChartPalette = {
  ink: string
  muted: string
  rule: string
  /** The page under the drawing: the line between two slices. */
  paper: string
  colors: Record<'bleu' | 'vert' | 'orange' | 'violet' | 'rouge' | 'gris' | 'prune', string>
}

/** In the note: the tokens, so the dark theme follows. */
export const TOKEN_PALETTE: ChartPalette = {
  ink: 'var(--note-ink)',
  muted: 'var(--note-ink-muted)',
  rule: 'var(--note-border)',
  paper: 'var(--note-paper)',
  colors: {
    bleu: 'var(--note-text-bleu)',
    vert: 'var(--note-text-vert)',
    orange: 'var(--note-text-orange)',
    violet: 'var(--note-text-violet)',
    rouge: 'var(--note-text-rouge)',
    gris: 'var(--note-text-gris)',
    prune: 'var(--note-text-prune)',
  },
}

/** In the .docx (Word has no dark theme): the light values of note-editor.css. */
export const LIGHT_PALETTE: ChartPalette = {
  ink: '#17150f',
  muted: '#5a554a',
  rule: '#d8d0bf',
  paper: '#fffdf8',
  colors: { bleu: '#1d4e89', vert: '#1e6e40', orange: '#8f4709', violet: '#5e3a94', rouge: '#b0311c', gris: '#5a554a', prune: '#8e2f5e' },
}

/** The slices take the colours in this order. */
const PIE_ORDER = ['bleu', 'vert', 'orange', 'violet', 'rouge', 'prune', 'gris'] as const

/** The colour of slice `i` of `n`: in turn, but the last never that of the first, which it touches. */
export function sliceColor(i: number, n: number): (typeof PIE_ORDER)[number] {
  const k = PIE_ORDER.length
  if (n > 1 && i === n - 1 && i % k === 0) return PIE_ORDER[1]
  return PIE_ORDER[i % k]
}

export const CHART_HEIGHT = 200
const VALUE_SIZE = 11
const LABEL_SIZE = 11
/** The tallest bar or the highest point: 136 px in the mockup (68 min). */
const PLOT = 136
const TOP = VALUE_SIZE + 10

const escapeXml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string)
const mono = `font-family="JetBrains Mono, Consolas, monospace" font-size="${VALUE_SIZE}"`
const sans = 'font-family="Hanken Grotesk, Arial, sans-serif"'
const r1 = (n: number) => Math.round(n * 10) / 10

/** The highest value, which the mockup draws in green; null when there is none. */
export function highest(rows: ChartRow[]): number | null {
  const values = rows.map((r) => r.value).filter((v): v is number => v !== null)
  return values.length ? Math.max(...values) : null
}

/** A label cut to what its column holds (about 7 px a character). */
function fit(label: string, room: number) {
  const max = Math.max(1, Math.floor(room / 7))
  return label.length <= max ? label : `${label.slice(0, Math.max(1, max - 1))}…`
}

/** The labels under the columns: every one when they fit, else one in two, one in three… */
function labelStep(slot: number) {
  return Math.max(1, Math.ceil(22 / slot))
}

function bars(chart: Chart, width: number, p: ChartPalette): string[] {
  const n = chart.rows.length
  const slot = width / n
  const barW = Math.min(28, slot * 0.6)
  const max = highest(chart.rows)
  const base = TOP + PLOT
  const step = labelStep(slot)
  return chart.rows.flatMap((r, i) => {
    const cx = slot * i + slot / 2
    const h = r.value === null || !max ? 2 : Math.max(2, (r.value / max) * PLOT)
    const color = r.value !== null && r.value === max && max > 0 ? p.colors.vert : p.colors.bleu
    const out = [
      `<rect x="${r1(cx - barW / 2)}" y="${r1(base - h)}" width="${r1(barW)}" height="${r1(h)}" rx="${Math.min(4, barW / 4)}" fill="${color}"/>`,
      `<text x="${r1(cx)}" y="${r1(base - h - 6)}" ${mono} fill="${p.muted}" text-anchor="middle">${r.value === null ? '—' : escapeXml(formatValue(r.value))}</text>`,
    ]
    if (i % step === 0) out.push(`<text x="${r1(cx)}" y="${base + 6 + LABEL_SIZE}" ${mono} fill="${p.muted}" text-anchor="middle">${escapeXml(fit(r.label, slot * step - 4))}</text>`)
    return out
  })
}

function line(chart: Chart, width: number, p: ChartPalette): string[] {
  const n = chart.rows.length
  const slot = width / n
  const max = highest(chart.rows)
  const base = TOP + PLOT
  const step = labelStep(slot)
  const at = (i: number, v: number) => ({ x: slot * i + slot / 2, y: base - (max ? (v / max) * PLOT : 0) })
  const out = [`<line x1="0" y1="${base}" x2="${r1(width)}" y2="${base}" stroke="${p.rule}" stroke-width="1"/>`]
  // An empty value breaks the line: a gap, not a fall to zero.
  let run: string[] = []
  const flush = () => {
    if (run.length > 1) out.push(`<polyline points="${run.join(' ')}" fill="none" stroke="${p.colors.bleu}" stroke-width="2" stroke-linejoin="round"/>`)
    run = []
  }
  chart.rows.forEach((r, i) => {
    if (r.value === null) return flush()
    const { x, y } = at(i, r.value)
    run.push(`${r1(x)},${r1(y)}`)
  })
  flush()
  chart.rows.forEach((r, i) => {
    const cx = slot * i + slot / 2
    if (r.value !== null) {
      const { x, y } = at(i, r.value)
      const color = r.value === max && max > 0 ? p.colors.vert : p.colors.bleu
      out.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="4" fill="${color}"/>`)
      out.push(`<text x="${r1(x)}" y="${r1(y - 10)}" ${mono} fill="${p.muted}" text-anchor="middle">${escapeXml(formatValue(r.value))}</text>`)
    } else {
      out.push(`<text x="${r1(cx)}" y="${base - 6}" ${mono} fill="${p.muted}" text-anchor="middle">—</text>`)
    }
    if (i % step === 0) out.push(`<text x="${r1(cx)}" y="${base + 6 + LABEL_SIZE}" ${mono} fill="${p.muted}" text-anchor="middle">${escapeXml(fit(r.label, slot * step - 4))}</text>`)
  })
  return out
}

/** The point of a circle at an angle, 0 at the top, clockwise. */
const polar = (cx: number, cy: number, r: number, a: number) => ({ x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) })

function pie(chart: Chart, width: number, p: ChartPalette): string[] {
  const parts = chart.rows.map((r, i) => ({ ...r, color: p.colors[sliceColor(i, chart.rows.length)] }))
  const total = parts.reduce((s, r) => s + (r.value ?? 0), 0)
  if (total <= 0) return [`<text x="${r1(width / 2)}" y="${CHART_HEIGHT / 2}" ${sans} font-size="13" fill="${p.muted}" text-anchor="middle">Aucune valeur à répartir</text>`]
  // The pie on the left; its legend on the right, under it on a narrow block.
  const narrow = width < 360
  const radius = 80
  const cx = narrow ? width / 2 : radius + 8
  const cy = radius + 10
  const out: string[] = []
  let a = 0
  for (const r of parts) {
    if (!r.value) continue
    const share = r.value / total
    if (share >= 0.9999) {
      out.push(`<circle cx="${r1(cx)}" cy="${cy}" r="${radius}" fill="${r.color}"/>`)
      break
    }
    const from = polar(cx, cy, radius, a)
    a += share * 2 * Math.PI
    const to = polar(cx, cy, radius, a)
    out.push(
      `<path d="M${r1(cx)} ${cy} L${r1(from.x)} ${r1(from.y)} A${radius} ${radius} 0 ${share > 0.5 ? 1 : 0} 1 ${r1(to.x)} ${r1(to.y)} Z" fill="${r.color}" stroke="${p.paper}" stroke-width="2"/>`,
    )
  }
  const lx = narrow ? 8 : cx + radius + 32
  const ly = narrow ? cy + radius + 24 : Math.max(16, cy - (parts.length * 22) / 2 + 11)
  parts.forEach((r, i) => {
    const y = ly + i * 22
    const pct = r.value ? Math.round((r.value / total) * 100) : 0
    const text = `${r.label} · ${r.value === null ? '—' : `${formatValue(r.value)} (${pct} %)`}`
    out.push(`<rect x="${r1(lx)}" y="${y - 10}" width="12" height="12" rx="3" fill="${r.color}"/>`)
    out.push(`<text x="${r1(lx + 20)}" y="${y}" ${sans} font-size="13" fill="${p.ink}">${escapeXml(text)}</text>`)
  })
  return out
}

/** How tall the drawing is at this width: a pie's legend may go under it. */
export function chartHeight(chart: Chart, width: number): number {
  if (chart.kind !== 'pie' || width >= 360) return CHART_HEIGHT
  return 10 + 160 + 24 + chart.rows.length * 22
}

/** The inner markup of the drawing, `width` wide: the SVG children, its text escaped. */
export function chartMarkup(chart: Chart, width: number, palette: ChartPalette): string {
  const draw = chart.kind === 'pie' ? pie : chart.kind === 'line' ? line : bars
  return draw(chart, width, palette).join('')
}

/** A standalone SVG of the chart in the light colours, for the .docx: its title on top. */
export function chartToSvg(chart: Chart, width = 600): { svg: string; width: number; height: number } {
  const pad = 20
  const head = chart.title ? 34 : 8
  const inner = chartHeight(chart, width - pad * 2)
  const height = head + inner + pad
  const title = chart.title
    ? `<text x="${pad}" y="${pad + 8}" ${sans} font-size="15" font-weight="600" fill="${LIGHT_PALETTE.ink}">${escapeXml(chart.title)}</text>`
    : ''
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${LIGHT_PALETTE.paper}"/>` +
    title +
    `<g transform="translate(${pad} ${head})">${chartMarkup(chart, width - pad * 2, LIGHT_PALETTE)}</g>` +
    `</svg>`
  return { svg, width, height }
}

/** The chart in words, for search, the alternative text of the export and a screen reader. */
export function chartWords(chart: Chart): string {
  const rows = chart.rows.map((r) => `${r.label} ${r.value === null ? '—' : formatValue(r.value)}`).join(', ')
  return [chart.title, rows].filter(Boolean).join(' : ')
}
