import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { tableAt, tableHasHeader } from '@/features/notes/noteTable'
import closeIcon from './icons/note/fermer.svg'
import plusIcon from './icons/note/plus.svg'

function Icon({ src, size = 24 }: { src: string; size?: number }) {
  return <span aria-hidden="true" className="yc-tool-icon" style={{ '--icon': `url("${src}")`, '--size': `${size}px` } as CSSProperties} />
}

/** A button of the bar: it acts on the table without taking the cursor out of its cell. */
function BarButton({ label, onRun, pressed, children, className = 'yc-image-bar-text' }: { label?: string; onRun: () => void; pressed?: boolean; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
    >
      {children}
    </button>
  )
}

/**
 * The bar of the table holding the cursor (YC-51), Figma « Bloc de note › Tableau » 65:2071:
 * + Ligne, + Colonne, En-tête, Trier, Supprimer above it, « Ajouter une ligne » under it. Drawn
 * over the page, in the room the table is given while it is active (class yc-table-active).
 */
export function NoteTableBar({ editor }: { editor: Editor }) {
  const table = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e || e.isDestroyed || !e.isEditable) return null
      const found = tableAt(e.state)
      if (!found) return null
      return { pos: found.pos, header: tableHasHeader(e.state), rows: found.node.childCount }
    },
  })
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  useLayoutEffect(() => {
    if (!table) return setBox(null)
    const dom = editor.view.nodeDOM(table.pos) as HTMLElement | null
    const page = dom?.closest('.yc-note-page')
    if (!dom || !page) return setBox(null)
    const measure = () => {
      const r = dom.getBoundingClientRect()
      const p = page.getBoundingClientRect()
      setBox({ top: r.top - p.top, left: r.left - p.left, width: r.width, height: r.height })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(dom)
    return () => observer.disconnect()
  }, [editor, table])

  if (!table || !box) return null
  const run = (command: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () => command(editor.chain().focus()).run()

  return (
    <>
      <div role="toolbar" aria-label="Tableau" className="yc-image-bar yc-table-bar" style={{ top: box.top - 56, left: box.left }}>
        <BarButton onRun={run((c) => c.addRowAfter())}>+ Ligne</BarButton>
        <BarButton onRun={run((c) => c.addColumnAfter())}>+ Colonne</BarButton>
        <span aria-hidden="true" className="yc-image-bar-sep" />
        <BarButton pressed={table.header} onRun={run((c) => c.toggleHeaderRow())}>
          En-tête
        </BarButton>
        <BarButton label="Trier par la colonne du curseur" onRun={run((c) => c.sortTableByColumn())}>
          Trier
        </BarButton>
        <BarButton label="Supprimer le tableau" className="yc-tool" onRun={run((c) => c.deleteTable())}>
          <Icon src={closeIcon} />
        </BarButton>
      </div>
      <button
        type="button"
        className="yc-table-add"
        style={{ top: box.top + box.height + 8, left: box.left, width: box.width }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={run((c) => c.appendTableRow())}
      >
        <Icon src={plusIcon} size={16} />
        Ajouter une ligne
      </button>
    </>
  )
}
