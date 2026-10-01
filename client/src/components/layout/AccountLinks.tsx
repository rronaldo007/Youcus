import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useLogout } from '@/features/auth/useLogout'
import type { User } from '@/types'

/** A row of the account menu and of the drawer: 44 px, an icon, a label. */
export const ROW_CLASS =
  'flex h-11 w-full items-center gap-3 rounded-yc-md px-3 text-left text-[15px] font-medium text-content-muted transition-colors hover:bg-sunken hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-45'

function RowIcon({ name }: { name: IconName }) {
  return <Icon name={name} size={24} className="text-content" />
}

/** Who is signed in: the avatar, the name, the e-mail. */
export function AccountIdentity({ user }: { user: User }) {
  return (
    <div className="flex min-w-0 items-center gap-3 py-2 pl-2">
      <Avatar user={user} size="menu" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-label-14 font-semibold text-content">{user.displayName}</p>
        <p className="truncate text-[12px] text-content-muted">{user.email}</p>
      </div>
    </div>
  )
}

/** Réglages, Mes données (the export, in the settings), and a way out. */
export function AccountLinks({ onNavigate, divided = true }: { onNavigate: () => void; divided?: boolean }) {
  const logout = useLogout()
  return (
    <>
      <Link to="/settings" onClick={onNavigate} className={ROW_CLASS}>
        <RowIcon name="settings" />
        Réglages
      </Link>
      <Link to="/settings#donnees" onClick={onNavigate} className={ROW_CLASS}>
        <RowIcon name="download" />
        Mes données
      </Link>
      {/* The menu sets « Se déconnecter » apart; the drawer, already under « Compte », does not. */}
      {divided && <div aria-hidden="true" className="my-1 h-px w-full bg-line" />}
      <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending} className={ROW_CLASS}>
        <RowIcon name="logout" />
        Se déconnecter
      </button>
    </>
  )
}
