import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { ChapterRow } from './ChapterRow'
import { IconButton } from './IconButton'
import { Modal } from './Modal'
import { PageState } from './PageState'
import { StatusBanner } from './StatusBanner'
import { TextField } from './TextField'
import { Timestamp } from './Timestamp'
import { ToastProvider } from './Toast'
import { TOAST_DELAY_MS, useToast, type ToastTone } from './toastContext'

describe('Button (Figma 5:117)', () => {
  it('is a plain button by default: it never submits a form by accident', () => {
    const submit = vi.fn((e: Event) => e.preventDefault())
    render(
      <form onSubmit={(e) => submit(e.nativeEvent)}>
        <Button>Reprendre la vidéo</Button>
      </form>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre la vidéo' }))
    expect(submit).not.toHaveBeenCalled()
  })

  it('draws Primaire in ink and Danger in the red signal', () => {
    render(
      <>
        <Button>Fusionner</Button>
        <Button variant="danger">Supprimer définitivement</Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Fusionner' }).className).toContain('bg-inverse')
    expect(screen.getByRole('button', { name: 'Supprimer définitivement' }).className).toContain('bg-accent')
  })
})

describe('IconButton (Figma 5:140)', () => {
  it('always has an accessible name', () => {
    render(<IconButton icon="close" label="Fermer" />)
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
  })
})

describe('TextField (Figma 5:212)', () => {
  it('ties the label, and the asterisk comes before it, hidden from readers', () => {
    render(<TextField label="Lien de la playlist" required />)
    // The accessible name leaves out what is aria-hidden: readers say « Lien de la playlist, requis ».
    const input = screen.getByRole('textbox', { name: 'Lien de la playlist' })
    expect(input).toBeRequired()
    const label = screen.getByText('Lien de la playlist', { selector: 'label' })
    expect(label.firstElementChild).toHaveTextContent('*')
    expect(label.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('says an error with the line AND a sentence tied to the field', () => {
    render(<TextField label="Lien" status="error" message="Ce lien pointe vers une vidéo, pas une playlist." />)
    const input = screen.getByRole('textbox', { name: 'Lien' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Ce lien pointe vers une vidéo, pas une playlist.')
    expect(input.className).toContain('border-error')
  })

  it('explains a disabled field as information', () => {
    render(<TextField label="Lien" disabled message="L'accès YouTube est en lecture seule." />)
    expect(screen.getByText("L'accès YouTube est en lecture seule.").closest('p')).toHaveAttribute('data-tone', 'info')
  })
})

function ToastButton({ tone }: { tone: ToastTone }) {
  const toast = useToast()
  return (
    <button type="button" onClick={() => toast({ tone, title: `Toast ${tone}` })}>
      show {tone}
    </button>
  )
}

describe('Toast (Figma 5:258)', () => {
  afterEach(() => vi.useRealTimers())

  it('goes away after 5 s, and a second toast does not restart the first', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <ToastButton tone="success" />
        <ToastButton tone="info" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('show success'))
    act(() => vi.advanceTimersByTime(TOAST_DELAY_MS - 1000))
    fireEvent.click(screen.getByText('show info'))
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByText('Toast success')).not.toBeInTheDocument()
    expect(screen.getByText('Toast info')).toBeInTheDocument()
  })

  it('keeps an error until it is closed', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <ToastButton tone="error" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('show error'))
    act(() => vi.advanceTimersByTime(TOAST_DELAY_MS * 3))
    expect(screen.getByRole('alert')).toHaveTextContent('Toast error')
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByText('Toast error')).not.toBeInTheDocument()
  })
})

describe('Modal (Figma 5:305)', () => {
  function Harness({ onClose }: { onClose: () => void }) {
    return (
      <Modal title="Supprimer « Backend » ?" confirmLabel="Supprimer définitivement" destructive onConfirm={() => {}} onClose={onClose}>
        Cette action est définitive.
      </Modal>
    )
  }

  it('opens on the safe choice, closes on Échap, gives the focus back to its trigger', () => {
    const onClose = vi.fn()
    const { rerender } = render(<button type="button">Supprimer</button>)
    const trigger = screen.getByRole('button', { name: 'Supprimer' })
    trigger.focus()
    rerender(
      <>
        <button type="button">Supprimer</button>
        <Harness onClose={onClose} />
      </>,
    )
    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer « Backend » ?' })
    expect(dialog).toHaveAccessibleDescription('Cette action est définitive.')
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Annuler' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    rerender(<button type="button">Supprimer</button>)
    expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveFocus()
  })
})

describe('Timestamp and ChapterRow (Figma 5:321, 5:337)', () => {
  it('names where a timestamp goes', () => {
    render(<Timestamp seconds={245} />)
    expect(screen.getByRole('button', { name: 'Aller à 04:05' })).toBeInTheDocument()
  })

  it('marks the chapter in progress and the seen ones', () => {
    render(
      <>
        <ChapterRow seconds={72} title="Le cycle de rendu" state="seen" />
        <ChapterRow seconds={245} title="Le tableau de dépendances" state="current" />
        <ChapterRow seconds={520} title="La fonction de nettoyage" />
      </>,
    )
    expect(screen.getByRole('button', { name: /Le tableau de dépendances/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('● en cours')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Le cycle de rendu/ })).toHaveTextContent('✓ vu')
    expect(screen.getByRole('button', { name: /La fonction de nettoyage/ })).not.toHaveAttribute('aria-current')
  })
})

describe('PageState (Figma 96:115)', () => {
  it('makes an action that goes somewhere a link, one that does something a button', () => {
    const retry = vi.fn()
    render(
      <MemoryRouter>
        <PageState
          kind="error"
          title="Impossible de charger"
          text="Tes notes sont en sécurité."
          action={{ label: 'Réessayer', onClick: retry }}
          secondaryAction={{ label: 'Retour au tableau de bord', to: '/dashboard' }}
        />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Retour au tableau de bord' })).toHaveAttribute('href', '/dashboard')
  })
})

describe('StatusBanner (Figma 96:180)', () => {
  it('can be closed, except offline and error', () => {
    const close = vi.fn()
    const { rerender } = render(
      <StatusBanner kind="warning" onClose={close}>
        Quota presque atteint
      </StatusBanner>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(close).toHaveBeenCalledOnce()
    rerender(
      <StatusBanner kind="offline" onClose={close}>
        Hors ligne
      </StatusBanner>,
    )
    expect(screen.queryByRole('button', { name: 'Fermer' })).not.toBeInTheDocument()
  })
})
