import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

/** « La barre du bas montre le délai (5 s, jamais pour une erreur : une erreur reste jusqu'à fermeture). » */
export const TOAST_DELAY_MS = 5000

export interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  text?: string
}

export type Show = (toast: Omit<ToastItem, 'id'>) => void
export const ToastContext = createContext<Show | null>(null)

/** `const toast = useToast(); toast({ tone: 'success', title: 'Playlist importée', text: '…' })`. */
export function useToast(): Show {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside <ToastProvider>')
  return show
}
