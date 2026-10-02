import { useEffect, useState } from 'react'

/** The phone width of the note editor (YC-47): the same 480 px as its margin column (YC-45). */
export const PHONE_QUERY = '(max-width: 480px)'

/** Some browsers and test doubles have no matchMedia, or one that answers nothing: then not a phone. */
const phoneMedia = (): MediaQueryList | undefined => window.matchMedia?.(PHONE_QUERY) ?? undefined

/** True on a phone-wide screen, updated when the window crosses the width. */
export function usePhone() {
  const [phone, setPhone] = useState(() => phoneMedia()?.matches ?? false)
  useEffect(() => {
    const media = phoneMedia()
    if (!media) return
    const update = () => setPhone(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])
  return phone
}
