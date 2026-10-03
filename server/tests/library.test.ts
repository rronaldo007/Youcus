import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Videos kept on their own in the library (YC-61): the link, the YouTube read, the service,
// the access rule shared by the video, its note and its progress, and the migration.

vi.mock('@/config/env', () => ({
  env: { YOUTUBE_API_KEY: 'test-key', NODE_ENV: 'test' },
  isYouTubeConfigured: () => true,
}))

const tx = vi.hoisted(() => ({
  channel: { upsert: vi.fn() },
  video: { upsert: vi.fn() },
  chapter: { deleteMany: vi.fn(), createMany: vi.fn() },
  libraryVideo: { upsert: vi.fn() },
}))
const db = vi.hoisted(() => ({
  libraryVideo: { findMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
  video: { findFirst: vi.fn() },
  progress: { upsert: vi.fn(), findUnique: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

const { extractVideoId, fetchVideo } = await import('@/lib/youtube')
const { addLibraryVideo, getLibraryVideo, listLibraryVideos, removeLibraryVideo } = await import('@/services/library.service')
const { setProgress } = await import('@/services/progress.service')
const { accessibleBy } = await import('@/lib/videoAccess')

const ID = 'dQw4w9WgXcQ'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const videoResource = {
  id: ID,
  snippet: {
    title: 'Comprendre useEffect',
    thumbnails: { medium: { url: 'https://i.ytimg.com/vi/x/mqdefault.jpg' } },
    description: '00:00 Intro\n01:00 Suite\n05:00 Fin',
    channelId: 'UC1',
    publishedAt: '2024-01-01T00:00:00Z',
  },
  contentDetails: { duration: 'PT10M12S', caption: 'true', definition: 'hd' },
  statistics: { viewCount: '1200', likeCount: '30' },
  status: { privacyStatus: 'public', uploadStatus: 'processed', embeddable: true },
}

describe('extractVideoId (YC-61)', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', ID],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', ID],
    ['https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ', ID],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', ID],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', ID],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', ID],
    ['youtu.be/dQw4w9WgXcQ', ID],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', ID],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', ID],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', ID],
    ['https://www.youtube.com/live/dQw4w9WgXcQ?feature=share', ID],
    ['  dQw4w9WgXcQ  ', ID],
  ])('finds the video in %s', (input, expected) => {
    expect(extractVideoId(input)).toBe(expected)
  })

  it.each([
    ['https://www.youtube.com/playlist?list=PL123abc'],
    ['https://www.youtube.com/watch?v=tooShort'],
    ['https://vimeo.com/watch?v=dQw4w9WgXcQ'],
    ['https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ'],
    ['PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'],
    ['pas un lien'],
    [''],
  ])('names no video in %s', (input) => {
    expect(extractVideoId(input)).toBeNull()
  })
})

describe('fetchVideo (YC-61)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the title, thumbnail, metadata and channel of one video', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('/videos?')
        ? jsonResponse({ items: [videoResource] })
        : jsonResponse({ items: [{ id: 'UC1', snippet: { title: 'Fireship', customUrl: '@fireship' } }] }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { video, channels } = await fetchVideo(ID)
    expect(video).toMatchObject({ youtubeId: ID, title: 'Comprendre useEffect', thumbnailUrl: 'https://i.ytimg.com/vi/x/mqdefault.jpg' })
    expect(video.details).toMatchObject({ durationSeconds: 612, channelYoutubeId: 'UC1', status: 'AVAILABLE', hasCaptions: true })
    expect(channels).toEqual([{ youtubeId: 'UC1', title: 'Fireship', handle: '@fireship', avatarUrl: null }])
    expect(fetchMock.mock.calls[0][0]).toContain(`id=${ID}`)
  })

  it('a video YouTube does not serve (private, deleted) is a 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ items: [] })))
    await expect(fetchVideo(ID)).rejects.toMatchObject({ status: 404 })
  })
})

const libraryRow = (progress: { completed: boolean; watchedSeconds: number; updatedAt: Date }[] = []) => ({
  addedAt: new Date('2026-10-01T10:00:00Z'),
  video: {
    id: 'vid1',
    youtubeId: ID,
    title: 'Comprendre useEffect',
    thumbnailUrl: 't',
    durationSeconds: 612,
    status: 'AVAILABLE',
    embeddable: true,
    blockedRegions: null,
    channel: { title: 'Fireship' },
    progress,
  },
})

describe('library service (YC-61)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx))
    tx.channel.upsert.mockResolvedValue({ id: 'ch1' })
    tx.video.upsert.mockResolvedValue({ id: 'vid1' })
    tx.libraryVideo.upsert.mockResolvedValue({})
  })
  afterEach(() => vi.unstubAllGlobals())

  it('refuses a link that names no video, before any YouTube call', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(addLibraryVideo('u1', 'https://www.youtube.com/playlist?list=PL1')).rejects.toMatchObject({ status: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('adds the shared video by its YouTube id, then the entry of THIS user, once', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/videos?') ? jsonResponse({ items: [videoResource] }) : jsonResponse({ items: [{ id: 'UC1', snippet: { title: 'Fireship' } }] }),
      ),
    )
    db.libraryVideo.findFirst.mockResolvedValue(libraryRow())
    const added = await addLibraryVideo('u1', `https://youtu.be/${ID}`)

    expect(tx.video.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { youtubeId: ID },
        create: expect.objectContaining({ youtubeId: ID, title: 'Comprendre useEffect', durationSeconds: 612, channelId: 'ch1' }),
      }),
    )
    // Chapters come from the description, as for a playlist import (YC-3).
    expect(tx.chapter.createMany).toHaveBeenCalled()
    // Adding it again changes nothing: an upsert on the composite key, never a second row.
    expect(tx.libraryVideo.upsert).toHaveBeenCalledWith({
      where: { userId_videoId: { userId: 'u1', videoId: 'vid1' } },
      create: { userId: 'u1', videoId: 'vid1' },
      update: {},
    })
    expect(added).toMatchObject({ id: 'vid1', youtubeId: ID, channelTitle: 'Fireship', availability: 'AVAILABLE', completed: false })
  })

  it('lists the library of the user, the last added first, with their progress', async () => {
    const seen = new Date('2026-09-28T18:00:00Z')
    db.libraryVideo.findMany.mockResolvedValue([libraryRow([{ completed: true, watchedSeconds: 612, updatedAt: seen }])])
    const [video] = await listLibraryVideos('u1')
    expect(db.libraryVideo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1' }, orderBy: { addedAt: 'desc' } }))
    expect(video).toMatchObject({ completed: true, watchedSeconds: 612, completedAt: seen.toISOString(), addedAt: '2026-10-01T10:00:00.000Z' })
  })

  it('a video started but not seen has no completion date', async () => {
    db.libraryVideo.findMany.mockResolvedValue([libraryRow([{ completed: false, watchedSeconds: 300, updatedAt: new Date() }])])
    const [video] = await listLibraryVideos('u1')
    expect(video).toMatchObject({ completed: false, watchedSeconds: 300, completedAt: null })
  })

  it('reads one video of the library by its YouTube id, for THIS user only', async () => {
    db.libraryVideo.findFirst.mockResolvedValue(null)
    await expect(getLibraryVideo('u1', ID)).rejects.toMatchObject({ status: 404 })
    expect(db.libraryVideo.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1', video: { youtubeId: ID } } }))
  })

  it('takes a video out of the library of THIS user, 404 when it was not there', async () => {
    db.libraryVideo.deleteMany.mockResolvedValue({ count: 1 })
    await removeLibraryVideo('u1', 'vid1')
    expect(db.libraryVideo.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', videoId: 'vid1' } })
    db.libraryVideo.deleteMany.mockResolvedValue({ count: 0 })
    await expect(removeLibraryVideo('u1', 'vid1')).rejects.toMatchObject({ status: 404 })
  })
})

describe('access to a video (YC-61)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('one rule: a playlist of the user, or their library', () => {
    expect(accessibleBy('u1')).toEqual({
      OR: [{ playlists: { some: { playlist: { ownerId: 'u1' } } } }, { libraryEntries: { some: { userId: 'u1' } } }],
    })
  })

  it('the progress of a library video is saved', async () => {
    db.video.findFirst.mockResolvedValue({ id: 'vid1' })
    db.progress.upsert.mockResolvedValue({ videoId: 'vid1', completed: true, watchedSeconds: 612 })
    await setProgress('u1', { videoId: 'vid1', completed: true })
    expect(db.video.findFirst.mock.calls[0][0].where).toEqual({ id: 'vid1', ...accessibleBy('u1') })
  })

  it('with a playlist named, the progress still needs THAT playlist of the user', async () => {
    db.video.findFirst.mockResolvedValue(null)
    await expect(setProgress('u1', { videoId: 'vid1', playlistId: 'p1' })).rejects.toMatchObject({ status: 404 })
    expect(db.video.findFirst.mock.calls[0][0].where).toEqual({
      id: 'vid1',
      playlists: { some: { playlistId: 'p1', playlist: { ownerId: 'u1' } } },
    })
  })
})

describe('library migration (YC-61)', () => {
  const dir = fileURLToPath(new URL('../prisma/migrations/', import.meta.url))
  const folder = readdirSync(dir).find((name) => name.endsWith('_library_video'))
  const sql = folder ? readFileSync(`${dir}${folder}/migration.sql`, 'utf-8') : ''

  it('only adds the table, keyed by user and video', () => {
    expect(folder).toBeDefined()
    expect(sql).not.toMatch(/\bDROP\b|\bRENAME\b/i)
    expect(sql).toContain('CREATE TABLE `LibraryVideo`')
    expect(sql).toContain('PRIMARY KEY (`userId`, `videoId`)')
  })

  it('goes with the account and with the video', () => {
    expect(sql).toMatch(/LibraryVideo_userId_fkey[^;]*ON DELETE CASCADE/)
    expect(sql).toMatch(/LibraryVideo_videoId_fkey[^;]*ON DELETE CASCADE/)
  })
})
