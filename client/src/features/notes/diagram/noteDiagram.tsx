import { useEffect, useRef, useState } from 'react'
import { Node, NodeViewWrapper, ReactNodeViewRenderer, useEditorState, type ReactNodeViewProps } from '@tiptap/react'
import { DiagramCanvas, DeleteDiagramButton } from '@/features/notes/diagram/DiagramCanvas'
import { EMPTY_SCENE, readScene, type Scene } from '@/features/notes/diagram/scene'
import { usePhone } from '@/features/notes/usePhone'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteDiagram: {
      /** An empty diagram at the cursor. */
      insertNoteDiagram: () => ReturnType
    }
  }
}

const CANVAS_HEIGHT = 400
const THUMB_HEIGHT = 200

/**
 * A diagram block (YC-53), Figma « Bloc de note › Schéma » 65:2143. On a computer the drawing is
 * edited in place; on a phone it shows as a thumbnail and a touch opens it full screen (YC-20); in
 * « Aperçu » it is a picture. The block is padded to the ruling like the others.
 */
function NoteDiagramView({ node, updateAttributes, deleteNode, editor }: ReactNodeViewProps) {
  const scene = readScene(node.attrs.scene)
  const editable = useEditorState({ editor, selector: ({ editor: e }) => e.isEditable }) ?? editor.isEditable
  const phone = usePhone()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const onChange = editable ? (next: Scene) => updateAttributes({ scene: next }) : null

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

  // Échap closes the full screen.
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const remove = <DeleteDiagramButton onDelete={() => deleteNode()} />

  return (
    <NodeViewWrapper ref={ref} className="yc-diagram-block" data-note-diagram="" contentEditable={false}>
      {phone ? (
        <>
          <button type="button" className="yc-diagram-thumb" aria-label="Agrandir le schéma" onClick={() => setOpen(true)}>
            <DiagramCanvas scene={scene} onChange={null} height={THUMB_HEIGHT} />
          </button>
          {open && (
            <div role="dialog" aria-modal="true" aria-label="Schéma" className="yc-diagram-full">
              <DiagramCanvas
                scene={scene}
                onChange={onChange}
                height={Math.max(320, window.innerHeight - 24)}
                barEnd={
                  <button type="button" className="yc-image-bar-text" onClick={() => setOpen(false)}>
                    Fermer
                  </button>
                }
              />
            </div>
          )}
        </>
      ) : (
        <DiagramCanvas scene={scene} onChange={onChange} height={CANVAS_HEIGHT} barEnd={remove} />
      )}
    </NodeViewWrapper>
  )
}

/** Inside the drawing, ProseMirror gets no key nor pointer: Suppr deletes a shape, not the block. */
const inDrawing = (event: Event) => {
  const target = event.target as Element | null
  return !!target?.closest?.('.yc-diagram, .yc-diagram-full')
}

export const NoteDiagram = Node.create({
  name: 'noteDiagram',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      scene: {
        default: EMPTY_SCENE,
        parseHTML: (el) => {
          try {
            return readScene(JSON.parse(el.getAttribute('data-scene') ?? ''))
          } catch {
            return EMPTY_SCENE
          }
        },
        renderHTML: (a) => ({ 'data-scene': JSON.stringify(a.scene) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-note-diagram]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-note-diagram': '' }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteDiagramView, { stopEvent: ({ event }) => inDrawing(event) })
  },

  addCommands() {
    return {
      insertNoteDiagram:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { scene: EMPTY_SCENE } }),
    }
  },
})
