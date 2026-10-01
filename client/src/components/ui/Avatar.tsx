import type { User } from '@/types'

/** 44 in the bar (the touch target), 40 in the account menu and the drawer, as in Figma. */
const SIZES = {
  bar: 'size-11 text-label-14 font-semibold',
  menu: 'size-10 font-serif text-[18px]',
}

/** Avatar utilisateur : photo Google si dispo, sinon initiale en clair sur l'encre. */
export function Avatar({ user, size = 'bar' }: { user: Pick<User, 'displayName' | 'avatarUrl'>; size?: keyof typeof SIZES }) {
  const initial = user.displayName.trim().charAt(0).toUpperCase() || '?'
  const box = SIZES[size]

  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
  }

  return (
    <span aria-hidden="true" className={`${box} flex shrink-0 items-center justify-center rounded-full bg-inverse text-content-inverse`}>
      {initial}
    </span>
  )
}
