import { useEffect, useState } from 'react'

/** The phone width of the note editor (YC-47): the same 480 px as its margin column (YC-45). */
export const PHONE_QUERY = '(max-width: 480px)'

/** True on a phone-wide screen, updated when the window crosses the width. */
export function usePhone() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY)
    const update = () => setPhone(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return phone
}
