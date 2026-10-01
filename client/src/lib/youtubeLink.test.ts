import { describe, expect, it } from 'vitest'
import { isVideoLink, videoIdOf } from './youtubeLink'

const ID = 'dQw4w9WgXcQ'

describe('videoIdOf (YC-61, same rule as the server)', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `youtu.be/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    ` ${ID} `,
  ])('finds the video in %s', (input) => {
    expect(videoIdOf(input)).toBe(ID)
  })

  it.each(['https://www.youtube.com/playlist?list=PL1', 'https://vimeo.com/watch?v=dQw4w9WgXcQ', 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf', 'pas un lien'])(
    'names no video in %s',
    (input) => {
      expect(videoIdOf(input)).toBeNull()
    },
  )
})

describe('isVideoLink', () => {
  it('a video link is a video', () => {
    expect(isVideoLink(`https://youtu.be/${ID}`)).toBe(true)
  })

  it('a video shared inside a playlist is the playlist', () => {
    expect(isVideoLink(`https://www.youtube.com/watch?v=${ID}&list=PL1`)).toBe(false)
  })

  it('a playlist link or id is a playlist', () => {
    expect(isVideoLink('https://www.youtube.com/playlist?list=PL1')).toBe(false)
    expect(isVideoLink('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe(false)
  })
})
