import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { NodeViewContent, NodeViewWrapper, useEditorState, type ReactNodeViewProps } from '@tiptap/react'
import { Fragment } from '@tiptap/pm/model'
import { MAX_TAB_TITLE, MAX_TABS, cursorIntoTab, tabIndexAt } from '@/features/notes/noteTabs'
import plusIcon from './icons/note/plus.svg'

function Icon({ src, size = 18 }: { src: string; size?: number }) {
  return <span aria-hidden="true" className="yc-tool-icon" style={{ '--icon': `url("${src}")`, '--size': `${size}px` } as CSSProperties} />
}

/**
 * The tabs of a note (YC-52), Figma « Bloc de note › Onglets » (65:2126): a bar of titles, the
 * picked tab in front (accent rule on top), « + » for a new one. Clicking the tab already in
 * front edits it: rename, move left or right, delete. The tab shown follows the cursor, so the
 * arrow keys never write in a hidden tab.
 */
export function NoteTabsView({ node, getPos, editor }: ReactNodeViewProps) {
  const titles: string[] = []
  node.forEach((tab) => titles.push(String(tab.attrs.title)))
  const [active, setActive] = useState(0)
  // The tab whose name is being edited, by index: right after « + » the new tab is not in the
  // node yet, and deriving it from the tab in front opened the field on the wrong one.
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const id = useId()
  const barRef = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Round the block's height up to the ruling step, as the code block does: the text after it
  // falls on the lines.
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
  const editable = useEditorState({ editor, selector: ({ editor: e }) => e.isEditable }) ?? editor.isEditable
  const shown = Math.min(active, titles.length - 1)

  // The tab holding the cursor comes in front.
  const cursorTab = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const pos = typeof getPos === 'function' ? getPos() : undefined
      if (typeof pos !== 'number') return -1
      const current = e.state.doc.nodeAt(pos)
      return current ? tabIndexAt(current, pos, e.state.selection.from) : -1
    },
  })
  useEffect(() => {
    if (typeof cursorTab === 'number' && cursorTab >= 0) setActive(cursorTab)
  }, [cursorTab])

  const pos = () => (typeof getPos === 'function' ? getPos() : undefined)

  /** Brings a tab in front with the cursor in it: what is typed next goes where it is seen. */
  const pick = (index: number, focusText = true) => {
    const at = pos()
    setActive(index)
    setEditing(null)
    if (typeof at !== 'number') return
    editor.view.dispatch(cursorIntoTab(editor.state.tr, at, index).scrollIntoView())
    if (focusText) editor.view.focus()
  }

  /** Rebuilds the block from `tabs` (same tab nodes, new order or titles), one undo step. */
  const replaceTabs = (build: (tabs: ReturnType<typeof node.child>[]) => ReturnType<typeof node.child>[], focusIndex: number) => {
    const at = pos()
    if (typeof at !== 'number') return
    const current = editor.state.doc.nodeAt(at)
    if (!current) return
    const tabs: ReturnType<typeof node.child>[] = []
    current.forEach((tab) => tabs.push(tab))
    const next = build(tabs)
    const tr = editor.state.tr
    if (next.length === 0) {
      tr.delete(at, at + current.nodeSize)
      editor.view.dispatch(tr)
      editor.view.focus()
      return
    }
    tr.replaceWith(at + 1, at + current.nodeSize - 1, Fragment.fromArray(next))
    setActive(focusIndex)
    editor.view.dispatch(cursorIntoTab(tr, at, focusIndex))
  }

  const add = () => {
    if (titles.length >= MAX_TABS) return
    const { schema } = editor.state
    const index = titles.length
    replaceTabs((tabs) => [...tabs, schema.nodes.noteTab.create({ title: `Onglet ${index + 1}` }, schema.nodes.paragraph.create())], index)
    setDraft(`Onglet ${index + 1}`)
    setEditing(index)
  }

  const rename = (index: number, title: string) => {
    const clean = title.trim().slice(0, MAX_TAB_TITLE)
    setEditing(null)
    if (clean && clean !== titles[index]) {
      replaceTabs((tabs) => tabs.map((tab, i) => (i === index ? tab.type.create({ ...tab.attrs, title: clean }, tab.content) : tab)), index)
    }
    // Named: the writing goes on in that tab.
    editor.view.focus()
  }

  const move = (index: number, delta: -1 | 1) => {
    const to = index + delta
    if (to < 0 || to >= titles.length) return
    setEditing(null)
    replaceTabs((tabs) => {
      const next = [...tabs]
      ;[next[index], next[to]] = [next[to], next[index]]
      return next
    }, to)
  }

  const remove = (index: number) => {
    setEditing(null)
    replaceTabs((tabs) => tabs.filter((_, i) => i !== index), Math.max(0, index - 1))
  }

  // Arrow keys move between the tabs of the bar, as a tab list does.
  const onBarKeyDown = (e: KeyboardEvent) => {
    if (editing !== null) return
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (shown + (e.key === 'ArrowRight' ? 1 : -1) + titles.length) % titles.length
    // The cursor goes with it, the focus stays on the bar: Tab then enters the page.
    pick(next, false)
    requestAnimationFrame(() => barRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus())
  }

  return (
    <NodeViewWrapper ref={ref} className="yc-tabs" data-tabs-id={id}>
      {/* Only the tab in front is shown; the others stay in the note, out of sight. */}
      <style>{`[data-tabs-id="${id}"] > .yc-tabs-panels [data-note-tab]:nth-child(${shown + 1}) { display: block; }`}</style>
      <div ref={barRef} role="tablist" aria-label="Onglets de la note" className="yc-tabs-bar" contentEditable={false} onKeyDown={onBarKeyDown}>
        {titles.map((title, i) =>
          editing === i && editable ? (
            <span key={i} className="yc-tab-edit">
              <input
                autoFocus
                value={draft}
                maxLength={MAX_TAB_TITLE}
                aria-label="Nom de l'onglet"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    rename(i, draft)
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setEditing(null)
                    editor.view.focus()
                  }
                }}
              />
              <button type="button" aria-label="Déplacer l'onglet à gauche" title="Déplacer à gauche" disabled={i === 0} onMouseDown={(e) => e.preventDefault()} onClick={() => move(i, -1)}>
                ←
              </button>
              <button type="button" aria-label="Déplacer l'onglet à droite" title="Déplacer à droite" disabled={i === titles.length - 1} onMouseDown={(e) => e.preventDefault()} onClick={() => move(i, 1)}>
                →
              </button>
              <button type="button" className="yc-tab-delete" onMouseDown={(e) => e.preventDefault()} onClick={() => remove(i)}>
                Supprimer
              </button>
              <button type="button" className="yc-tab-ok" onMouseDown={(e) => e.preventDefault()} onClick={() => rename(i, draft)}>
                OK
              </button>
            </span>
          ) : (
            <button
              key={i}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={i === shown}
              tabIndex={i === shown ? 0 : -1}
              className="yc-tab"
              title={editable && i === shown ? 'Cliquer pour renommer, déplacer ou supprimer' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (i === shown && editable) {
                  setDraft(title)
                  setEditing(i)
                } else pick(i)
              }}
            >
              {title}
            </button>
          ),
        )}
        {editable && titles.length < MAX_TABS && (
          <button type="button" className="yc-tab-add" aria-label="Ajouter un onglet" title="Ajouter un onglet" onMouseDown={(e) => e.preventDefault()} onClick={add}>
            <Icon src={plusIcon} />
          </button>
        )}
      </div>
      <NodeViewContent className="yc-tabs-panels" aria-labelledby={`${id}-tab-${shown}`} />
    </NodeViewWrapper>
  )
}

