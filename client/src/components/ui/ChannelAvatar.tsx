import { useState } from 'react'

/**
 * A channel's face, or a neutral disc: Google's image hosts sometimes refuse to serve it
 * (ERR_BLOCKED_BY_ORB seen on 02/10), and a broken image must never show.
 */
export function ChannelAvatar({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) return <span aria-hidden="true" className="size-7 shrink-0 rounded-full bg-sunken" />
  return <img src={url} alt="" onError={() => setFailed(true)} className="size-7 shrink-0 rounded-full object-cover" />
}
