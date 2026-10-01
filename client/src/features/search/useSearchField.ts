import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { readType, resultLinks, searchPath, type SearchResults } from '@/features/search/search'

export const SEARCH_PAGE = '/recherche'

/**
 * A search field (YC-22): the one of the top bar on a computer, the one of the page on a phone.
 * It shows the term of the page it is on; Entrée searches, or opens the first result when the term
 * is the one already shown; Échap closes it, the term as it was.
 */
export function useSearchField() {
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = pathname === SEARCH_PAGE ? (params.get('q') ?? '').trim() : ''
  const [draft, setDraft] = useState(query)

  useEffect(() => setDraft(query), [query])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = draft.trim()
    if (!next) return
    const shown = queryClient.getQueryData<SearchResults>(['search', query])
    if (next === query && shown) {
      const first = resultLinks(shown, readType(params.get('type')))[0]
      if (first) navigate(first)
      return
    }
    navigate(searchPath(next))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Escape') return
    // Chrome empties a search field on Échap, after this: the term would be lost, not put back.
    e.preventDefault()
    setDraft(query)
    e.currentTarget.blur()
  }

  return { query, draft, setDraft, submit, onKeyDown }
}
