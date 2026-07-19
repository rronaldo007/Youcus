import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
  it('affiche le hero, le CTA Google et les points de valeur', () => {
    render(<LandingPage />)

    expect(screen.getByRole('heading', { level: 1, name: /sans les distractions/i })).toBeInTheDocument()

    // Le CTA pointe vers le flux de connexion Google.
    const ctas = screen.getAllByRole('link', { name: /Continuer avec Google/i })
    expect(ctas.length).toBeGreaterThan(0)
    expect(ctas[0]).toHaveAttribute('href', expect.stringContaining('/auth/google'))

    // Sections de valeur.
    expect(screen.getByText('Lecteur focus')).toBeInTheDocument()
    expect(screen.getByText('Progression')).toBeInTheDocument()
  })
})
