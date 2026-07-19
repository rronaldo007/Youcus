import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FocusPlayer } from './FocusPlayer'

describe('FocusPlayer', () => {
  it('embarque la vidéo via un iframe YouTube épuré (rel=0, sans distraction)', () => {
    render(<FocusPlayer youtubeId="abc123" title="Ma vidéo" />)

    const iframe = screen.getByTitle('Ma vidéo')
    expect(iframe).toBeInTheDocument()

    const src = iframe.getAttribute('src') ?? ''
    expect(src).toContain('/embed/abc123')
    expect(src).toContain('rel=0') // aucune recommandation d'autres chaînes
    expect(src).toContain('modestbranding=1')
    expect(src).toContain('iv_load_policy=3')
    expect(src).toContain('youtube-nocookie.com') // pas de cookies de suivi
  })
})
