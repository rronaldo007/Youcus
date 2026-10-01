import type { ButtonHTMLAttributes } from 'react'
import { TimestampChip } from '@/components/ui/Timestamp'

export type ChapterState = 'todo' | 'current' | 'seen'

interface ChapterRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  seconds: number
  title: string
  state?: ChapterState
}

/**
 * Figma « Ligne de chapitre » 5:337: 44 px minimum, clickable as a whole. En cours = sunken
 * background and « ● en cours »; Vu = passed timestamp and « ✓ vu ».
 */
export function ChapterRow({ seconds, title, state = 'todo', className = '', type = 'button', ...props }: ChapterRowProps) {
  return (
    <button
      type={type}
      aria-current={state === 'current' ? 'step' : undefined}
      className={`flex min-h-11 w-full items-center gap-3 rounded-yc-md py-1.5 pl-2.5 pr-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
        state === 'current' ? 'bg-sunken' : 'hover:bg-sunken'
      } ${className}`}
      {...props}
    >
      <TimestampChip seconds={seconds} passed={state === 'seen'} />
      <span
        className={`min-w-0 flex-1 ${
          state === 'current'
            ? 'text-label-14 font-semibold text-content'
            : `text-body-15 ${state === 'seen' ? 'text-content-muted' : 'text-content'}`
        }`}
      >
        {title}
      </span>
      {state === 'current' && <span className="shrink-0 font-mono text-mono-12 text-accent-text">● en cours</span>}
      {state === 'seen' && <span className="shrink-0 font-mono text-mono-12 text-content-muted">✓ vu</span>}
    </button>
  )
}
