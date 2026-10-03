import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Stats } from '@/features/stats/useStats'
import { StatsPage } from './StatsPage'

// Statistiques (YC-79): what the study log and the progress hold, nothing invented.

const user = { id: 'u1', email: 'a@b.fr', displayName: 'Alice', avatarUrl: null }
const week = (extra: Partial<Stats> = {}): Stats => ({
  range: 'week',
  from: '2026-09-28',
  to: '2026-10-04',
  today: '2026-10-04',
  since: '2026-10-03',
  days: [
    ...['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map((day) => ({ day, seconds: null })),
    { day: '2026-10-03', seconds: 0 },
    { day: '2026-10-04', seconds: 2400 },
  ],
  totalSeconds: 2400,
  streakDays: 1,
  completedCount: 2,
  goalMinutes: 300,
  playlists: [{ id: 'p1', title: 'fullstack', seen: 1, total: 3, advancedSeconds: 900, totalSeconds: 2700 }],
  ...extra,
})

let answer: (url: string) => Response
const calls: string[] = []
function open() {
  calls.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url)
      return url.endsWith('/auth/me') ? new Response(JSON.stringify(user), { status: 200 }) : answer(url)
    }),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <StatsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const ok = (stats: Stats) => () => new Response(JSON.stringify(stats), { status: 200 })

describe('StatsPage (YC-79)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('the week: the time, what is left of the goal, the days in a row, the videos seen, since when it counts', async () => {
    answer = ok(week())
    open()
    expect(await screen.findByText('0 h 40')).toBeInTheDocument()
    expect(screen.getByText('Encore 4 h 20 pour ton objectif de 5 h.')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Objectif de la semaine' })).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByText('1 jour d’affilée · 2 vidéos terminées · compté depuis le 3 octobre')).toBeInTheDocument()
    // Asked for the user's own day and time zone.
    expect(calls.find((u) => u.includes('/stats'))).toMatch(/range=week&today=\d{4}-\d{2}-\d{2}&offset=-?\d+/)
  })

  it('the chart: no bar for a day not counted, « — » for a day without study, today in red', async () => {
    answer = ok(week())
    open()
    const chart = await screen.findByRole('list', { name: 'Minutes par jour' })
    const days = within(chart).getAllByRole('listitem')
    expect(days).toHaveLength(7)
    const bar = (i: number) => days[i].querySelector('[data-bar]') as HTMLElement
    expect(bar(0).style.height).toBe('0px')
    expect(days[0]).toHaveTextContent('lundi 28 septembre : pas compté')
    expect(days[5]).toHaveTextContent('—')
    expect(bar(5).style.height).toBe('3px')
    expect(days[6]).toHaveTextContent('40')
    expect(bar(6)).toHaveClass('bg-accent')
  })

  it('a few seconds stay small: the scale is an hour at least, and they say « <1 »', async () => {
    const days = week().days.map((d) => (d.day === '2026-10-04' ? { ...d, seconds: 4 } : d))
    answer = ok(week({ days, totalSeconds: 4 }))
    open()
    const chart = await screen.findByRole('list', { name: 'Minutes par jour' })
    const today = within(chart).getAllByRole('listitem')[6]
    expect((today.querySelector('[data-bar]') as HTMLElement).style.height).toBe('6px')
    expect(today).toHaveTextContent('<1')
  })

  it('without a goal: the way to set one, in the settings', async () => {
    answer = ok(week({ goalMinutes: null }))
    open()
    expect(await screen.findByRole('link', { name: 'Fixer un objectif pour la semaine' })).toHaveAttribute('href', '/settings#etude')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('a goal reached says so', async () => {
    answer = ok(week({ goalMinutes: 30 }))
    open()
    expect(await screen.findByText('Objectif de 30 min atteint.')).toBeInTheDocument()
  })

  it('per playlist: seen, left, and « Avancée » named for what it is', async () => {
    answer = ok(week())
    open()
    const table = await screen.findByRole('table', { name: 'Par playlist' })
    const row = within(table).getAllByRole('row')[1]
    expect(row).toHaveTextContent('fullstack')
    expect(row).toHaveTextContent('1/3')
    expect(row).toHaveTextContent('2')
    expect(row).toHaveTextContent('0 h 15 sur 0 h 45')
    expect(within(table).getByRole('columnheader', { name: 'Avancée' })).toBeInTheDocument()
  })

  it('« Ce mois » asks the month; the goal, weekly, is not shown there', async () => {
    answer = (url) =>
      url.includes('range=month')
        ? new Response(JSON.stringify(week({ range: 'month', from: '2026-10-01', to: '2026-10-31', days: [{ day: '2026-10-01', seconds: null }] })), { status: 200 })
        : ok(week())()
    open()
    await screen.findByText('Encore 4 h 20 pour ton objectif de 5 h.')
    fireEvent.click(screen.getByRole('radio', { name: 'Ce mois' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: /Temps d’étude · ce mois/i })).toBeInTheDocument())
    expect(screen.queryByText(/objectif/)).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Ce mois' })).toHaveAttribute('aria-checked', 'true')
  })

  it('an error says the time is kept, and offers to try again', async () => {
    answer = () => new Response(JSON.stringify({ error: 'Erreur interne' }), { status: 500 })
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('Ton temps d’étude est enregistré')
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})
