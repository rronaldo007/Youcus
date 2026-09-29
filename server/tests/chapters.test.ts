import { describe, expect, it } from 'vitest'
import { parseChapters } from '@/lib/chapters'

describe('parseChapters (YC-3)', () => {
  it('reads a real description: hh:mm:ss, pipe separator, text around the list', () => {
    const description = [
      'Learn everything you need to know about Backend Development!',
      'Code Repo: https://example.com/repo',
      '',
      'Timestamps:',
      '00:00:00 | Intro',
      '00:01:38 | Setup NodeJS Server',
      '00:20:38 | Routes',
      '02:22:38 | Deploying the API To Hostinger',
      '',
      '',
      'Sponsored video, thanks to our partner.',
    ].join('\n')
    expect(parseChapters(description, 10957)).toEqual([
      { position: 0, startSeconds: 0, title: 'Intro' },
      { position: 1, startSeconds: 98, title: 'Setup NodeJS Server' },
      { position: 2, startSeconds: 1238, title: 'Routes' },
      { position: 3, startSeconds: 8558, title: 'Deploying the API To Hostinger' },
    ])
  })

  it('reads the short format with dashes and bullets', () => {
    const description = '• 0:00 - Welcome\n• 1:05 - useState\n- 12:30 – useEffect\n* 45:00 useMemo'
    expect(parseChapters(description).map((c) => [c.startSeconds, c.title])).toEqual([
      [0, 'Welcome'],
      [65, 'useState'],
      [750, 'useEffect'],
      [2700, 'useMemo'],
    ])
  })

  it('reads a timestamp at the end of the line and in brackets', () => {
    const description = 'Intro (0:00)\nSetup - 2:10\n[5:00] Deploy'
    expect(parseChapters(description).map((c) => [c.startSeconds, c.title])).toEqual([
      [0, 'Intro'],
      [130, 'Setup'],
      [300, 'Deploy'],
    ])
  })

  it('returns nothing when YouTube would show nothing', () => {
    // Does not start at 0:00.
    expect(parseChapters('0:10 A\n1:00 B\n2:00 C')).toEqual([])
    // Fewer than three chapters.
    expect(parseChapters('0:00 A\n1:00 B')).toEqual([])
    // Goes backwards.
    expect(parseChapters('0:00 A\n2:00 B\n1:00 C')).toEqual([])
    // A chapter shorter than ten seconds.
    expect(parseChapters('0:00 A\n0:05 B\n1:00 C')).toEqual([])
    // No description at all.
    expect(parseChapters(null)).toEqual([])
    expect(parseChapters('')).toEqual([])
  })

  it('drops chapters past the end of the video, then checks the rules again', () => {
    expect(parseChapters('0:00 A\n1:00 B\n2:00 C\n9:00 D', 300).map((c) => c.title)).toEqual(['A', 'B', 'C'])
    // The last chapter would last under ten seconds.
    expect(parseChapters('0:00 A\n1:00 B\n2:00 C', 125)).toEqual([])
  })

  it('keeps the first complete list and ignores later timestamps', () => {
    const description = '0:00 Intro\n1:00 Part one\n2:00 Part two\n\nSee also 0:00 of my other video\n3:00 nope'
    expect(parseChapters(description).map((c) => c.title)).toEqual(['Intro', 'Part one', 'Part two'])
  })

  it('ignores a lone timestamp in prose and does not treat a URL as a chapter', () => {
    expect(parseChapters('Check https://site.com/page\nat 12:30 we talk about hooks')).toEqual([])
  })

  it('cuts titles at 191 characters', () => {
    const long = 'x'.repeat(250)
    const chapters = parseChapters(`0:00 ${long}\n1:00 B\n2:00 C`)
    expect(chapters[0].title).toHaveLength(191)
  })
})
