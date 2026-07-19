import { useTheme } from '@/features/theme/useTheme'

/** Bouton de bascule du thème clair/sombre. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
      title={isDark ? 'Thème clair' : 'Thème sombre'}
      className="flex size-9 items-center justify-center rounded-full text-lg text-content-muted transition hover:bg-surface-2"
    >
      {isDark ? '☀' : '☾'}
    </button>
  )
}
