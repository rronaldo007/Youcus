import { Node, ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { NoteImageView } from '@/features/notes/NoteImageView'
import { noteImageUrl } from '@/features/notes/noteImageUpload'

export const IMAGE_ALIGNS = ['left', 'center', 'full'] as const
export type ImageAlign = (typeof IMAGE_ALIGNS)[number]

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteImage: {
      /** Puts an image stored under `id` at `at`, or at the cursor. */
      insertNoteImage: (attrs: { id: string }, at?: number | null) => ReturnType
    }
  }
}

export interface NoteImageOptions {
  /** Images pasted or dropped into the note, with where they were dropped; read at the time. */
  onFiles: { current: (files: File[], at: number | null) => void }
}

const imagesOf = (files: FileList | null | undefined) => [...(files ?? [])].filter((f) => f.type.startsWith('image/'))

/**
 * An image block (YC-50), Figma « Bloc de note › Image » (65:2007). The node keeps the id of a
 * stored image, never its address: the address is derived (/api/note-images/:id), so a note
 * cannot point anywhere else. Same attributes as server/src/lib/noteDoc.ts.
 */
export const NoteImage = Node.create<NoteImageOptions>({
  name: 'noteImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { onFiles: { current: () => {} } }
  },

  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute('data-id'), renderHTML: (a) => ({ 'data-id': a.id }) },
      alt: { default: null, parseHTML: (el) => el.querySelector('img')?.getAttribute('alt') || null, rendered: false },
      caption: { default: null, parseHTML: (el) => el.querySelector('figcaption')?.textContent || null, rendered: false },
      align: {
        default: 'center',
        parseHTML: (el) => {
          const align = el.getAttribute('data-align')
          return (IMAGE_ALIGNS as readonly string[]).includes(align ?? '') ? align : 'center'
        },
        renderHTML: (a) => ({ 'data-align': a.align }),
      },
      width: {
        default: null,
        parseHTML: (el) => {
          const width = Number(el.getAttribute('data-width'))
          return Number.isInteger(width) && width >= 20 && width <= 100 ? width : null
        },
        renderHTML: (a) => (a.width ? { 'data-width': a.width } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-note-image]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const { id, alt, caption } = node.attrs as { id: string | null; alt: string | null; caption: string | null }
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { 'data-note-image': '' }),
      ['img', { src: id ? noteImageUrl(id) : '', alt: alt ?? '' }],
      ...(caption ? [['figcaption', {}, caption]] : []),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteImageView)
  },

  addCommands() {
    return {
      insertNoteImage:
        (attrs, at) =>
        ({ commands }) => {
          const content = { type: this.name, attrs: { id: attrs.id } }
          return typeof at === 'number' ? commands.insertContentAt(at, content) : commands.insertContent(content)
        },
    }
  },

  addProseMirrorPlugins() {
    const { onFiles } = this.options
    return [
      new Plugin({
        key: new PluginKey('noteImageFiles'),
        props: {
          // Files pasted or dropped become image blocks; anything else is left to the editor.
          handlePaste(_view, event) {
            const files = imagesOf(event.clipboardData?.files)
            if (!files.length) return false
            event.preventDefault()
            onFiles.current(files, null)
            return true
          },
          handleDrop(view, event) {
            const files = imagesOf(event.dataTransfer?.files)
            if (!files.length) return false
            event.preventDefault()
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null
            onFiles.current(files, at)
            return true
          },
        },
      }),
    ]
  },
})
