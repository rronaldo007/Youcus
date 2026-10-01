import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { EndCard, type EndCardContext, type EndCardNext, type SaveSentence } from './EndCard'

const NEXT: EndCardNext = {
  title: 'useMemo et useCallback',
  thumbnailUrl: 'https://i.ytimg.com/vi/x/mqdefault.jpg',
  durationSeconds: 620,
  number: 5,
  to: '/playlists/p1/watch/next1',
}

function renderCard(props: { onSave?: SaveSentence; next?: EndCardNext | null; onReplay?: () => void; context?: EndCardContext } = {}) {
  const onSave = props.onSave ?? vi.fn<SaveSentence>(() => true)
  const onReplay = props.onReplay ?? vi.fn()
  render(
    <MemoryRouter>
      <EndCard
        context={
          props.context ?? {
            kind: 'playlist',
            number: 4,
            total: 17,
            next: props.next === undefined ? NEXT : props.next,
            playlistTo: '/playlists/p1',
          }
        }
        seconds={872}
        onSave={onSave}
        onReplay={onReplay}
      />
    </MemoryRouter>,
  )
  return { onSave, onReplay, input: screen.getByRole('textbox', { name: 'Une phrase pour retenir' }) }
}

describe('EndCard (YC-60, Figma « Fin de vidéo » 102:168)', () => {
  it('says where the video is, asks the sentence, and shows the next one without a countdown', () => {
    renderCard()
    expect(screen.getByText('VIDÉO 4 / 17 · TERMINÉE ✓')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Une phrase pour retenir ?' })).toBeInTheDocument()
    expect(screen.getByText(/Enregistrée à 14:32 dans ta note/)).toBeInTheDocument()
    expect(screen.getByText('SUIVANTE · 5 / 17')).toBeInTheDocument()
    expect(screen.getByText('useMemo et useCallback')).toBeInTheDocument()
    expect(screen.getByText('10:20')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lire la suivante →' })).toHaveAttribute('href', '/playlists/p1/watch/next1')
    expect(screen.getByText(/Pas de lecture automatique/)).toBeInTheDocument()
  })

  it('takes the focus when nothing else is being written', () => {
    const { input } = renderCard()
    expect(input).toHaveFocus()
  })

  it('never takes the focus from a field being written in', () => {
    const other = document.createElement('input')
    document.body.appendChild(other)
    other.focus()
    renderCard()
    expect(other).toHaveFocus()
    other.remove()
  })

  it('sends the sentence trimmed on Entrée, and says it is in the note once saved', async () => {
    let done: { onSuccess: () => void } | undefined
    const onSave = vi.fn<SaveSentence>((_text, callbacks) => {
      done = callbacks
      return true
    })
    const { input } = renderCard({ onSave })
    const save = screen.getByRole('button', { name: 'Dans le cahier' })
    expect(save).toBeDisabled()
    fireEvent.change(input, { target: { value: '  Un effet après le rendu  ' } })
    fireEvent.submit(input)
    expect(onSave).toHaveBeenCalledWith('Un effet après le rendu', expect.anything())
    expect(screen.getByRole('button', { name: 'Envoi…' })).toBeDisabled()
    act(() => done?.onSuccess())
    expect(await screen.findByRole('status')).toHaveTextContent('✓ Dans ta note, à 14:32.')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('says it when the server refuses', async () => {
    const onSave = vi.fn<SaveSentence>((_text, callbacks) => {
      callbacks.onError()
      return true
    })
    const { input } = renderCard({ onSave })
    fireEvent.change(input, { target: { value: 'Retenu' } })
    fireEvent.submit(input)
    expect(await screen.findByRole('alert')).toHaveTextContent('Pas encore enregistrée')
  })

  it('keeps the sentence when the note is not ready', () => {
    const { input } = renderCard({ onSave: vi.fn<SaveSentence>(() => false) })
    fireEvent.change(input, { target: { value: 'Retenu' } })
    fireEvent.submit(input)
    expect(screen.getByRole('alert')).toHaveTextContent("Ta note n'est pas encore prête")
    expect(input).toHaveValue('Retenu')
  })

  it('Échap passes the question and goes to the next video', async () => {
    const { input } = renderCard()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('link', { name: 'Lire la suivante →' })).toHaveFocus())
  })

  it('Revoir asks the player to start again', () => {
    const { onReplay } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Revoir' }))
    expect(onReplay).toHaveBeenCalled()
  })

  it('on the last video, leads back to the playlist', () => {
    renderCard({ next: null })
    expect(screen.queryByText(/SUIVANTE/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à la playlist →' })).toHaveAttribute('href', '/playlists/p1')
  })

  describe('a video kept on its own (YC-61, Figma 104:212)', () => {
    const single: EndCardContext = { kind: 'single', homeTo: '/' }

    it('says so, asks the sentence, and leads back to the dashboard', () => {
      renderCard({ context: single })
      expect(screen.getByText('VIDÉO SEULE · TERMINÉE ✓')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Une phrase pour retenir ?' })).toBeInTheDocument()
      expect(screen.getByText(/n'appartient à aucune playlist/)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Retour au tableau de bord' })).toHaveAttribute('href', '/')
      expect(screen.queryByText(/SUIVANTE/)).not.toBeInTheDocument()
      // The catalogue does not exist yet: no button towards it.
      expect(screen.queryByText('Voir le catalogue')).not.toBeInTheDocument()
    })

    it('Revoir starts it again, Échap goes to the dashboard link', async () => {
      const { onReplay, input } = renderCard({ context: single })
      fireEvent.click(screen.getByRole('button', { name: 'Revoir' }))
      expect(onReplay).toHaveBeenCalled()
      fireEvent.keyDown(input, { key: 'Escape' })
      await waitFor(() => expect(screen.getByRole('link', { name: 'Retour au tableau de bord' })).toHaveFocus())
    })
  })
})
