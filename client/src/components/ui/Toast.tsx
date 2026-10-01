import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { TOAST_DELAY_MS, ToastContext, type Show, type ToastItem, type ToastTone } from '@/components/ui/toastContext'
import { Icon, type IconName } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'

export type { ToastTone }

const TONES: Record<ToastTone, { icon: IconName; iconClass: string; barClass: string }> = {
  success: { icon: 'check', iconClass: 'text-success', barClass: 'bg-success' },
  error: { icon: 'alert', iconClass: 'text-error', barClass: 'bg-accent' },
  info: { icon: 'clock', iconClass: 'text-content-muted', barClass: 'bg-line-strong' },
}

interface ToastProps {
  tone: ToastTone
  title: string
  /** One sentence that names what comes next. */
  text?: string
  onClose: () => void
}

/** Figma « Toast » 5:258: the feedback of an action that took place. */
export function Toast({ tone, title, text, onClose }: ToastProps) {
  const { icon, iconClass, barClass } = TONES[tone]
  const timed = tone !== 'error'
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-[380px] max-w-full flex-col overflow-hidden rounded-yc-lg border border-line bg-surface shadow-toast"
    >
      <div className="flex items-start gap-3 py-3 pl-4 pr-1">
        <span className={`pt-3 ${iconClass}`}>
          <Icon name={icon} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-2.5">
          <p className="text-label-14 font-semibold text-content">{title}</p>
          {text && <p className="text-small-13 font-medium text-content-muted">{text}</p>}
        </div>
        <IconButton icon="close" label="Fermer" onClick={onClose} />
      </div>
      <div className="h-[3px] w-full">
        <div
          data-testid="toast-delay"
          className={`h-full ${barClass} ${timed ? 'origin-left animate-yc-toast-delay motion-reduce:animate-none' : ''}`}
        />
      </div>
    </div>
  )
}



/** The toasts of the whole app, bottom right (bottom centre on a phone), newest last. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const next = useRef(0)
  const close = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), [])
  const show = useCallback<Show>((toast) => {
    next.current += 1
    const id = next.current
    setItems((all) => [...all, { ...toast, id }])
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-3 sm:inset-x-auto sm:right-6 sm:items-end">
        {items.map((t) => (
          <TimedToast key={t.id} item={t} close={close} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function TimedToast({ item, close }: { item: ToastItem; close: (id: number) => void }) {
  // Keyed on the toast alone: another toast arriving does not restart this one's delay.
  useEffect(() => {
    if (item.tone === 'error') return
    const timer = window.setTimeout(() => close(item.id), TOAST_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [item.id, item.tone, close])
  return <Toast tone={item.tone} title={item.title} text={item.text} onClose={() => close(item.id)} />
}
