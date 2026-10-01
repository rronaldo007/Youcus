import type { ButtonHTMLAttributes } from 'react'
import { buttonClass, type ButtonVariant } from '@/components/ui/buttonStyles'
import { Icon, type IconName } from '@/components/ui/Icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** An icon after the label (Figma « Icône visible »). */
  icon?: IconName
}

/**
 * Bouton du design system. « Primaire = l'action principale de l'écran, une seule. Danger pour une
 * action destructive, toujours suivie d'une confirmation. »
 */
export function Button({ variant = 'primary', icon, className = '', type = 'button', children, ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, className)} {...props}>
      {children}
      {icon && <Icon name={icon} size={24} />}
    </button>
  )
}
