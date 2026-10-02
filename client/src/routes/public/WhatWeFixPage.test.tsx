import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { FRICTIONS, SHIPPED_LABEL, SOON_LABEL } from '@/features/landing/frictions'
import { WhatWeFixPage } from './WhatWeFixPage'

/**
 * YC-71: a public page that says what Youcus fixes. Every claim was checked against the code on 02/10:
 * the tests pin the mock-up promises the app does not keep, so they cannot come back unnoticed.
 */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ce-qu-on-corrige']}>
      <WhatWeFixPage />
    </MemoryRouter>,
  )
}

describe('WhatWeFixPage', () => {
  it('is the current page of the public navigation', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Ce qu’on corrige' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 1, name: /Ce qu’on corrige, ?et comment\./ })).toBeInTheDocument()
  })

  it('lists the six frictions, each with its state', () => {
    renderPage()
    const rows = within(screen.getByRole('region', { name: 'Les six frictions' })).getAllByRole('listitem')
    expect(rows).toHaveLength(6)
    rows.forEach((row, i) => {
      expect(row).toHaveTextContent(FRICTIONS[i].title)
      expect(row).toHaveTextContent(FRICTIONS[i].shipped ? SHIPPED_LABEL : SOON_LABEL)
    })
  })

  it('says « Bientôt » on what the app does not do yet', () => {
    const soon = FRICTIONS.filter((f) => !f.shipped)
    renderPage()
    expect(screen.queryAllByText(SOON_LABEL)).toHaveLength(soon.length)
    expect(screen.getAllByText(SHIPPED_LABEL)).toHaveLength(FRICTIONS.length - soon.length)
  })

  it('makes none of the mock-up promises the code does not keep (checked 02/10)', () => {
    const { container } = renderPage()
    const text = container.textContent ?? ''
    // No autoplay at all, so no queue; one question per video, not per chapter; no seek bar of our own;
    // no « Reprendre » that opens the next video.
    expect(text).not.toMatch(/file d.attente/)
    expect(text).not.toMatch(/chaque chapitre/)
    expect(text).not.toMatch(/barre de lecture/)
    expect(text).not.toMatch(/« Reprendre »/)
    expect(text).not.toMatch(/n’affiche que ta playlist/)
  })

  it('says what it does not fix: the ads, which pay the people who make the courses', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 2, name: 'Ce qu’on ne corrige pas : les publicités.' })).toBeInTheDocument()
  })
})
