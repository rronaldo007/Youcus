import { Icon } from '@/components/ui/Icon'
import { useTheme, type ThemePreference } from '@/features/theme/useTheme'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'system', label: 'Auto' },
]

/**
 * The theme row of the account menu and the drawer (Figma 108:142, « Choix du thème »): a sun
 * and a segment Clair / Sombre / Auto, Auto following the system.
 */
export function ThemeChoice() {
  const { preference, setPreference } = useTheme()
  return (
    <div className="flex min-h-11 items-center gap-3 pl-3 pr-1">
      <Icon name="sun" className="text-content" />
      <div role="radiogroup" aria-label="Thème" className="flex min-w-0 flex-1 gap-0.5 rounded-full border border-line p-[3px]">
        {OPTIONS.map((o) => {
          const active = preference === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPreference(o.value)}
              className={`flex min-h-[38px] min-w-0 flex-1 items-center justify-center rounded-full px-3 text-label-14 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
                active ? 'bg-inverse text-content-inverse' : 'text-content hover:bg-sunken'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
