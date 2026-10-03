import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CreatorPage } from './CreatorPage'

// « Le créateur » (YC-72): the facts are checked, not copied from the frame.

const open = () =>
  render(
    <MemoryRouter initialEntries={['/le-createur']}>
      <CreatorPage />
    </MemoryRouter>,
  )

describe('CreatorPage (YC-72)', () => {
  it('the name, the portrait and what is sought', () => {
    open()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('RonaldoRukundo')
    expect(screen.getByRole('img', { name: 'Ronaldo Rukundo' })).toBeInTheDocument()
    expect(screen.getByText('Ouvert à un poste de développeur')).toBeInTheDocument()
  })

  it('the journal, dated from the repository and the notes, where the frame was wrong', () => {
    open()
    const journal = within(screen.getByRole('heading', { name: 'Journal de bord.' }).closest('section') as HTMLElement)
    const steps = journal.getAllByRole('listitem')
    expect(steps.map((s) => s.querySelector('p')?.textContent)).toEqual(['Juin 2026', '19 juillet 2026', '8 août 2026', '27 août 2026', '29 septembre 2026'])
    // The oral was on 27/08, not 26; the Redis cache came on 26/07, not on 8/08.
    expect(journal.queryByText(/26 août/)).not.toBeInTheDocument()
    expect(steps[2]).not.toHaveTextContent('Redis')
    expect(steps[0]).not.toHaveTextContent('Merise')
  })

  it('the numbers that are true: 900+ tests, not 90', () => {
    open()
    expect(screen.getByText('900+')).toBeInTheDocument()
    expect(screen.queryByText('90')).not.toBeInTheDocument()
    expect(screen.getByText('tests à chaque pull request, mise en ligne à chaque fusion')).toBeInTheDocument()
  })

  it('the real links, opened apart, and the address to write to', () => {
    open()
    expect(screen.getByRole('link', { name: 'GitHub · rronaldo007' })).toHaveAttribute('href', 'https://github.com/rronaldo007')
    const linkedin = screen.getByRole('link', { name: /LinkedIn/ })
    expect(linkedin).toHaveAttribute('href', 'https://www.linkedin.com/in/rukundo-ronaldo-7a62b6168')
    expect(linkedin).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: /Portfolio/ })).toHaveAttribute('href', 'https://rukundo-ronaldo.fr')
    expect(screen.getByRole('link', { name: 'rukundoronaldo4@gmail.com' })).toHaveAttribute('href', 'mailto:rukundoronaldo4@gmail.com')
    // No placeholder of the frame left.
    expect(document.body.textContent).not.toMatch(/\[TON|\[TA PHOTO/)
  })

  it('lit in the public navigation, with the side margin of every public page (YC-90)', () => {
    open()
    expect(screen.getAllByRole('link', { name: 'Le créateur' })[0]).toHaveAttribute('aria-current', 'page')
    // The width itself is measured in a browser (1920 px: 320 to 1600); jsdom has no layout.
    for (const section of screen.getByRole('main').querySelectorAll('section')) expect(section).toHaveClass('xl:px-gutter')
  })
})
