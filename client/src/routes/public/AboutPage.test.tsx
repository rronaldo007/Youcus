import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AboutPage } from './AboutPage'

/** YC-70: every sentence of the page was checked against the code on 02/10; the tests keep it so. */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/a-propos']}>
      <AboutPage />
    </MemoryRouter>,
  )
}

describe('AboutPage', () => {
  it('is the current page of the public navigation', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'À propos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('YouTube est la plus grande école du monde.')
  })

  it('states the four principles held in the code', () => {
    renderPage()
    const list = screen.getByRole('heading', { level: 2, name: 'Quatre principes, tenus dans le code.' }).parentElement as HTMLElement
    expect(within(list).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Rien n’est téléchargé',
      'Les publicités restent',
      'Lecture seule',
      'Tes notes t’appartiennent',
    ])
  })

  it('claims no Shorts filter, which the import does not have (decision of 02/10)', () => {
    renderPage()
    const figures = screen.getByRole('region', { name: 'En chiffres' })
    expect(figures).not.toHaveTextContent(/Short/)
    expect(within(figures).getByText('lecture automatique')).toBeInTheDocument()
  })

  it('« Rencontrer le créateur » leads to his page (YC-72)', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Rencontrer le créateur' })).toHaveAttribute('href', '/le-createur')
    expect(screen.queryByText(/Rencontrer le créateur · Bientôt/)).not.toBeInTheDocument()
  })
})
