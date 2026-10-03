import { render as rtlRender, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PrivacyPage } from './PrivacyPage'

/**
 * YC-38: Google requires this page to publish the OAuth app. The tests pin the facts that were
 * checked against the code and the hosting settings, and the claims the app cannot make.
 */
const render = (ui: ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

describe('PrivacyPage', () => {
  it('offers a way back home to a visitor without a session', () => {
    render(<PrivacyPage />)
    expect(within(screen.getByRole('main')).getByRole('link', { name: /Accueil/ })).toHaveAttribute('href', '/')
  })

  it('names who is responsible and how to reach them', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Confidentialité' })).toBeInTheDocument()
    expect(screen.getByText(/Ronaldo Rukundo, à titre personnel/)).toBeInTheDocument()
    const mails = screen.getAllByRole('link', { name: 'rukundoronaldo4@gmail.com' })
    expect(mails[0]).toHaveAttribute('href', 'mailto:rukundoronaldo4@gmail.com')
  })

  it('states the checked facts: EU hosting, read-only YouTube access, cookies and their duration', () => {
    const { container } = render(<PrivacyPage />)
    const text = container.textContent ?? ''
    expect(text).toContain('Eemshaven, aux Pays-Bas')
    expect(text).toContain('lecture seule')
    expect(text).toContain('youcus_session')
    expect(text).toContain('7 jours')
    expect(text).toContain('youcus_oauth_state')
    expect(text).toContain('10 minutes')
  })

  it('says the study time is kept, exported and deleted with the account (YC-79)', () => {
    const { container } = render(<PrivacyPage />)
    const text = container.textContent ?? ''
    expect(text).toContain('les secondes de vidéo regardées chaque jour')
    expect(text).toContain('la date où tu marques une vidéo comme vue')
    expect(text).toContain('ton objectif de la semaine si tu en fixes un')
    expect(text).toContain('ta progression et ton temps d’étude.')
    expect(text).toContain('ton temps d’étude et ton accès YouTube sont supprimés')
  })

  it('links to the Google policy and to revoking access in the Google account', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('link', { name: 'Google API Services User Data Policy' })).toHaveAttribute(
      'href',
      'https://developers.google.com/terms/api-services-user-data-policy',
    )
    expect(screen.getByRole('link', { name: /autorisations de ton compte Google/ })).toHaveAttribute(
      'href',
      'https://myaccount.google.com/permissions',
    )
  })

  it('wears the public navigation and footer (YC-73)', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('navigation', { name: 'Site' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Ronaldo Rukundo')
  })

  it('makes no claim the app does not keep (no encryption, no Frankfurt, no deferred deletion)', () => {
    const { container } = render(<PrivacyPage />)
    const text = (container.textContent ?? '').toLowerCase()
    expect(text).not.toContain('chiffr')
    expect(text).not.toContain('francfort')
    expect(text).not.toContain('30 jours')
  })
})
