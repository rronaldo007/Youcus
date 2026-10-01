export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

/**
 * Figma « Bouton » 5:117: Primaire is ink and turns to the red signal on hover, Secondaire is an ink
 * outline, Fantôme has no frame, Danger is the red signal. Focus is a 2 px line inside the pill.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-inverse text-content-inverse hover:bg-accent hover:text-on-accent focus-visible:outline-focus',
  secondary: 'border border-line-strong text-content hover:bg-surface focus-visible:outline-focus',
  ghost: 'text-content hover:bg-sunken focus-visible:outline-focus',
  danger: 'bg-accent text-on-accent hover:bg-accent-hover focus-visible:outline-line-strong',
}

/** The shape every button of the design shares: a 44 px pill, 24 px sides, label 15 semibold. */
export const BUTTON_BASE =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-[15px] font-semibold leading-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:opacity-45'

export function buttonClass(variant: ButtonVariant = 'primary', className = '') {
  return `${BUTTON_BASE} ${VARIANTS[variant]} ${className}`
}
