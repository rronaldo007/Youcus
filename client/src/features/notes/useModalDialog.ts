import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'

/** Set on a keydown by what used it inside the editor (the « : » list), where `defaultPrevented` says nothing. */
export const HANDLED = 'ycHandled'

const FOCUSABLE = 'button:not([disabled]), input, select, textarea, [href], [contenteditable="true"], [tabindex]:not([tabindex="-1"])'

/**
 * What a modal dialog of the editor needs (the phone sheet, YC-47; the expanded note, YC-18):
 * the page under it does not scroll, Échap closes it, and Tab stays inside. Échap already used
 * by something inside (a menu, the « : » list, the link field) does not close it.
 * Returns the keydown handler to put on the dialog.
 */
export function useModalDialog(active: boolean, ref: RefObject<HTMLElement>, onClose: () => void) {
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!active) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [active])

  return (e: KeyboardEvent<HTMLElement>) => {
    if (!active) return
    if (e.key === 'Escape') {
      // In the note's text, ProseMirror marks every Échap as handled (Chrome, keyCode 27, seen in
      // the proof): there only an explicit mark counts. Elsewhere, a field that used it says so,
      // including the fields of a block inside the note (contenteditable="false", YC-63).
      const inText = (e.target as HTMLElement).closest('[contenteditable]')?.getAttribute('contenteditable') === 'true'
      const used = (e.nativeEvent as unknown as Record<string, unknown>)[HANDLED] === true || (!inText && e.defaultPrevented)
      if (used || (e.target as HTMLElement).closest('[role="menu"]')) return
      e.stopPropagation()
      close.current()
      return
    }
    // Tab already used inside (the editor's indent, YC-57) does not move the focus.
    if (e.key !== 'Tab' || e.defaultPrevented) return
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => !el.closest('[role="menu"]'))
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}
