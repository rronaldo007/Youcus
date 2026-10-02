import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoAbout } from './VideoAbout'
import type { VideoDetail } from '@/types'

const base: VideoDetail = {
  id: 'vid1',
  youtubeId: 'g09PoiCob4Y',
  title: 'Backend Complete Course',
  thumbnailUrl: null,
  durationSeconds: 10957,
  description: 'Learn backend. Code: https://github.com/pedro/repo. Bye',
  publishedAt: '2025-12-02T13:01:32.000Z',
  categoryId: '27',
  viewCount: 319915,
  likeCount: 6713,
  status: 'AVAILABLE',
  embeddable: true,
  blockedRegions: null,
  topics: null,
  hasPaidPromotion: false,
  definition: 'hd',
  hasCaptions: false,
  syncedAt: '2026-09-29T21:15:25.739Z',
  channel: null,
  chapters: [],
}

function renderWith(video: Partial<VideoDetail>, props: { creatorNote?: string | null; playlistChannel?: string | null } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ ...base, ...video }), { status: 200 })),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <VideoAbout videoId="vid1" {...props} />
    </QueryClientProvider>,
  )
}

const text = (el: HTMLElement) => (el.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ')

describe('VideoAbout (YC-5)', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('shows the facts YouTube gave and a link to YouTube (YC-76: the design\'s wording)', async () => {
    renderWith({})
    const card = await screen.findByRole('region', { name: 'À propos de la vidéo' })
    expect(text(card)).toContain('319,9 k vues')
    expect(text(card)).toContain('Publiée le 2 décembre 2025')
    expect(text(card)).toContain('3:02:37')
    expect(text(card)).toContain('6,7 k')
    expect(screen.getByRole('link', { name: 'Voir sur YouTube' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=g09PoiCob4Y',
    )
  })

  it('leaves out the likes pill when the uploader hides likes, instead of showing 0', async () => {
    renderWith({ likeCount: null })
    const card = await screen.findByRole('region', { name: 'À propos de la vidéo' })
    expect(screen.queryByLabelText("j'aime")).toBeNull()
    expect(text(card)).not.toMatch(/\b0 ♥/)
  })

  it('turns http(s) addresses into safe links, trailing punctuation left out', async () => {
    renderWith({})
    const link = await screen.findByRole('link', { name: 'https://github.com/pedro/repo' })
    expect(link).toHaveAttribute('href', 'https://github.com/pedro/repo')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('never makes a link of a javascript: address or of HTML in the text', async () => {
    renderWith({ description: 'javascript:alert(1) <img src=x onerror=alert(2)> <a href="https://evil">x</a>' })
    const card = await screen.findByRole('region', { name: 'À propos de la vidéo' })
    expect(card.querySelector('img')).toBeNull()
    const hrefs = [...card.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs.some((h) => h?.startsWith('javascript:'))).toBe(false)
    // The raw HTML is shown as text, not interpreted.
    expect(text(card)).toContain('<img src=x onerror=alert(2)>')
  })

  it('folds the description to three lines and unfolds it on « Afficher toute la description »', async () => {
    // jsdom does no layout: make the clamped paragraph report hidden content.
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(200)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(60)
    renderWith({})
    const more = await screen.findByRole('button', { name: 'Afficher toute la description' })
    const paragraph = screen.getByText(/Learn backend/)
    expect(paragraph.className).toContain('line-clamp-3')
    fireEvent.click(more)
    expect(paragraph.className).not.toContain('line-clamp-3')
    expect(screen.getByRole('button', { name: 'Afficher moins' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows no "Afficher plus" when the description fits', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(40)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(60)
    renderWith({})
    await screen.findByRole('region', { name: 'À propos de la vidéo' })
    expect(screen.queryByRole('button', { name: 'Afficher toute la description' })).toBeNull()
  })

  it('shows the playlist author\'s note and who wrote it (YC-14)', async () => {
    renderWith({}, { creatorNote: 'Revois la vidéo 3 avant celle-ci.', playlistChannel: 'JavaScript Mastery' })
    const note = await screen.findByText('Revois la vidéo 3 avant celle-ci.')
    const figure = note.closest('figure') as HTMLElement
    expect(text(figure)).toContain('Note de la playlist · JavaScript Mastery')
  })

  it('hides the note block when the author left no note', async () => {
    renderWith({}, { creatorNote: '   ', playlistChannel: 'JavaScript Mastery' })
    await screen.findByRole('region', { name: 'À propos de la vidéo' })
    expect(screen.queryByText(/Note de la playlist/)).toBeNull()
  })

  it('shows the note without a channel when the playlist channel is unknown', async () => {
    renderWith({}, { creatorNote: 'Commence ici.', playlistChannel: null })
    const figure = (await screen.findByText('Commence ici.')).closest('figure') as HTMLElement
    expect(text(figure)).toContain('Note de la playlist')
    expect(text(figure)).not.toContain('·')
  })

  it('warns that content may be dated after three years, in Education (YC-15)', async () => {
    renderWith({ publishedAt: '2019-03-12T10:00:00.000Z', categoryId: '27' })
    expect(await screen.findByText(/Publiée il y a \d+ ans : contenu peut-être daté\./)).toBeInTheDocument()
  })

  it('stays silent for a recent video or another category (YC-15)', async () => {
    renderWith({ publishedAt: '2019-03-12T10:00:00.000Z', categoryId: '10' })
    await screen.findByRole('region', { name: 'À propos de la vidéo' })
    expect(screen.queryByText(/contenu peut-être daté/)).not.toBeInTheDocument()
  })
})
