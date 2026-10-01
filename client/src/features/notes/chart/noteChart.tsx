import { useEffect, useRef, useState } from 'react'
import { Node, NodeViewWrapper, ReactNodeViewRenderer, useEditorState, type ReactNodeViewProps } from '@tiptap/react'
import {
  CHART_KIND_LABELS,
  CHART_KINDS,
  MAX_LABEL,
  MAX_ROWS,
  MAX_TITLE,
  NEW_CHART,
  TOKEN_PALETTE,
  chartHeight,
  chartMarkup,
  chartWords,
  formatValue,
  parseValue,
  readChart,
  type Chart,
} from '@/features/notes/chart/chart'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteChart: {
      /** A new chart at the cursor, its data editor open. */
      insertNoteChart: () => ReturnType
    }
  }
}

type Draft = { title: string; rows: { label: string; value: string }[] }
const draftOf = (chart: Chart): Draft => ({
  title: chart.title,
  rows: chart.rows.map((r) => ({ label: r.label, value: r.value === null ? '' : formatValue(r.value) })),
})

/**
 * « Modifier les données » (YC-54): the small table behind the chart. What is typed stays here, the
 * truth while the panel is open: the node comes back after the transaction, and a field fed by it
 * would lose the letters typed in between. Every change that reads sends the chart.
 */
type ChartDataProps = {
  chart: Chart
  /** The title and rows typed; the block puts them on its latest chart (the kind may have changed). */
  onChange: (data: Pick<Chart, 'title' | 'rows'>) => void
  onDone: () => void
  onDelete: () => void
}

function ChartData({ chart, onChange, onDone, onDelete }: ChartDataProps) {
  const [draft, setDraft] = useState(() => draftOf(chart))
  const first = useRef<HTMLInputElement>(null)
  const invalid = draft.rows.map((r) => parseValue(r.value) === undefined)

  // The title takes the focus, after the bar that inserted the block gave it back to the text
  // (TipTap's focus waits a frame).
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => first.current?.focus())
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const change = (next: Draft) => {
    setDraft(next)
    const values = next.rows.map((r) => parseValue(r.value))
    if (values.some((v) => v === undefined)) return
    onChange({ title: next.title, rows: next.rows.map((r, i) => ({ label: r.label, value: values[i] as number | null })) })
  }
  const setRow = (i: number, row: Partial<Draft['rows'][number]>) => change({ ...draft, rows: draft.rows.map((r, j) => (j === i ? { ...r, ...row } : r)) })

  return (
    <div
      role="group"
      aria-label="Données du graphique"
      className="yc-chart-data"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          // Échap closes the table, not the expanded note around it (useModalDialog).
          e.preventDefault()
          e.stopPropagation()
          onDone()
        }
      }}
    >
      <label className="yc-chart-field">
        <span>Titre</span>
        <input ref={first} value={draft.title} maxLength={MAX_TITLE} placeholder="Temps d’étude par jour (min)" onChange={(e) => change({ ...draft, title: e.target.value })} />
      </label>
      <table className="yc-chart-table">
        <thead>
          <tr>
            <th scope="col">Libellé</th>
            <th scope="col">Valeur</th>
            <th scope="col">
              <span className="sr-only">Retirer</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {draft.rows.map((r, i) => (
            <tr key={i}>
              <td>
                <input aria-label={`Libellé, ligne ${i + 1}`} value={r.label} maxLength={MAX_LABEL} onChange={(e) => setRow(i, { label: e.target.value })} />
              </td>
              <td>
                <input
                  aria-label={`Valeur, ligne ${i + 1}`}
                  inputMode="decimal"
                  value={r.value}
                  aria-invalid={invalid[i] || undefined}
                  onChange={(e) => setRow(i, { value: e.target.value })}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="yc-chart-remove"
                  aria-label={`Retirer la ligne ${i + 1}`}
                  disabled={draft.rows.length === 1}
                  onClick={() => change({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {invalid.some(Boolean) && (
        <p role="alert" className="yc-chart-error">
          Une valeur est un nombre positif, « 12,5 » par exemple. Le graphique attend qu’elle le soit.
        </p>
      )}
      <div className="yc-chart-actions">
        <button
          type="button"
          className="yc-image-bar-text"
          disabled={draft.rows.length >= MAX_ROWS}
          onClick={() => change({ ...draft, rows: [...draft.rows, { label: '', value: '' }] })}
        >
          + Ajouter une ligne
        </button>
        <button type="button" className="yc-image-bar-text" onClick={onDelete}>
          Supprimer le graphique
        </button>
        <button type="button" className="yc-image-bar-text yc-chart-done" onClick={onDone}>
          Terminé
        </button>
      </div>
    </div>
  )
}

/**
 * A chart block (YC-54), Figma « Bloc de note › Graphique » 65:2230: its title, the kind picked in a
 * segment, the drawing, and « Modifier les données ». In « Aperçu » only the title and the drawing
 * stay. The block is padded to the ruling like the others.
 */
function NoteChartView({ node, updateAttributes, deleteNode, editor }: ReactNodeViewProps) {
  const chart = readChart(node.attrs.chart)
  const editable = useEditorState({ editor, selector: ({ editor: e }) => e.isEditable }) ?? editor.isEditable
  const ref = useRef<HTMLDivElement>(null)
  const plot = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  // A new chart has no value yet: its table opens at once.
  const [open, setOpen] = useState(() => chart.rows.every((r) => r.value === null))

  // Every change starts from the last chart sent, not the last one drawn (YC-53: the node view
  // gets the node after the transaction).
  const latest = useRef({ prop: node.attrs.chart as unknown, value: chart })
  if (latest.current.prop !== node.attrs.chart) latest.current = { prop: node.attrs.chart, value: chart }
  const commit = (next: Chart) => {
    latest.current.value = next
    updateAttributes({ chart: next })
  }

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const step = parseFloat(getComputedStyle(el).getPropertyValue('--note-step')) || 32
      el.style.marginBottom = '0px'
      const h = el.getBoundingClientRect().height
      el.style.marginBottom = `${Math.ceil(h / step) * step - h}px`
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The drawing is laid out at the width of the block (bars, labels, legend under a small pie).
  useEffect(() => {
    const el = plot.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => el.clientWidth > 0 && setWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const height = chartHeight(chart, width)
  const words = chartWords(chart)

  return (
    <NodeViewWrapper ref={ref} className="yc-chart-block" data-note-chart="" contentEditable={false}>
      <div className="yc-chart">
        <div className="yc-chart-head">
          <p className="yc-chart-title" data-empty={chart.title ? undefined : ''}>
            {chart.title || 'Graphique sans titre'}
          </p>
          {editable && (
            <div role="group" aria-label="Type de graphique" className="yc-x-segment yc-chart-kind">
              {CHART_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={chart.kind === kind}
                  onClick={() => commit({ ...latest.current.value, kind })}
                >
                  {CHART_KIND_LABELS[kind]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div ref={plot} className="yc-chart-plot">
          <svg
            role="img"
            aria-label={`Graphique, ${CHART_KIND_LABELS[chart.kind].toLowerCase()} : ${words}`}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            // Built by chartMarkup, every text escaped: the same drawing as the export.
            dangerouslySetInnerHTML={{ __html: chartMarkup(chart, width, TOKEN_PALETTE) }}
          />
        </div>
        {editable && (
          <div className="yc-chart-foot">
            <p>Données : un petit tableau lié au graphique.</p>
            <button type="button" className="yc-chart-edit" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              Modifier les données
            </button>
          </div>
        )}
        {editable && open && (
          <ChartData chart={latest.current.value} onChange={(data) => commit({ ...latest.current.value, ...data })} onDone={() => setOpen(false)} onDelete={() => deleteNode()} />
        )}
      </div>
    </NodeViewWrapper>
  )
}

/** Inside the chart, ProseMirror gets no key nor pointer: typing a value types in its field. */
const inChart = (event: Event) => {
  const target = event.target as Element | null
  return !!target?.closest?.('.yc-chart')
}

export const NoteChart = Node.create({
  name: 'noteChart',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      chart: {
        default: NEW_CHART,
        parseHTML: (el) => {
          try {
            return readChart(JSON.parse(el.getAttribute('data-chart') ?? ''))
          } catch {
            return NEW_CHART
          }
        },
        renderHTML: (a) => ({ 'data-chart': JSON.stringify(a.chart) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-note-chart]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-note-chart': '' }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteChartView, { stopEvent: ({ event }) => inChart(event) })
  },

  addCommands() {
    return {
      insertNoteChart:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { chart: NEW_CHART } }),
    }
  },
})
