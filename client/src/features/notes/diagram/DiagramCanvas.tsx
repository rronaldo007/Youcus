import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  ARROW_LABEL_SIZE,
  COLOR_LABELS,
  DEFAULT_COLOR,
  DEFAULT_SIZE,
  DIAGRAM_COLORS,
  LABEL_SIZE,
  MAX_ARROWS,
  MAX_SHAPES,
  MAX_TEXT,
  arrowLine,
  boundsOf,
  centerOf,
  diamondPoints,
  fillVar,
  labelPoint,
  newId,
  strokeVar,
  wrapText,
  type DiagramColor,
  type Scene,
  type Shape,
  type ShapeKind,
} from '@/features/notes/diagram/scene'
import selectIcon from '../icons/diagram-select.svg'
import rectIcon from '../icons/diagram-rect.svg'
import ellipseIcon from '../icons/diagram-ellipse.svg'
import diamondIcon from '../icons/diagram-diamond.svg'
import arrowIcon from '../icons/diagram-arrow.svg'
import textIcon from '../icons/diagram-text.svg'
import colorIcon from '../icons/diagram-color.svg'
import closeIcon from '../icons/note/fermer.svg'

function Icon({ src, size = 24 }: { src: string; size?: number }) {
  return <span aria-hidden="true" className="yc-tool-icon" style={{ '--icon': `url("${src}")`, '--size': `${size}px` } as CSSProperties} />
}

type Tool = 'select' | ShapeKind | 'arrow'
type Selection = { type: 'shape' | 'arrow'; id: string } | null
type Box = { x: number; y: number; w: number; h: number }

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Sélection', icon: selectIcon },
  { id: 'rect', label: 'Rectangle', icon: rectIcon },
  { id: 'ellipse', label: 'Ellipse', icon: ellipseIcon },
  { id: 'diamond', label: 'Losange', icon: diamondIcon },
  { id: 'arrow', label: 'Flèche', icon: arrowIcon },
  { id: 'text', label: 'Texte', icon: textIcon },
]

/**
 * The camera that shows every shape, never above 100 %: a lone shape is not blown up, and adding
 * shapes does not make the drawing jump until they no longer fit.
 */
function fitBox(scene: Scene, size: { w: number; h: number }): Box {
  const b = boundsOf(scene)
  if (size.w / b.w <= 1 || size.h / b.h <= 1) return b
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  return { x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h }
}

/** The lines of a shape's text, centred on its middle. */
function Label({ shape }: { shape: Shape }) {
  const c = centerOf(shape)
  const isText = shape.kind === 'text'
  const size = isText ? ARROW_LABEL_SIZE : LABEL_SIZE
  const lines = wrapText(shape.text, shape.kind === 'diamond' ? shape.w * 0.6 : shape.w - 16, size)
  const top = c.y - ((lines.length - 1) * size * 1.25) / 2
  return (
    <text
      className="yc-diagram-label"
      fill={isText ? 'var(--note-ink-muted)' : strokeVar(shape.color)}
      fontSize={size}
      fontWeight={isText ? 500 : 600}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {lines.map((l, i) => (
        <tspan key={i} x={c.x} y={top + i * size * 1.25}>
          {l}
        </tspan>
      ))}
    </text>
  )
}

/** One shape, by its kind; the text has no outline. */
function ShapeBody({ shape }: { shape: Shape }) {
  const c = centerOf(shape)
  const common = { fill: fillVar(shape.color), stroke: strokeVar(shape.color), strokeWidth: 1.5 }
  if (shape.kind === 'rect') return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={12} {...common} />
  if (shape.kind === 'ellipse') return <ellipse cx={c.x} cy={c.y} rx={shape.w / 2} ry={shape.h / 2} {...common} />
  if (shape.kind === 'diamond') return <polygon points={diamondPoints(shape)} {...common} />
  // A free text keeps a transparent box: it can be picked and moved like a shape.
  return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill="transparent" />
}

interface DiagramCanvasProps {
  scene: Scene
  /** null: read only (« Aperçu », a phone's thumbnail). */
  onChange: ((scene: Scene) => void) | null
  height: number
  /** Extra buttons at the end of the bar (delete the block, close the full screen). */
  barEnd?: ReactNode
}

/**
 * The drawing of a diagram (YC-53), Figma « Bloc de note › Schéma » 65:2143: the tools of the bar,
 * shapes moved with the pointer, arrows drawn from shape to shape that follow them, the text of a
 * shape or an arrow typed after a double click, « Ajuster » to see everything. Keys pressed in the
 * drawing stay in it (Suppr deletes the selection, never the block).
 */
export function DiagramCanvas({ scene, onChange, height, barEnd }: DiagramCanvasProps) {
  const editable = onChange !== null
  const [tool, setTool] = useState<Tool>('select')
  const [selection, setSelection] = useState<Selection>(null)
  const [editing, setEditing] = useState<Selection>(null)
  const [arrowFrom, setArrowFrom] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [camera, setCamera] = useState<Box | null>(null)
  const [colorsOpen, setColorsOpen] = useState(false)
  // A shape being moved is drawn from this copy; the note gets one change when it is dropped.
  const [moving, setMoving] = useState<Scene | null>(null)
  const drag = useRef<{ kind: 'shape'; id: string; from: { x: number; y: number }; origin: { x: number; y: number } } | { kind: 'pan'; from: { x: number; y: number }; origin: Box } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 700, h: height })
  const markerId = useId().replace(/:/g, '')

  const shown = moving ?? scene
  const view = camera ?? fitBox(shown, size)
  const scale = Math.min(size.w / view.w, size.h / view.h) || 1

  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width && r.height) setSize({ w: r.width, h: r.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // A selection that no longer exists (undone, deleted) is dropped.
  useEffect(() => {
    if (selection && !(selection.type === 'shape' ? scene.shapes : scene.arrows).some((x) => x.id === selection.id)) setSelection(null)
  }, [scene, selection])

  /** A point of the screen in the drawing's coordinates (the viewBox is drawn « meet »). */
  const toWorld = (clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r || !r.width) return { x: view.x, y: view.y }
    const s = Math.min(r.width / view.w, r.height / view.h)
    const offX = (r.width - view.w * s) / 2
    const offY = (r.height - view.h * s) / 2
    return { x: view.x + (clientX - r.left - offX) / s, y: view.y + (clientY - r.top - offY) / s }
  }

  // The scene every change starts from: the last one sent, not the last one drawn. The block
  // redraws after the transaction, and two quick clicks built on the same old scene (the second
  // arrow replaced the first, seen in the tests).
  const latest = useRef({ prop: scene, value: scene })
  if (latest.current.prop !== scene) latest.current = { prop: scene, value: scene }
  const cur = () => latest.current.value

  // The view stays where it is while drawing (a new shape would re-centre the fitted view);
  // « Ajuster » lets it fit again.
  const commit = (next: Scene) => {
    if (!camera) setCamera(view)
    latest.current.value = next
    onChange?.(next)
  }

  const addShape = (kind: ShapeKind, at: { x: number; y: number }) => {
    if (cur().shapes.length >= MAX_SHAPES) return
    const { w, h } = DEFAULT_SIZE[kind]
    const scene = cur()
    const shape: Shape = { id: newId(scene), kind, x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2), w, h, text: '', color: DEFAULT_COLOR[kind] }
    commit({ ...scene, shapes: [...scene.shapes, shape] })
    setSelection({ type: 'shape', id: shape.id })
    setEditing({ type: 'shape', id: shape.id })
    setTool('select')
  }

  const addArrow = (from: string, to: string) => {
    const scene = cur()
    setArrowFrom(null)
    setPointer(null)
    if (from === to || scene.arrows.length >= MAX_ARROWS) return
    if (scene.arrows.some((a) => a.from === from && a.to === to)) return
    const arrow = { id: newId(scene), from, to, label: '' }
    commit({ ...scene, arrows: [...scene.arrows, arrow] })
    setSelection({ type: 'arrow', id: arrow.id })
  }

  const remove = (sel: Selection) => {
    const scene = cur()
    if (!sel) return
    if (sel.type === 'shape') {
      commit({ shapes: scene.shapes.filter((s) => s.id !== sel.id), arrows: scene.arrows.filter((a) => a.from !== sel.id && a.to !== sel.id) })
    } else commit({ ...scene, arrows: scene.arrows.filter((a) => a.id !== sel.id) })
    setSelection(null)
  }

  const setText = (sel: Selection, text: string) => {
    const scene = cur()
    if (!sel) return
    const clean = text.slice(0, MAX_TEXT)
    if (sel.type === 'shape') commit({ ...scene, shapes: scene.shapes.map((s) => (s.id === sel.id ? { ...s, text: clean } : s)) })
    else commit({ ...scene, arrows: scene.arrows.map((a) => (a.id === sel.id ? { ...a, label: clean } : a)) })
  }

  const setColor = (color: DiagramColor) => {
    const scene = cur()
    if (selection?.type !== 'shape') return
    commit({ ...scene, shapes: scene.shapes.map((s) => (s.id === selection.id ? { ...s, color } : s)) })
    setColorsOpen(false)
  }

  const onShapeDown = (shape: Shape) => (e: ReactPointerEvent) => {
    if (!editable) return
    e.stopPropagation()
    if (tool === 'arrow') {
      if (arrowFrom && arrowFrom !== shape.id) addArrow(arrowFrom, shape.id)
      else setArrowFrom(shape.id)
      return
    }
    setSelection({ type: 'shape', id: shape.id })
    setEditing(null)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { kind: 'shape', id: shape.id, from: toWorld(e.clientX, e.clientY), origin: { x: shape.x, y: shape.y } }
  }

  const onShapeUp = (shape: Shape) => () => {
    // An arrow drawn by dragging: released on another shape.
    if (tool === 'arrow' && arrowFrom && arrowFrom !== shape.id) addArrow(arrowFrom, shape.id)
  }

  const onBackgroundDown = (e: ReactPointerEvent) => {
    if (!editable) return
    const at = toWorld(e.clientX, e.clientY)
    if (tool === 'rect' || tool === 'ellipse' || tool === 'diamond' || tool === 'text') return addShape(tool, at)
    if (tool === 'arrow') {
      setArrowFrom(null)
      setPointer(null)
      return
    }
    setSelection(null)
    setEditing(null)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { kind: 'pan', from: { x: e.clientX, y: e.clientY }, origin: view }
  }

  const onMove = (e: ReactPointerEvent) => {
    if (tool === 'arrow' && arrowFrom) setPointer(toWorld(e.clientX, e.clientY))
    const d = drag.current
    if (!d) return
    if (d.kind === 'shape') {
      const at = toWorld(e.clientX, e.clientY)
      const dx = Math.round(at.x - d.from.x)
      const dy = Math.round(at.y - d.from.y)
      const base = cur()
      setMoving({ ...base, shapes: base.shapes.map((s) => (s.id === d.id ? { ...s, x: d.origin.x + dx, y: d.origin.y + dy } : s)) })
    } else {
      setCamera({ ...d.origin, x: d.origin.x - (e.clientX - d.from.x) / scale, y: d.origin.y - (e.clientY - d.from.y) / scale })
    }
  }

  const onUp = () => {
    if (drag.current?.kind === 'shape' && moving) commit(moving)
    drag.current = null
    setMoving(null)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!editable || editing) return
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
      e.preventDefault()
      remove(selection)
    } else if (e.key === 'Escape') {
      setSelection(null)
      setArrowFrom(null)
      setPointer(null)
      setTool('select')
    } else if (e.key === 'Enter' && selection) {
      e.preventDefault()
      setEditing(selection)
    }
  }

  const fit = () => setCamera(null)
  const editedShape = editing?.type === 'shape' ? shown.shapes.find((s) => s.id === editing.id) : undefined
  const editedArrow = editing?.type === 'arrow' ? shown.arrows.find((a) => a.id === editing.id) : undefined
  const editedArrowLine = editedArrow ? arrowLine(shown, editedArrow) : null
  const fromShape = arrowFrom ? shown.shapes.find((s) => s.id === arrowFrom) : undefined

  return (
    <div className="yc-diagram" style={{ height }} onKeyDown={onKeyDown} tabIndex={editable ? 0 : undefined} aria-label={editable ? 'Schéma : Suppr efface la sélection, Entrée en modifie le texte' : undefined}>
      {editable && (
        <div role="toolbar" aria-label="Schéma" className="yc-image-bar yc-diagram-bar">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="yc-tool"
              aria-label={t.label}
              title={t.label}
              aria-pressed={tool === t.id}
              onClick={() => {
                setTool(t.id)
                setArrowFrom(null)
                setPointer(null)
              }}
            >
              <Icon src={t.icon} />
            </button>
          ))}
          <span aria-hidden="true" className="yc-image-bar-sep" />
          <span className="yc-diagram-color">
            <button
              type="button"
              className="yc-tool"
              aria-label="Couleur de la forme"
              title="Couleur de la forme"
              aria-expanded={colorsOpen}
              disabled={selection?.type !== 'shape'}
              onClick={() => setColorsOpen((v) => !v)}
            >
              <Icon src={colorIcon} />
            </button>
            {colorsOpen && (
              <span role="menu" aria-label="Couleur de la forme" className="yc-diagram-swatches">
                {DIAGRAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="menuitem"
                    aria-label={COLOR_LABELS[c]}
                    title={COLOR_LABELS[c]}
                    className="yc-diagram-swatch"
                    style={{ background: fillVar(c), borderColor: strokeVar(c) }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </span>
            )}
          </span>
          {barEnd}
        </div>
      )}

      <svg
        ref={svgRef}
        className="yc-diagram-canvas"
        role="img"
        aria-label={`Schéma : ${shown.shapes.map((s) => s.text).filter(Boolean).join(', ') || 'vide'}`}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        data-tool={tool}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M1 1 L9 5 L1 9" fill="none" stroke="var(--note-ink-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        <rect className="yc-diagram-bg" x={view.x - view.w} y={view.y - view.h} width={view.w * 3} height={view.h * 3} fill="transparent" onPointerDown={onBackgroundDown} />

        {shown.arrows.map((a) => {
          const line = arrowLine(shown, a)
          if (!line) return null
          const picked = selection?.type === 'arrow' && selection.id === a.id
          const p = labelPoint(line)
          return (
            <g key={a.id} data-arrow={a.id}>
              <line {...line} className="yc-diagram-arrow" stroke={picked ? 'var(--note-accent)' : 'var(--note-ink-muted)'} strokeWidth={2} markerEnd={`url(#${markerId})`} />
              {/* A wider invisible line: an arrow is easy to pick. */}
              <line
                {...line}
                stroke="transparent"
                strokeWidth={14}
                onPointerDown={(e) => {
                  if (!editable || tool !== 'select') return
                  e.stopPropagation()
                  setSelection({ type: 'arrow', id: a.id })
                  setEditing(null)
                }}
                onDoubleClick={() => editable && setEditing({ type: 'arrow', id: a.id })}
              />
              {a.label && editing?.id !== a.id && (
                <text x={p.x} y={p.y} fontSize={ARROW_LABEL_SIZE} fontWeight={500} fill="var(--note-ink-muted)" textAnchor="middle" dominantBaseline="central">
                  {a.label}
                </text>
              )}
            </g>
          )
        })}

        {shown.shapes.map((s) => {
          const picked = selection?.type === 'shape' && selection.id === s.id
          return (
            <g
              key={s.id}
              data-shape={s.id}
              data-kind={s.kind}
              className="yc-diagram-shape"
              onPointerDown={onShapeDown(s)}
              onPointerUp={onShapeUp(s)}
              onDoubleClick={() => editable && setEditing({ type: 'shape', id: s.id })}
            >
              <ShapeBody shape={s} />
              {editing?.id !== s.id && <Label shape={s} />}
              {(picked || arrowFrom === s.id) && (
                <rect x={s.x - 4} y={s.y - 4} width={s.w + 8} height={s.h + 8} rx={14} fill="none" stroke="var(--note-accent)" strokeWidth={2} strokeDasharray={arrowFrom === s.id ? '6 4' : undefined} />
              )}
            </g>
          )
        })}

        {fromShape && pointer && (
          <line x1={centerOf(fromShape).x} y1={centerOf(fromShape).y} x2={pointer.x} y2={pointer.y} stroke="var(--note-accent)" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />
        )}

        {editedShape && (
          <foreignObject x={editedShape.x} y={editedShape.y + editedShape.h / 2 - 18} width={Math.max(editedShape.w, 120)} height={36}>
            <TextField
              label="Texte de la forme"
              value={editedShape.text}
              onDone={(text) => {
                setText(editing, text)
                setEditing(null)
              }}
            />
          </foreignObject>
        )}
        {editedArrow && editedArrowLine && (
          <foreignObject x={labelPoint(editedArrowLine).x - 90} y={labelPoint(editedArrowLine).y - 18} width={180} height={36}>
            <TextField
              label="Texte de la flèche"
              value={editedArrow.label}
              onDone={(text) => {
                setText(editing, text)
                setEditing(null)
              }}
            />
          </foreignObject>
        )}
      </svg>

      {shown.shapes.length === 0 && editable && (
        <p className="yc-diagram-empty">Choisis une forme dans la barre, puis clique dans le schéma.</p>
      )}

      {editable ? (
        <button type="button" className="yc-diagram-zoom" title="Ajuster : tout voir" onClick={fit}>
          Ajuster · {Math.round(scale * 100)} %
        </button>
      ) : (
        // Read only (a phone's thumbnail is itself a button): the zoom is said, not offered.
        <span className="yc-diagram-zoom">Ajuster · {Math.round(scale * 100)} %</span>
      )}
    </div>
  )
}

/** The text of a shape or an arrow, typed in place: Entrée keeps it, Échap leaves it as it was. */
function TextField({ label, value, onDone }: { label: string; value: string; onDone: (text: string) => void }) {
  const [text, setText] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  // Once only: the field leaving the page blurs it, after Entrée or Échap already decided.
  const done = useRef(false)
  const finish = (result: string) => {
    if (done.current) return
    done.current = true
    onDone(result)
  }
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <input
      ref={ref}
      className="yc-diagram-input"
      aria-label={label}
      value={text}
      maxLength={MAX_TEXT}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => finish(text)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          e.preventDefault()
          finish(text)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          finish(value)
        }
      }}
    />
  )
}

/** The trash of the bar: the whole block goes, Ctrl+Z brings it back. */
export function DeleteDiagramButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button type="button" className="yc-tool" aria-label="Supprimer le schéma" title="Supprimer le schéma" onClick={onDelete}>
      <Icon src={closeIcon} />
    </button>
  )
}
