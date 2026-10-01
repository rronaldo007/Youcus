import { Extension, ReactRenderer } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionOptions, type SuggestionProps } from '@tiptap/suggestion'
import { SlashList, type ListHandle } from '@/features/notes/NoteSlashList'
import { searchSlashItems, type SlashActions, type SlashItem } from '@/features/notes/noteSlashItems'
import { HANDLED } from '@/features/notes/useModalDialog'

export type { SlashActions } from '@/features/notes/noteSlashItems'

type Middleware = NonNullable<NonNullable<SuggestionOptions['floatingUi']>['middleware']>[number]

/**
 * The list is 320 px wide and opens at the cursor: on a phone it would leave the screen on the
 * right (seen at 390 px). Kept 8 px inside, the way Floating UI's `shift` does, without a new
 * dependency.
 */
export const keepInScreen: Middleware = {
  name: 'keepInScreen',
  fn: ({ x, y, rects }) => {
    const room = document.documentElement.clientWidth - rects.floating.width - 8
    return { x: Math.max(8, Math.min(x, room)), y }
  },
}

/** Built with the screen's actions through a ref, read at the moment an item runs. */
export function noteSlashMenu(actions: { current: SlashActions }) {
  return Extension.create({
    name: 'noteSlashMenu',
    addProseMirrorPlugins() {
      const editor = this.editor
      return [
        Suggestion<SlashItem, SlashItem>({
          editor,
          pluginKey: new PluginKey('noteSlashMenu'),
          char: '/',
          startOfLine: true,
          allowSpaces: false,
          floatingUi: { middleware: [keepInScreen] },
          // Code keeps its slashes (comments, paths).
          allow: ({ editor: e }) => !e.isActive('codeBlock'),
          items: ({ query, editor: e }) => searchSlashItems(query, e),
          command: ({ editor: e, range, props }) => props.run(e, range, actions.current),
          render: () => {
            let renderer: ReactRenderer<ListHandle, SuggestionProps<SlashItem, SlashItem>> | null = null
            let unmount: (() => void) | undefined
            return {
              onStart: (props) => {
                renderer = new ReactRenderer(SlashList, { props, editor: props.editor })
                // Outside the note in the DOM, so it carries the note's colours itself.
                renderer.element.classList.add('yc-note')
                unmount = props.mount(renderer.element as HTMLElement)
              },
              onUpdate: (props) => renderer?.updateProps(props),
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  // The list takes this Échap: the expanded note around must not close too (YC-63).
                  Object.assign(props.event, { [HANDLED]: true })
                  return false
                }
                return renderer?.ref?.onKeyDown(props) ?? false
              },
              onExit: () => {
                unmount?.()
                renderer?.destroy()
                renderer = null
              },
            }
          },
        }),
      ]
    },
  })
}
