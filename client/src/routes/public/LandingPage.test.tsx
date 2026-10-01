import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LandingPage } from './LandingPage'

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

describe('LandingPage (Figma 13:2, YC-69)', () => {
  it('says the promise and opens the sign-in', () => {
    renderLanding()
    expect(screen.getByRole('heading', { level: 1, name: /Regarde moins\. ?Retiens plus\./ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continuer avec Google →' })).toHaveAttribute('href', '/login')
  })

  it('leads « Voir ce qu’on corrige » to the three gestures until its page exists (YC-71)', () => {
    renderLanding()
    expect(screen.getByRole('link', { name: 'Voir ce qu’on corrige' })).toHaveAttribute('href', '#trois-gestes')
    const steps = screen.getByRole('region', { name: 'Trois gestes. Pas un de plus.' })
    expect(steps).toHaveAttribute('id', 'trois-gestes')
    expect(within(steps).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Importe', 'Regarde', 'Retiens'])
  })

  it('shows real public courses, each added by signing in; the full catalogue waits for YC-65', () => {
    renderLanding()
    const section = screen.getByRole('region', { name: 'Des cours entiers, gratuits.' })
    const cards = within(section).getAllByRole('article')
    expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Apprendre React',
      "Cours d'algorithmique: Apprendre à écrire les algorithmes",
      'useEffect React expliqué simplement : comment bien utiliser le hook useEffect ?',
    ])
    expect(within(cards[0]).getByText('27 vidéos · français')).toBeInTheDocument()
    expect(within(cards[0]).getByText('6 h 07')).toBeInTheDocument()
    expect(within(cards[2]).getByText('Vidéo')).toBeInTheDocument()
    for (const card of cards) {
      expect(within(card).getByRole('link', { name: '+ Ajouter à mes playlists' })).toHaveAttribute('href', '/login')
    }
    const all = within(section).getByText(/Voir tout le catalogue/)
    expect(all).toHaveAttribute('aria-disabled', 'true')
    expect(all.closest('a')).toBeNull()
  })

  it('gives the band to screen readers once, as a list', () => {
    renderLanding()
    const band = screen.getByRole('region', { name: 'Ce que Youcus retire' })
    expect(within(band).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Aucune recommandation',
      'Aucun Short',
      'Aucune lecture automatique',
      'Des notes horodatées',
    ])
  })

  it('moves only when motion is welcome (prefers-reduced-motion)', () => {
    const { container } = renderLanding()
    const animated = [...container.querySelectorAll('*')].flatMap((el) => [...el.classList].filter((c) => c.includes('animate-')))
    expect(animated.length).toBeGreaterThan(0)
    expect(animated.filter((c) => !c.startsWith('motion-safe:'))).toEqual([])
  })

  it('links to the privacy policy (YC-38)', () => {
    renderLanding()
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/confidentialite')
  })
})
