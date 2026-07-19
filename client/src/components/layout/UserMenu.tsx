import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { useLogout } from '@/features/auth/useLogout'
import type { User } from '@/types'

/** Avatar cliquable ouvrant un menu utilisateur avec la déconnexion. */
export function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const logout = useLogout()

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu utilisateur"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full"
      >
        <Avatar user={user} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-52 rounded-card border border-line bg-surface p-1 shadow-lg"
        >
          <p className="truncate px-3 py-2 text-sm text-content-muted">{user.displayName}</p>
          <button
            type="button"
            role="menuitem"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-content transition hover:bg-surface-2 disabled:opacity-60"
          >
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}
