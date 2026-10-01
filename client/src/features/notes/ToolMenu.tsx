import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

/** Space kept between an open menu and the edge of the screen. */
const EDGE = 8

interface ToolMenuProps {
  /** Accessible name of the button, e.g. « Police : Lora ». */
  buttonLabel: string
  buttonClassName: string
  buttonContent: ReactNode
  /** Accessible name of the menu. */
  menuLabel: string
  menuClassName?: string
  /** Where the focus goes on opening; the checked item, else the first one. */
  initialFocus?: string
  /** In the formatting toolbar (one roving tab stop), or on its own (a normal tab stop). */
  inToolbar?: boolean
  /**
   * Placed on the screen rather than under its button (YC-47): a button in a scrolling bar would
   * have its menu cut by the bar. It closes when the page scrolls, not to float away from it.
   */
  floating?: boolean
  children: (close: () => void) => ReactNode
}

const ITEMS = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'

/**
 * A toolbar button that opens a menu (Figma « Menu de l'éditeur », 33:2774): opens under the
 * button, closes on Échap or a click outside with the focus back on the button (YC-41, YC-42).
 * Arrows, Home and End move between the items.
 */
export function ToolMenu({
  buttonLabel,
  buttonClassName,
  buttonContent,
  menuLabel,
  menuClassName = '',
  initialFocus,
  inToolbar = true,
  floating = false,
  children,
}: ToolMenuProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = (focusButton = false) => {
    setOpen(false)
    if (focusButton) buttonRef.current?.focus()
  }

  // Opened under its button, a menu near the right edge would leave the screen on a phone (the
  // whole page then scrolled sideways, measured at 390 px, YC-46): it moves left to stay in view.
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!open || !menu) return
    menu.style.left = ''
    if (floating && buttonRef.current) {
      const button = buttonRef.current.getBoundingClientRect()
      menu.style.position = 'fixed'
      menu.style.top = `${button.bottom + 4}px`
      menu.style.left = `${button.left}px`
    }
    const rect = menu.getBoundingClientRect()
    const limit = document.documentElement.clientWidth - EDGE
    if (rect.right <= limit) return
    const shift = Math.min(rect.right - limit, rect.left - EDGE)
    if (shift > 0) menu.style.left = `${(parseFloat(menu.style.left) || 0) - shift}px`
  }, [open, floating])

  useEffect(() => {
    if (!open || !floating) return
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [open, floating])

  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    const target =
      (initialFocus && menu?.querySelector<HTMLElement>(initialFocus)) ||
      menu?.querySelector<HTMLElement>('[aria-checked="true"]') ||
      menu?.querySelector<HTMLElement>(ITEMS)
    target?.focus()
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, initialFocus])

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])
    const index = items.indexOf(document.activeElement as HTMLElement)
    const move = (to: number) => items[(to + items.length) % items.length]?.focus()
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') move(index + 1)
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') move(index - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(items.length - 1)
    else if (e.key === 'Escape') close(true)
    else if (e.key === 'Tab') setOpen(false)
    else return
    if (e.key !== 'Tab') {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <div className="yc-menu-anchor">
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        data-tool={inToolbar ? '' : undefined}
        tabIndex={inToolbar ? -1 : 0}
        aria-label={buttonLabel}
        title={buttonLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        {buttonContent}
      </button>
      {open && (
        <div ref={menuRef} id={menuId} role="menu" aria-label={menuLabel} className={`yc-menu ${menuClassName}`} onKeyDown={onMenuKeyDown}>
          {children(() => close())}
        </div>
      )}
    </div>
  )
}
