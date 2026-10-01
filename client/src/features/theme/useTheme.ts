import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
/** What the person chose: a theme, or « Auto », which follows the system (Figma « Menu du compte » 108:142). */
export type ThemePreference = Theme | 'system'

const STORAGE_KEY = 'youcus-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

/** Some browsers and test doubles have no matchMedia, or one that answers nothing: then light. */
function systemMedia(): MediaQueryList | undefined {
  return window.matchMedia?.(DARK_QUERY) ?? undefined
}

function systemTheme(): Theme {
  return systemMedia()?.matches ? 'dark' : 'light'
}

/*
 * One store for the whole app: the button of the bar, the menu of the account and the settings
 * page show the same choice, and changing it in one place changes it everywhere at once.
 */
let preference: ThemePreference | null = null
let theme: Theme = 'light'
const listeners = new Set<() => void>()

function apply() {
  theme = preference === 'system' || preference === null ? systemTheme() : preference
  document.documentElement.classList.toggle('dark', theme === 'dark')
  listeners.forEach((l) => l())
}

function ensureLoaded() {
  if (preference !== null) return
  preference = readPreference()
  apply()
}

function setPreferenceValue(next: ThemePreference) {
  preference = next
  localStorage.setItem(STORAGE_KEY, next)
  apply()
}

function subscribe(listener: () => void) {
  ensureLoaded()
  listeners.add(listener)
  // « Auto » follows the system while the app is open.
  const media = systemMedia()
  const onSystemChange = () => preference === 'system' && apply()
  media?.addEventListener?.('change', onSystemChange)
  return () => {
    listeners.delete(listener)
    media?.removeEventListener?.('change', onSystemChange)
  }
}

/** Test helper: forget the loaded choice, so the next render reads storage again. */
export function resetThemeStore() {
  preference = null
}

/** Gère le thème : clair, sombre ou auto ; applique la classe `dark` et persiste le choix. */
export function useTheme() {
  ensureLoaded()
  const current = useSyncExternalStore(subscribe, () => theme)
  const pref = useSyncExternalStore(subscribe, () => preference ?? 'system')
  const toggle = useCallback(() => setPreferenceValue(theme === 'dark' ? 'light' : 'dark'), [])
  const setPreference = useCallback((next: ThemePreference) => setPreferenceValue(next), [])
  return { theme: current, preference: pref, toggle, setPreference }
}
