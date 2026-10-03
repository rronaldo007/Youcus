import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudyGoalSettings } from './StudyGoalSettings'

// Réglages › Étude (YC-79): the weekly goal, saved when the field is left.

const puts: unknown[] = []
function open(minutes: number | null) {
  puts.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(init.body as string) as { minutes: number | null }
        puts.push(body)
        return new Response(JSON.stringify(body), { status: 200 })
      }
      return new Response(JSON.stringify({ minutes }), { status: 200 })
    }),
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StudyGoalSettings />
    </QueryClientProvider>,
  )
  return screen.findByRole('textbox', { name: 'Minutes d’étude par semaine' })
}

describe('the weekly goal (YC-79)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the goal kept, saves a new one when the field is left', async () => {
    const field = await open(300)
    expect(field).toHaveValue('300')
    fireEvent.change(field, { target: { value: '240' } })
    fireEvent.blur(field)
    await waitFor(() => expect(puts).toEqual([{ minutes: 240 }]))
    expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
  })

  it('empty means no goal', async () => {
    const field = await open(300)
    fireEvent.change(field, { target: { value: '' } })
    fireEvent.blur(field)
    await waitFor(() => expect(puts).toEqual([{ minutes: null }]))
    expect(await screen.findByText('Enregistré : pas d’objectif.')).toBeInTheDocument()
  })

  it('refuses what the server would refuse, and sends nothing', async () => {
    const field = await open(null)
    for (const value of ['10', '7000', 'beaucoup', '30.5']) {
      fireEvent.change(field, { target: { value } })
      fireEvent.blur(field)
      expect(await screen.findByText('Un nombre de minutes, de 15 à 6000.')).toBeInTheDocument()
    }
    expect(puts).toEqual([])
  })

  it('nothing changed, nothing sent', async () => {
    const field = await open(300)
    fireEvent.blur(field)
    await new Promise((r) => setTimeout(r, 50))
    expect(puts).toEqual([])
  })
})
