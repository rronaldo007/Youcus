import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
  it('affiche le hero, le CTA vers /login et les points de valeur', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /sans les distractions/i })).toBeInTheDocument()

    const ctas = screen.getAllByRole('link', { name: /Continuer avec Google/i })
    expect(ctas.length).toBeGreaterThan(0)
    expect(ctas[0]).toHaveAttribute('href', '/login')

    expect(screen.getByText('Lecteur focus')).toBeInTheDocument()
    expect(screen.getByText('Progression')).toBeInTheDocument()
  })
})
