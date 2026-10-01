import { useEffect, useId, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { ThemeChoice } from '@/components/ui/ThemeChoice'
import { AccountIdentity, AccountLinks } from '@/components/layout/AccountLinks'
import type { User } from '@/types'

/**
 * Figma « Menu du compte » 108:142, opened by the avatar of the bar. Échap or a click outside
 * closes it, and the focus goes back to the avatar. « Administration » is not built (out of the
 * sprint): it will only show for a role with an admin permission.
 */
export function AccountMenu({ user }: { user: User }) {
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
        onClick={() => setOpen((o) => !o)}
        aria-label={`Compte de ${user.displayName}`}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Avatar user={user} />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-30 mt-2 flex w-[280px] max-w-[calc(100vw-16px)] flex-col gap-1 rounded-card border border-line bg-surface p-2 shadow-[0_8px_24px_rgb(23_20_15/0.12)]"
        >
          <AccountIdentity user={user} />
          <div aria-hidden="true" className="h-px w-full bg-line" />
          <ThemeChoice />
          <AccountLinks onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
