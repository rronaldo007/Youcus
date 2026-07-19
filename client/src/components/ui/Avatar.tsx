import type { User } from '@/types'

/** Avatar utilisateur : photo Google si dispo, sinon initiale sur fond neutre. */
export function Avatar({ user }: { user: Pick<User, 'displayName' | 'avatarUrl'> }) {
  const initial = user.displayName.trim().charAt(0).toUpperCase() || '?'

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.displayName}
        className="size-10 rounded-full border border-line object-cover"
      />
    )
  }

  return (
    <div
      aria-label={user.displayName}
      className="flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-sm font-semibold text-content"
    >
      {initial}
    </div>
  )
}
