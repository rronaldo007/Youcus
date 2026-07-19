import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-purple text-white hover:bg-brand-purple-dark',
  secondary: 'border border-line bg-surface text-content hover:bg-surface-2',
  ghost: 'text-content-muted hover:bg-surface-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

/** Bouton du design system Youcus (variantes Primary / Secondary / Ghost, cf. Figma 25:9). */
export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-lg px-[18px] py-[11px] text-sm font-semibold transition disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
