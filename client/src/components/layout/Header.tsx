import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { useLogout } from '@/features/auth/useLogout'

/** En-tête applicatif : affiche l'utilisateur et le bouton de déconnexion quand il est connecté. */
export function Header() {
  const { data: user } = useCurrentUser()
  const logout = useLogout()

  if (!user) return null

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
      <span className="font-bold tracking-tight">
        You<span className="text-brand-purple">cus</span>
      </span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">{user.displayName}</span>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="rounded-card border border-neutral-300 px-3 py-1.5 text-sm font-medium transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Se déconnecter
        </button>
      </div>
    </header>
  )
}
