import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isTyping } from '@/lib/keyboard'
import { SEARCH_PAGE } from '@/features/search/useSearchField'

/**
 * « / » opens the search (YC-22): the field of the top bar on a computer; on a phone, the search
 * page, its field waiting. Never while typing: there, « / » is a character.
 */
export function useSearchShortcut() {
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return
      e.preventDefault()
      const field = [...document.querySelectorAll<HTMLInputElement>('[data-search-field]')].find((el) => el.offsetParent !== null)
      if (field) {
        field.focus()
        field.select()
      } else navigate(SEARCH_PAGE)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
}
