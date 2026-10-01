import type { ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'

export type IconButtonVariant = 'solid' | 'outline' | 'ghost'

/** Figma « Bouton-icône » 5:140: Plein (red signal), Contour (hairline), Fantôme. */
const VARIANTS: Record<IconButtonVariant, string> = {
  solid: 'bg-accent text-on-accent hover:bg-accent-hover focus-visible:outline-line-strong',
  outline: 'border border-line text-content hover:bg-sunken focus-visible:outline-focus',
  ghost: 'text-content hover:bg-sunken focus-visible:outline-focus',
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  icon: IconName
  /** « Toujours un nom accessible : la propriété Nom accessible devient aria-label. » */
  label: string
  variant?: IconButtonVariant
}

/** A 44 × 44 button (the minimum target) with a 20 px icon and nothing else. */
export function IconButton({ icon, label, variant = 'ghost', className = '', type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:opacity-45 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      <Icon name={icon} />
    </button>
  )
}
