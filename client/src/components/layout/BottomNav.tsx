// Onglets de navigation mobile (routes à venir dans de futurs tickets).
const TABS = [
  { label: 'Accueil', icon: '🏠', active: true },
  { label: 'Notes', icon: '📝', active: false },
  { label: 'Stats', icon: '📊', active: false },
  { label: 'Profil', icon: '👤', active: false },
]

/** Barre d'onglets mobile fixée en bas (cf. Figma BottomNav 32:155). */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex h-16 items-center justify-around border-t border-line bg-surface">
      {TABS.map((tab) => (
        <button
          key={tab.label}
          type="button"
          className={`flex flex-col items-center gap-1 text-xs ${
            tab.active ? 'text-brand-purple' : 'text-content-muted'
          }`}
        >
          <span className="text-lg leading-none">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
