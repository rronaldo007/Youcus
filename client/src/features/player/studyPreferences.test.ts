import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStudyPreferences, saveStudyPreferences } from './studyPreferences'

describe('the speed and captions kept in the browser (YC-59)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('gives back what was chosen', () => {
    saveStudyPreferences({ rate: 1.5, captions: 'fr' })
    expect(readStudyPreferences()).toEqual({ rate: 1.5, captions: 'fr' })
    saveStudyPreferences({ rate: 0.75, captions: null })
    expect(readStudyPreferences()).toEqual({ rate: 0.75, captions: null })
  })

  it('starts at 1,0× without captions, and ignores a speed outside the menu', () => {
    expect(readStudyPreferences()).toEqual({ rate: 1, captions: null })
    localStorage.setItem('youcus.player.rate', '16')
    expect(readStudyPreferences().rate).toBe(1)
  })

  it('blocked storage (private window) is not an error', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => saveStudyPreferences({ rate: 2, captions: 'en' })).not.toThrow()
    expect(readStudyPreferences()).toEqual({ rate: 1, captions: null })
  })
})
