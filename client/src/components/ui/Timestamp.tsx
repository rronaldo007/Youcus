import type { ButtonHTMLAttributes } from 'react'
import { formatTimestamp } from '@/lib/format'

/** The 22 px chip of Figma « Horodatage » 5:321: red signal, or sunken once the chapter is seen. */
export function TimestampChip({ seconds, passed = false, className = '' }: { seconds: number; passed?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-yc-sm px-[7px] py-[3px] font-mono text-[12px] font-bold leading-4 transition-colors ${
        passed ? 'bg-sunken text-content-muted' : 'bg-accent text-on-accent'
      } ${className}`}
    >
      {formatTimestamp(seconds)}
    </span>
  )
}

interface TimestampProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  seconds: number
  passed?: boolean
}

/**
 * A clickable timestamp: it plays the video from that instant. « Le repère visible fait 22 px ; la
 * zone cliquable, elle, s'étend à 44 px (padding invisible en code). »
 */
export function Timestamp({ seconds, passed = false, className = '', type = 'button', ...props }: TimestampProps) {
  return (
    <button
      type={type}
      aria-label={`Aller à ${formatTimestamp(seconds)}`}
      className={`group relative inline-flex align-middle before:absolute before:-inset-x-1 before:-inset-y-[11px] before:content-[''] focus-visible:outline-none ${className}`}
      {...props}
    >
      <TimestampChip
        seconds={seconds}
        passed={passed}
        className={`group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-focus ${
          passed ? '' : 'group-hover:bg-accent-hover'
        }`}
      />
    </button>
  )
}
