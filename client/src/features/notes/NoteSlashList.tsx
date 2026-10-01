import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import { Icon } from '@/features/notes/FormattingToolbar'
import type { SlashItem } from '@/features/notes/noteSlashItems'

/** The « / » list (YC-64): arrows to move, Entrée or Tab to insert. */
export interface ListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

export const SlashList = forwardRef<ListHandle, SuggestionProps<SlashItem, SlashItem>>(function SlashList({ items, command }, ref) {
  const [selected, setSelected] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => setSelected(0), [items])
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [selected])
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false
      if (event.key === 'ArrowDown') setSelected((i) => (i + 1) % items.length)
      else if (event.key === 'ArrowUp') setSelected((i) => (i - 1 + items.length) % items.length)
      else if (event.key === 'Enter' || event.key === 'Tab') command(items[selected])
      else return false
      return true
    },
  }))
  if (!items.length) return null
  const option = (item: SlashItem) => {
    const i = items.indexOf(item)
    return (
      <div
        key={item.id}
        role="option"
        aria-selected={i === selected}
        className="yc-menu-item yc-insert-item yc-slash-item"
        onMouseDown={(e) => {
          e.preventDefault()
          command(item)
        }}
      >
        <Icon src={item.icon} />
        <span className="yc-insert-text">
          <span className="yc-menu-item-label yc-menu-item-medium">{item.label}</span>
          {item.hint && <span className="yc-insert-hint">{item.hint}</span>}
        </span>
      </div>
    )
  }
  const blocks = items.filter((i) => i.group === 'blocks')
  const bar = items.filter((i) => i.group === 'bar')
  return (
    <div ref={list} role="listbox" aria-label="Insérer un bloc" className="yc-menu yc-insert-menu yc-slash-menu">
      {blocks.length > 0 && (
        <p aria-hidden="true" className="yc-menu-label">
          BLOCS
        </p>
      )}
      {blocks.map(option)}
      {blocks.length > 0 && bar.length > 0 && <div aria-hidden="true" className="yc-menu-rule" />}
      {bar.length > 0 && (
        <p aria-hidden="true" className="yc-menu-label">
          AUSSI DANS LA BARRE
        </p>
      )}
      {bar.map(option)}
    </div>
  )
})
