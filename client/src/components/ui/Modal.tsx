import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { useModalDialog } from '@/features/notes/useModalDialog'

interface ModalProps {
  /** The question (« Supprimer « Backend » ? »). */
  title: string
  /** The consequence, said plainly. */
  children: ReactNode
  /** Names the action (« Supprimer définitivement »), never « OK ». */
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  /** A destructive action takes the Danger button. */
  destructive?: boolean
  confirmDisabled?: boolean
  cancelLabel?: string
}

/**
 * Figma « Modale » 5:305: a question, a consequence, two choices. Fermer 44 × 44; Échap closes;
 * the focus stays inside and goes back to what opened it on close.
 */
export function Modal({ title, children, confirmLabel, onConfirm, onClose, destructive = false, confirmDisabled, cancelLabel = 'Annuler' }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const textId = useId()
  const onKeyDown = useModalDialog(true, ref, onClose)

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    // The safe choice first: Entrée on open never confirms a destructive action.
    ref.current?.querySelector<HTMLElement>('[data-modal-cancel]')?.focus()
    return () => trigger?.focus()
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgb(23_20_15/0.4)] p-4">
      <div
        ref={ref}
        role={destructive ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        onKeyDown={onKeyDown}
        className="flex w-[520px] max-w-full flex-col gap-6 rounded-yc-xl border border-line bg-surface p-6 shadow-modal sm:p-8"
      >
        <div className="flex items-start gap-4">
          <h2 id={titleId} className="min-w-0 flex-1 font-serif text-title-34 text-content">
            {title}
          </h2>
          <IconButton icon="close" label="Fermer" onClick={onClose} />
        </div>
        <div id={textId} className="text-body-16 text-content-muted">
          {children}
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose} data-modal-cancel>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
