import { IconButton } from '@/components/ui/IconButton'
import { useTheme } from '@/features/theme/useTheme'

/** Bouton de bascule du thème clair/sombre, dans la barre : la lune en clair, le soleil en sombre. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return <IconButton icon={isDark ? 'sun' : 'moon'} label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'} onClick={toggle} />
}
