import { useEffect, useRef } from 'react'
import { Icon } from '@/features/notes/FormattingToolbar'
import { ToolMenu } from '@/features/notes/ToolMenu'
import { usePhone } from '@/features/notes/usePhone'
import type { CaptionTrack } from '@/features/player/FocusPlayer'
import { RATES, formatRate, stepRate } from '@/features/player/playbackRate'
import { isTyping } from '@/lib/keyboard'
import checkIcon from '@/features/notes/icons/check.svg'
import chevronIcon from '@/features/notes/icons/chevron-down.svg'
import '@/features/notes/note-editor.css'
import './study-controls.css'

/** The player's actions the shortcuts need. */
export interface StudyPlayer {
  seekBy(delta: number): void
  togglePlay(): void
}

interface StudyControlsProps {
  player: StudyPlayer
  rate: number
  onRate: (rate: number) => void
  /** Language shown, '' for « on » before the tracks are known, null for none. */
  captions: string | null
  /** The tracks YouTube offers, null until it gives them. */
  tracks: CaptionTrack[] | null
  onCaptions: (languageCode: string | null) => void
}

/** Where a key is not for the player: a field, a button (space presses it), a menu, an open dialog. */
function keyIsTaken(e: KeyboardEvent) {
  if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || isTyping(e.target)) return true
  if (document.querySelector('[aria-modal="true"]')) return true
  const target = e.target instanceof Element ? e.target : null
  return !!target?.closest('[role="menu"]') || (e.key === ' ' && !!target?.closest('button, a, summary, [role="button"]'))
}

/**
 * Study controls under the player (YC-59), Figma « Contrôles d'étude » 102:66: the speed, the
 * captions, and the shortcuts J / L (±10 s), espace (pause), C (captions), Maj+. / Maj+, (speed).
 * None of them fires while typing in the note: there, they are letters.
 */
export function StudyControls({ player, rate, onRate, captions, tracks, onCaptions }: StudyControlsProps) {
  const phone = usePhone()
  // The language C brings back, the last one chosen.
  const lastLanguage = useRef('')
  if (captions) lastLanguage.current = captions

  const latest = useRef({ player, rate, onRate, captions, tracks, onCaptions })
  latest.current = { player, rate, onRate, captions, tracks, onCaptions }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (keyIsTaken(e)) return
      const { player, rate, onRate, captions, tracks, onCaptions } = latest.current
      const key = e.key.toLowerCase()
      // Maj+. and Maj+, as on YouTube: « > » and « < » on most layouts, the same physical keys otherwise.
      const faster = e.key === '>' || (e.shiftKey && e.code === 'Period')
      const slower = e.key === '<' || (e.shiftKey && e.code === 'Comma')
      if (faster || slower) onRate(stepRate(rate, faster ? 1 : -1))
      else if (e.shiftKey) return
      else if (key === 'j') player.seekBy(-10)
      else if (key === 'l') player.seekBy(10)
      else if (e.key === ' ' && !e.repeat) player.togglePlay()
      else if (key === 'c' && !e.repeat) {
        const french = tracks?.find((t) => t.languageCode.startsWith('fr'))?.languageCode
        onCaptions(captions !== null ? null : lastLanguage.current || french || tracks?.[0]?.languageCode || '')
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const language = captions ? captions.split('-')[0].toUpperCase() : ''
  const captionsText = phone
    ? `CC${language ? ` · ${language}` : ''}`
    : `Sous-titres : ${captions === null ? 'non' : language || 'oui'}`

  return (
    <div className="yc-study" data-compact={phone || undefined}>
      <div className="yc-study-menus">
        <ToolMenu
          inToolbar={false}
          buttonLabel={`Vitesse de lecture : ${formatRate(rate)}`}
          buttonClassName="yc-study-select"
          buttonContent={
            <>
              <span>{formatRate(rate)}</span>
              <Icon src={chevronIcon} size={18} />
            </>
          }
          menuLabel="Vitesse de lecture"
          menuClassName="yc-study-menu"
        >
          {(close) => (
            <>
              <p aria-hidden="true" className="yc-menu-label">
                VITESSE DE LECTURE
              </p>
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="menuitemradio"
                  aria-checked={rate === r}
                  tabIndex={-1}
                  className="yc-menu-item"
                  onClick={() => {
                    onRate(r)
                    close()
                  }}
                >
                  <span className="yc-menu-item-label">{formatRate(r)}</span>
                  {r === 1 && <span className="yc-menu-shortcut">normale</span>}
                  {rate === r && <Icon src={checkIcon} size={18} />}
                </button>
              ))}
              <p className="yc-study-help">Maj + . plus vite · Maj + , moins vite</p>
            </>
          )}
        </ToolMenu>

        <ToolMenu
          inToolbar={false}
          buttonLabel={captionsText}
          buttonClassName="yc-study-select"
          buttonContent={
            <>
              <span>{captionsText}</span>
              <Icon src={chevronIcon} size={18} />
            </>
          }
          menuLabel="Sous-titres"
          menuClassName="yc-study-menu"
        >
          {(close) => {
            // Until YouTube gives its tracks (the undocumented part), the menu is on / off.
            const choices: { code: string | null; label: string; auto?: boolean }[] = [
              { code: null, label: 'Désactivés' },
              ...(tracks ? tracks.map((t) => ({ code: t.languageCode, label: t.label, auto: t.auto })) : [{ code: '', label: 'Activés' }]),
            ]
            return (
              <>
                <p aria-hidden="true" className="yc-menu-label">
                  SOUS-TITRES
                </p>
                {choices.map((c) => {
                  const checked = c.code === captions || (c.code === '' && captions !== null)
                  return (
                    <button
                      key={c.code ?? 'off'}
                      type="button"
                      role="menuitemradio"
                      aria-checked={checked}
                      tabIndex={-1}
                      className="yc-menu-item"
                      onClick={() => {
                        onCaptions(c.code)
                        close()
                      }}
                    >
                      <span className="yc-menu-item-label">{c.label}</span>
                      {c.auto && <span className="yc-menu-shortcut">générés auto.</span>}
                      {checked && <Icon src={checkIcon} size={18} />}
                    </button>
                  )
                })}
                <p className="yc-study-help">Affichés par YouTube dans le lecteur. Touche C.</p>
              </>
            )
          }}
        </ToolMenu>
      </div>

      <p className="yc-study-keys">{phone ? 'M : repère' : 'M : repère · J / L : ±10 s · espace : pause'}</p>
    </div>
  )
}
