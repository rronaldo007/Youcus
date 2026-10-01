import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CaptionTrack } from './FocusPlayer'
import { formatRate, stepRate } from './playbackRate'
import { StudyControls } from './StudyControls'

const player = { seekBy: vi.fn(), togglePlay: vi.fn() }
const onRate = vi.fn()
const onCaptions = vi.fn()

/** A phone-wide screen, or not: the controls read it through matchMedia. */
function screenWidth(phone: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: phone && query.includes('max-width: 480px'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  )
}

/** The controls with their state kept, as the page keeps it. */
function Controls({ tracks = null, start = null }: { tracks?: CaptionTrack[] | null; start?: string | null }) {
  const [rate, setRate] = useState(1)
  const [captions, setCaptions] = useState<string | null>(start)
  return (
    <StudyControls
      player={player}
      rate={rate}
      onRate={(r) => {
        onRate(r)
        setRate(r)
      }}
      captions={captions}
      tracks={tracks}
      onCaptions={(c) => {
        onCaptions(c)
        setCaptions(c)
      }}
    />
  )
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  fireEvent.keyDown(target, { key, ...init })

const TRACKS: CaptionTrack[] = [
  { languageCode: 'fr', label: 'Français', auto: false },
  { languageCode: 'en', label: 'English', auto: true },
]

describe('the speeds (YC-59)', () => {
  it.each([
    [1, '1,0×'],
    [0.75, '0,75×'],
    [1.25, '1,25×'],
    [2, '2,0×'],
  ])('%s is written %s', (rate, text) => expect(formatRate(rate)).toBe(text))

  it('steps up and down the menu, and stops at its ends', () => {
    expect(stepRate(1, 1)).toBe(1.25)
    expect(stepRate(1, -1)).toBe(0.75)
    expect(stepRate(2, 1)).toBe(2)
    expect(stepRate(0.75, -1)).toBe(0.75)
    // A speed between two, set from YouTube's own menu.
    expect(stepRate(1.1, 1)).toBe(1.25)
    expect(stepRate(1.1, -1)).toBe(1)
  })
})

describe('study controls under the player (YC-59)', () => {
  beforeEach(() => {
    screenWidth(false)
    vi.clearAllMocks()
  })
  afterEach(() => vi.restoreAllMocks())

  it('the speed menu lists 0,75× to 2,0×, 1,0× checked as « normale », and sets the speed chosen', () => {
    render(<Controls />)
    fireEvent.click(screen.getByRole('button', { name: 'Vitesse de lecture : 1,0×' }))
    const menu = screen.getByRole('menu', { name: 'Vitesse de lecture' })
    const items = within(menu).getAllByRole('menuitemradio')
    expect(items.map((i) => i.textContent)).toEqual(['0,75×', '1,0×normale', '1,25×', '1,5×', '1,75×', '2,0×'])
    expect(items[1]).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(items[3])
    expect(onRate).toHaveBeenCalledWith(1.5)
    expect(screen.getByRole('button', { name: 'Vitesse de lecture : 1,5×' })).toBeInTheDocument()
  })

  it('Maj+. and Maj+, change the speed, by the key or by its place', () => {
    render(<Controls />)
    press('>', { shiftKey: true })
    expect(onRate).toHaveBeenLastCalledWith(1.25)
    press('.', { shiftKey: true, code: 'Period' })
    expect(onRate).toHaveBeenLastCalledWith(1.5)
    press('<', { shiftKey: true })
    expect(onRate).toHaveBeenLastCalledWith(1.25)
  })

  it('J and L move 10 s, space pauses or plays', () => {
    render(<Controls />)
    press('j')
    expect(player.seekBy).toHaveBeenLastCalledWith(-10)
    press('L')
    expect(player.seekBy).toHaveBeenLastCalledWith(10)
    press(' ')
    expect(player.togglePlay).toHaveBeenCalledTimes(1)
  })

  it('no shortcut fires while typing in the note, nor in a field', () => {
    render(
      <>
        <Controls />
        <div contentEditable="true" suppressContentEditableWarning data-testid="note">
          texte
        </div>
        <input aria-label="champ" />
      </>,
    )
    for (const target of [screen.getByTestId('note'), screen.getByLabelText('champ')]) {
      press('j', {}, target)
      press(' ', {}, target)
      press('c', {}, target)
      press('>', { shiftKey: true }, target)
    }
    expect(player.seekBy).not.toHaveBeenCalled()
    expect(player.togglePlay).not.toHaveBeenCalled()
    expect(onCaptions).not.toHaveBeenCalled()
    expect(onRate).not.toHaveBeenCalled()
  })

  it('space on a button presses the button, not the player; nothing fires under an open dialog', () => {
    render(
      <>
        <Controls />
        <button type="button">Marquer comme vue</button>
      </>,
    )
    press(' ', {}, screen.getByRole('button', { name: 'Marquer comme vue' }))
    expect(player.togglePlay).not.toHaveBeenCalled()
    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    document.body.append(dialog)
    press('l')
    dialog.remove()
    expect(player.seekBy).not.toHaveBeenCalled()
  })

  it('with Ctrl or Alt the keys are the browser’s', () => {
    render(<Controls />)
    press('l', { ctrlKey: true })
    press('j', { altKey: true })
    expect(player.seekBy).not.toHaveBeenCalled()
  })

  it('C shows the captions in French first, then hides them, then brings back the last language', () => {
    render(<Controls tracks={TRACKS} />)
    press('c')
    expect(onCaptions).toHaveBeenLastCalledWith('fr')
    expect(screen.getByRole('button', { name: 'Sous-titres : FR' })).toBeInTheDocument()
    press('c')
    expect(onCaptions).toHaveBeenLastCalledWith(null)
    fireEvent.click(screen.getByRole('button', { name: 'Sous-titres : non' }))
    fireEvent.click(within(screen.getByRole('menu', { name: 'Sous-titres' })).getByRole('menuitemradio', { name: /English/ }))
    press('c')
    press('c')
    expect(onCaptions).toHaveBeenLastCalledWith('en')
  })

  it('the captions menu lists the tracks YouTube gives, the generated ones said so', () => {
    render(<Controls tracks={TRACKS} start="fr" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sous-titres : FR' }))
    const items = within(screen.getByRole('menu', { name: 'Sous-titres' })).getAllByRole('menuitemradio')
    expect(items.map((i) => i.textContent)).toEqual(['Désactivés', 'Français', 'Englishgénérés auto.'])
    expect(items[1]).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Affichés par YouTube dans le lecteur. Touche C.')).toBeInTheDocument()
  })

  it('before YouTube gives its tracks, the captions menu is on / off', () => {
    render(<Controls />)
    fireEvent.click(screen.getByRole('button', { name: 'Sous-titres : non' }))
    const menu = screen.getByRole('menu', { name: 'Sous-titres' })
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Activés' }))
    expect(onCaptions).toHaveBeenLastCalledWith('')
    expect(screen.getByRole('button', { name: 'Sous-titres : oui' })).toBeInTheDocument()
  })

  it('a language kept from the last video, before the new tracks are known, shows as « Activés »', () => {
    render(<Controls start="fr" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sous-titres : FR' }))
    expect(within(screen.getByRole('menu', { name: 'Sous-titres' })).getByRole('menuitemradio', { name: 'Activés' })).toHaveAttribute('aria-checked', 'true')
  })

  it('shows the shortcuts; on a phone, compact: « CC · FR » and « M : repère » only', () => {
    const { unmount } = render(<Controls start="fr" />)
    expect(screen.getByText('M : repère · J / L : ±10 s · espace : pause')).toBeInTheDocument()
    unmount()
    screenWidth(true)
    render(<Controls start="fr" />)
    expect(screen.getByRole('button', { name: 'CC · FR' })).toBeInTheDocument()
    expect(screen.getByText('M : repère')).toBeInTheDocument()
  })
})
