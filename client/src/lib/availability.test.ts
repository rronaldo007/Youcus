import { describe, expect, it } from 'vitest'
import { isPlayable, unavailableSentence } from './availability'

const none = { total: 0, private: 0, deleted: 0, notEmbeddable: 0, blocked: 0, upcoming: 0 }

describe('unavailableSentence (YC-13)', () => {
  it('says nothing when every video can be played', () => {
    expect(unavailableSentence(none)).toBeNull()
    expect(unavailableSentence(undefined)).toBeNull()
  })

  it('writes the design sentence, singular and plural', () => {
    expect(unavailableSentence({ ...none, total: 2, private: 1, deleted: 1 })).toBe(
      '2 vidéos indisponibles : 1 privée, 1 supprimée.',
    )
    expect(unavailableSentence({ ...none, total: 1, deleted: 1 })).toBe('1 vidéo indisponible : 1 supprimée.')
    expect(unavailableSentence({ ...none, total: 3, blocked: 2, notEmbeddable: 1 })).toBe(
      '3 vidéos indisponibles : 1 non lisible hors YouTube, 2 bloquées en France.',
    )
  })
})

describe('isPlayable', () => {
  it('treats a video with no availability (older answer) as playable', () => {
    expect(isPlayable({ id: 'a', youtubeId: 'a', title: 'A', thumbnailUrl: null, position: 0, durationSeconds: 0 })).toBe(true)
    expect(isPlayable({ id: 'a', youtubeId: 'a', title: 'A', thumbnailUrl: null, position: 0, durationSeconds: 0, availability: 'PRIVATE' })).toBe(false)
  })
})
