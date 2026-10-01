/**
 * The scene of a diagram block (YC-53), Figma « Dessin de schéma » 64:2007: shapes and arrows
 * between them. Plain data, the same as the server validates (server/src/lib/noteDoc.ts): an arrow
 * names two shapes, never a position, so it follows them when they move.
 */

export const SHAPE_KINDS = ['rect', 'ellipse', 'diamond', 'text'] as const
export type ShapeKind = (typeof SHAPE_KINDS)[number]

/** Colour names, each a note text colour with its highlight (readable in light and dark). */
export const DIAGRAM_COLORS = ['bleu', 'rouge', 'vert', 'orange', 'violet', 'gris'] as const
export type DiagramColor = (typeof DIAGRAM_COLORS)[number]

export const COLOR_LABELS: Record<DiagramColor, string> = {
  bleu: 'Bleu',
  rouge: 'Rouge',
  vert: 'Vert',
  orange: 'Orange',
  violet: 'Violet',
  gris: 'Gris',
}

/** The highlight under each colour's text: Figma uses rose under red, yellow under orange. */
const FILL_OF: Record<DiagramColor, string> = { bleu: 'bleu', rouge: 'rose', vert: 'vert', orange: 'jaune', violet: 'violet', gris: 'gris' }

/** CSS of a colour, through the note tokens (light and dark). */
export const strokeVar = (c: DiagramColor) => `var(--note-text-${c})`
export const fillVar = (c: DiagramColor) => `var(--note-highlight-${FILL_OF[c]})`

export interface Shape {
  id: string
  kind: ShapeKind
  x: number
  y: number
  w: number
  h: number
  text: string
  color: DiagramColor
}

export interface Arrow {
  id: string
  from: string
  to: string
  label: string
}

export interface Scene {
  shapes: Shape[]
  arrows: Arrow[]
}

export const EMPTY_SCENE: Scene = { shapes: [], arrows: [] }

/** Same limits as the server. */
export const MAX_SHAPES = 100
export const MAX_ARROWS = 200
export const MAX_TEXT = 200
export const COORD_LIMIT = 10_000

export const DEFAULT_SIZE: Record<ShapeKind, { w: number; h: number }> = {
  rect: { w: 150, h: 56 },
  ellipse: { w: 150, h: 64 },
  diamond: { w: 180, h: 140 },
  text: { w: 160, h: 24 },
}
export const DEFAULT_COLOR: Record<ShapeKind, DiagramColor> = { rect: 'bleu', ellipse: 'vert', diamond: 'orange', text: 'gris' }

/** A short id, unique in the scene. */
export function newId(scene: Scene): string {
  const taken = new Set([...scene.shapes.map((s) => s.id), ...scene.arrows.map((a) => a.id)])
  let id = ''
  do id = Math.random().toString(36).slice(2, 10)
  while (!id || taken.has(id))
  return id
}

export const centerOf = (s: Shape) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 })

/** Where the line from the centre of `s` towards `p` leaves the shape. */
export function borderPoint(s: Shape, p: { x: number; y: number }) {
  const c = centerOf(s)
  const dx = p.x - c.x
  const dy = p.y - c.y
  if (dx === 0 && dy === 0) return c
  const rx = s.w / 2
  const ry = s.h / 2
  let t: number
  if (s.kind === 'ellipse') t = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
  else if (s.kind === 'diamond') t = 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry)
  else t = Math.min(dx === 0 ? Infinity : rx / Math.abs(dx), dy === 0 ? Infinity : ry / Math.abs(dy))
  return { x: c.x + dx * t, y: c.y + dy * t }
}

/** An arrow from border to border, the head kept 2 px off the target's line. */
export function arrowLine(scene: Scene, a: Arrow) {
  const from = scene.shapes.find((s) => s.id === a.from)
  const to = scene.shapes.find((s) => s.id === a.to)
  if (!from || !to) return null
  const start = borderPoint(from, centerOf(to))
  const end = borderPoint(to, centerOf(from))
  const len = Math.hypot(end.x - start.x, end.y - start.y) || 1
  const back = Math.min(2, len / 2)
  return {
    x1: start.x,
    y1: start.y,
    x2: end.x - ((end.x - start.x) / len) * back,
    y2: end.y - ((end.y - start.y) / len) * back,
  }
}

/** Where an arrow's label sits: by the middle of the line, on its left side. */
export function labelPoint(line: { x1: number; y1: number; x2: number; y2: number }) {
  const mx = (line.x1 + line.x2) / 2
  const my = (line.y1 + line.y2) / 2
  const len = Math.hypot(line.x2 - line.x1, line.y2 - line.y1) || 1
  // The normal, turned up for a horizontal line, so the label reads above it.
  let nx = (line.y1 - line.y2) / len
  let ny = (line.x2 - line.x1) / len
  if (ny > 0) {
    nx = -nx
    ny = -ny
  }
  return { x: mx + nx * 14, y: my + ny * 14 }
}

/** The box around every shape (and the labels of the arrows), with a margin. */
export function boundsOf(scene: Scene, margin = 24) {
  if (!scene.shapes.length) return { x: 0, y: 0, w: 700, h: 260 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of scene.shapes) {
    minX = Math.min(minX, s.x)
    minY = Math.min(minY, s.y)
    maxX = Math.max(maxX, s.x + s.w)
    maxY = Math.max(maxY, s.y + s.h)
  }
  for (const a of scene.arrows) {
    const line = arrowLine(scene, a)
    if (!line || !a.label) continue
    const p = labelPoint(line)
    const half = (a.label.length * 7) / 2
    minX = Math.min(minX, p.x - half)
    maxX = Math.max(maxX, p.x + half)
    minY = Math.min(minY, p.y - 10)
    maxY = Math.max(maxY, p.y + 10)
  }
  return { x: minX - margin, y: minY - margin, w: maxX - minX + margin * 2, h: maxY - minY + margin * 2 }
}

/**
 * The lines of a label, wrapped to the width of its shape. SVG text does not wrap: the width of
 * a character is estimated (0.55 em, Hanken Grotesk), enough for short labels.
 */
export function wrapText(text: string, width: number, size: number): string[] {
  const perLine = Math.max(4, Math.floor(width / (size * 0.55)))
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (next.length > perLine && line) {
        lines.push(line)
        line = word
      } else line = next
    }
    lines.push(line)
  }
  return lines
}

export const LABEL_SIZE = 15
export const ARROW_LABEL_SIZE = 13

/** The points of a diamond inside its box. */
export const diamondPoints = (s: Shape) => `${s.x + s.w / 2},${s.y} ${s.x + s.w},${s.y + s.h / 2} ${s.x + s.w / 2},${s.y + s.h} ${s.x},${s.y + s.h / 2}`

/** Light values of the colours, for the export (Word has no dark theme): note-editor.css. */
const LIGHT_TEXT: Record<DiagramColor, string> = {
  bleu: '#1d4e89',
  rouge: '#b0311c',
  vert: '#1e6e40',
  orange: '#8f4709',
  violet: '#5e3a94',
  gris: '#5a554a',
}
const LIGHT_FILL: Record<DiagramColor, string> = {
  bleu: '#cfe0f5',
  rouge: '#f5d2de',
  vert: '#cde8c4',
  orange: '#f6de84',
  violet: '#e2d7f2',
  gris: '#e4ddcf',
}

const escapeXml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string)

/** The scene as a standalone SVG in the light colours, for the .docx (drawn into a PNG). */
export function sceneToSvg(scene: Scene): { svg: string; width: number; height: number } {
  const b = boundsOf(scene)
  const parts: string[] = []
  const text = (x: number, y: number, lines: string[], size: number, color: string, weight: number) => {
    const top = y - ((lines.length - 1) * size * 1.25) / 2
    lines.forEach((l, i) =>
      parts.push(
        `<text x="${x}" y="${top + i * size * 1.25}" font-family="Hanken Grotesk, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="middle" dominant-baseline="central">${escapeXml(l)}</text>`,
      ),
    )
  }
  for (const s of scene.shapes) {
    const c = centerOf(s)
    const stroke = LIGHT_TEXT[s.color]
    const fill = LIGHT_FILL[s.color]
    if (s.kind === 'rect') parts.push(`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`)
    else if (s.kind === 'ellipse') parts.push(`<ellipse cx="${c.x}" cy="${c.y}" rx="${s.w / 2}" ry="${s.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`)
    else if (s.kind === 'diamond') parts.push(`<polygon points="${diamondPoints(s)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`)
    const inner = s.kind === 'diamond' ? s.w * 0.6 : s.w - 16
    text(c.x, c.y, wrapText(s.text, inner, s.kind === 'text' ? ARROW_LABEL_SIZE : LABEL_SIZE), s.kind === 'text' ? ARROW_LABEL_SIZE : LABEL_SIZE, s.kind === 'text' ? LIGHT_TEXT.gris : stroke, s.kind === 'text' ? 500 : 600)
  }
  for (const a of scene.arrows) {
    const line = arrowLine(scene, a)
    if (!line) continue
    parts.push(`<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="#5a554a" stroke-width="2" marker-end="url(#head)"/>`)
    if (a.label) {
      const p = labelPoint(line)
      text(p.x, p.y, [a.label], ARROW_LABEL_SIZE, '#5a554a', 500)
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(b.w)}" height="${Math.round(b.h)}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}">` +
    `<defs><marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="#5a554a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>` +
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#fffdf8"/>` +
    parts.join('') +
    `</svg>`
  return { svg, width: Math.round(b.w), height: Math.round(b.h) }
}

/** A scene from a node attribute, whatever it holds: an invalid one draws as empty. */
export function readScene(value: unknown): Scene {
  const v = value as Partial<Scene> | null
  if (!v || !Array.isArray(v.shapes) || !Array.isArray(v.arrows)) return EMPTY_SCENE
  return { shapes: v.shapes, arrows: v.arrows }
}
