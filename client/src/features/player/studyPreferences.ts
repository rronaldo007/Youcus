import { RATES } from '@/features/player/playbackRate'

const RATE_KEY = 'youcus.player.rate'
const CAPTIONS_KEY = 'youcus.player.captions'

/**
 * The speed and the captions chosen (YC-59), kept in this browser from one video and one visit to
 * the next. Storage can be missing or blocked (private window): then they are just not kept.
 */
export function readStudyPreferences(): { rate: number; captions: string | null } {
  try {
    const rate = Number(localStorage.getItem(RATE_KEY))
    const captions = localStorage.getItem(CAPTIONS_KEY)
    return { rate: (RATES as readonly number[]).includes(rate) ? rate : 1, captions: captions === null || captions === 'off' ? null : captions }
  } catch {
    return { rate: 1, captions: null }
  }
}

export function saveStudyPreferences(prefs: { rate: number; captions: string | null }) {
  try {
    localStorage.setItem(RATE_KEY, String(prefs.rate))
    localStorage.setItem(CAPTIONS_KEY, prefs.captions ?? 'off')
  } catch {
    // Not kept: the choice still holds for this visit.
  }
}
