import CodeBlockLowlight, { type CodeBlockLowlightOptions } from '@tiptap/extension-code-block-lowlight'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'
import { CodeBlockView } from '@/features/notes/CodeBlockView'
import { CODE_LANGUAGES, lowlight } from '@/features/notes/codeLanguages'

const KNOWN = new Set(CODE_LANGUAGES.map((l) => l.id).filter(Boolean))

/**
 * Code block of a note (YC-44): coloured by lowlight, Tab indents inside the block, and Échap then
 * Tab leaves it, so the keyboard is never trapped (Figma 36:592). A language the list does not
 * know is kept as plain text, as the server would refuse it.
 */
export const NoteCodeBlock = CodeBlockLowlight.extend<CodeBlockLowlightOptions, { escaped: boolean }>({
  addStorage() {
    return { escaped: false }
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const cls = [...(el.firstElementChild?.classList ?? [])].find((c) => c.startsWith('language-'))
          const id = cls?.replace('language-', '') ?? null
          return id && KNOWN.has(id) ? id : null
        },
        rendered: false,
      },
      lineNumbers: {
        default: true,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-line-numbers') !== 'false',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-line-numbers': attrs.lineNumbers === false ? 'false' : 'true' }),
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },

  addKeyboardShortcuts() {
    const parent = this.parent?.() ?? {}
    return {
      ...parent,
      Tab: (props) => {
        // After Échap, Tab goes back to the browser: the focus leaves the note.
        if (this.storage.escaped) {
          this.storage.escaped = false
          return false
        }
        return parent.Tab ? parent.Tab(props) : false
      },
    }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    const type = this.type
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        // The ``` input rule takes any word as a language (« ```rust »): the server would refuse
        // the note and every save would fail. Anything off the list becomes plain text.
        appendTransaction(transactions, _old, state) {
          if (!transactions.some((tr) => tr.docChanged)) return null
          const tr = state.tr
          state.doc.descendants((node, pos) => {
            if (node.type === type && node.attrs.language && !KNOWN.has(node.attrs.language)) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, language: null })
            }
          })
          return tr.docChanged ? tr : null
        },
        props: {
          handleKeyDown(view, event) {
            if (event.key === 'Escape') storage.escaped = view.state.selection.$from.parent.type === type
            else if (event.key !== 'Tab' && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) storage.escaped = false
            return false
          },
        },
      }),
    ]
  },
}).configure({ lowlight, defaultLanguage: null, enableTabIndentation: true, tabSize: 2 })
