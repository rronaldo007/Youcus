import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { CARD_ACTIONS_CLASS } from '@/components/ui/PlaylistCard'

export type CardMenuItem = { label: string; danger?: boolean } & ({ to: string; onSelect?: never } | { onSelect: () => void; to?: never })

const ITEM_CLASS = 'flex min-h-touch w-full items-center rounded-yc-sm px-3 text-left text-body-15 hover:bg-sunken'

/**
 * The « Actions » button of a card (Figma « Carte de playlist » 5:395): « toujours visible, jamais au
 * seul survol ». It opens a short list; Échap or a click outside closes it and the focus goes back.
 */
export function CardMenu({ label, items }: { label: string; items: CardMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex size-11 items-center justify-center rounded-full text-content transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${CARD_ACTIONS_CLASS}`}
      >
        <Icon name="menu" size={20} />
      </button>
      {open && (
        <div id={panelId} className="absolute right-0 top-full z-20 mt-1 flex w-48 flex-col rounded-card border border-line bg-surface p-1 shadow-toast">
          {items.map((item) =>
            item.to !== undefined ? (
              <Link key={item.label} to={item.to} className={`${ITEM_CLASS} text-content`}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                className={`${ITEM_CLASS} ${item.danger ? 'text-error' : 'text-content'}`}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
