import { afterEach, describe, expect, it, vi } from 'vitest'

// Rend le test indépendant de l'environnement (pas de .env en CI).
vi.mock('@/config/env', () => ({
  env: { YOUTUBE_API_KEY: 'test-key', NODE_ENV: 'test' },
  isYouTubeConfigured: () => true,
}))

const { chunk, extractPlaylistId, fetchChannels, fetchPlaylist, fetchVideoDetails, parseIsoDuration } = await import(
  '@/lib/youtube'
)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('extractPlaylistId', () => {
  it('extrait le list= d\'une URL de playlist', () => {
    expect(extractPlaylistId('https://www.youtube.com/playlist?list=PL123abc')).toBe('PL123abc')
  })
  it('extrait le list= d\'une URL de vidéo', () => {
    expect(extractPlaylistId('https://www.youtube.com/watch?v=xyz&list=PL456def')).toBe('PL456def')
  })
  it('accepte un identifiant brut', () => {
    expect(extractPlaylistId('PL789ghi')).toBe('PL789ghi')
  })
  it('rejette une entrée invalide', () => {
    expect(() => extractPlaylistId('   ')).toThrow()
    expect(() => extractPlaylistId('not a valid id!!')).toThrow()
  })
})

describe('fetchPlaylist', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('récupère la playlist et ses vidéos (pagination, vidéos privées ignorées)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/playlists?')) {
          return jsonResponse({
            items: [{ snippet: { title: 'Ma playlist', description: 'desc', thumbnails: { medium: { url: 'thumb' } } } }],
          })
        }
        if (url.includes('/playlistItems?') && url.includes('pageToken=PAGE2')) {
          return jsonResponse({
            items: [{ snippet: { title: 'V2', position: 2, resourceId: { videoId: 'v2' } } }],
          })
        }
        if (url.includes('/playlistItems?')) {
          return jsonResponse({
            items: [
              { snippet: { title: 'V1', position: 0, resourceId: { videoId: 'v1' }, thumbnails: { medium: { url: 't1' } } } },
              { snippet: { title: 'Private video', position: 1, resourceId: { videoId: 'vp' } } },
            ],
            nextPageToken: 'PAGE2',
          })
        }
        if (url.includes('/videos?')) return jsonResponse({ items: [] })
        return jsonResponse({}, 404)
      }),
    )

    const result = await fetchPlaylist('PL123abc')

    expect(result.title).toBe('Ma playlist')
    expect(result.thumbnailUrl).toBe('thumb')
    // "Private video" is kept, marked private, with no thumbnail (YC-13).
    expect(result.videos.map((v) => v.youtubeId)).toEqual(['v1', 'vp', 'v2'])
    expect(result.videos[1]).toMatchObject({ unavailable: 'PRIVATE', title: 'Vidéo privée', thumbnailUrl: null })
    expect(result.videos[0]).toMatchObject({ title: 'V1', thumbnailUrl: 't1', position: 0 })
  })

  it('renvoie une erreur 404 si la playlist est introuvable ou privée', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ items: [] })))
    await expect(fetchPlaylist('PLmissing')).rejects.toMatchObject({ status: 404 })
  })
})

describe('parseIsoDuration (YC-1)', () => {
  it('converts the YouTube ISO 8601 durations to seconds', () => {
    expect(parseIsoDuration('PT14M32S')).toBe(872)
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723)
    expect(parseIsoDuration('PT45S')).toBe(45)
    expect(parseIsoDuration('PT2H')).toBe(7200)
    expect(parseIsoDuration('P1DT2H')).toBe(93600)
  })
  it('gives 0 for a live stream (P0D) or an unknown format', () => {
    expect(parseIsoDuration('P0D')).toBe(0)
    expect(parseIsoDuration('')).toBe(0)
    expect(parseIsoDuration(undefined)).toBe(0)
    expect(parseIsoDuration('14:32')).toBe(0)
  })
})

describe('chunk', () => {
  it('splits into batches of at most n', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 50)).toEqual([])
  })
})

describe('fetchVideoDetails (YC-1)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('asks 50 ids per call: 51 videos cost 2 calls', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url)
        return jsonResponse({ items: [] })
      }),
    )
    const ids = Array.from({ length: 51 }, (_, i) => `v${i}`)
    await fetchVideoDetails(ids)
    expect(calls).toHaveLength(2)
    expect(decodeURIComponent(calls[0]).match(/id=([^&]+)/)?.[1].split(',')).toHaveLength(50)
    expect(calls[0]).not.toContain('maxResults')
  })

  it('maps metadata, keeps hidden likes null and reads the availability', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          items: [
            {
              id: 'ok',
              snippet: { description: 'Intro', channelId: 'UC1', publishedAt: '2024-05-01T10:00:00Z', liveBroadcastContent: 'none' },
              contentDetails: { duration: 'PT10M', definition: 'hd', caption: 'true', regionRestriction: { blocked: ['FR'] } },
              statistics: { viewCount: '3000000000' },
              status: { privacyStatus: 'public', uploadStatus: 'processed', embeddable: false },
              topicDetails: { topicCategories: ['https://en.wikipedia.org/wiki/Technology'] },
              paidProductPlacementDetails: { hasPaidProductPlacement: true },
            },
            { id: 'live', snippet: { liveBroadcastContent: 'live' }, status: { privacyStatus: 'public' } },
            { id: 'priv', status: { privacyStatus: 'private' } },
          ],
        }),
      ),
    )
    const details = await fetchVideoDetails(['ok', 'live', 'priv', 'gone'])

    expect(details.get('ok')).toEqual({
      durationSeconds: 600,
      description: 'Intro',
      channelYoutubeId: 'UC1',
      publishedAt: '2024-05-01T10:00:00Z',
      viewCount: 3000000000,
      likeCount: null,
      status: 'AVAILABLE',
      embeddable: false,
      blockedRegions: ['FR'],
      topics: ['https://en.wikipedia.org/wiki/Technology'],
      hasPaidPromotion: true,
      definition: 'hd',
      hasCaptions: true,
    })
    expect(details.get('live')?.status).toBe('LIVE')
    expect(details.get('priv')?.status).toBe('PRIVATE')
    // Asked for but not returned: YouTube no longer serves it.
    expect(details.get('gone')?.status).toBe('DELETED')
  })
})

describe('fetchChannels (YC-1)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('asks each channel once and reads the @handle and avatar', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        items: [{ id: 'UC1', snippet: { title: 'Fireship', customUrl: '@fireship', thumbnails: { medium: { url: 'a' } } } }],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const channels = await fetchChannels(['UC1', 'UC1'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('id=UC1&')
    expect(channels).toEqual([{ youtubeId: 'UC1', title: 'Fireship', handle: '@fireship', avatarUrl: 'a' }])
  })
})

describe('fetchPlaylist with metadata (YC-1)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('attaches details, creator note, added date, item count, privacy and channels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/playlists?')) {
          return jsonResponse({
            items: [
              {
                snippet: { title: 'React', channelId: 'UCowner' },
                contentDetails: { itemCount: 3 },
                status: { privacyStatus: 'unlisted' },
              },
            ],
          })
        }
        if (url.includes('/playlistItems?')) {
          return jsonResponse({
            items: [
              {
                snippet: { title: 'Hooks', position: 0, publishedAt: '2025-01-02T00:00:00Z', resourceId: { videoId: 'v1' } },
                contentDetails: { note: '  Start here  ' },
              },
            ],
          })
        }
        if (url.includes('/videos?')) {
          return jsonResponse({
            items: [{ id: 'v1', snippet: { channelId: 'UCvideo' }, contentDetails: { duration: 'PT5M' }, status: {} }],
          })
        }
        if (url.includes('/channels?')) {
          return jsonResponse({ items: [{ id: 'UCowner', snippet: { title: 'Owner' } }, { id: 'UCvideo', snippet: { title: 'Author' } }] })
        }
        return jsonResponse({}, 404)
      }),
    )
    const pl = await fetchPlaylist('PLx')

    expect(pl).toMatchObject({ itemCount: 3, privacyStatus: 'UNLISTED', channelYoutubeId: 'UCowner' })
    expect(pl.videos[0]).toMatchObject({ creatorNote: 'Start here', addedAt: '2025-01-02T00:00:00Z' })
    expect(pl.videos[0].details).toMatchObject({ durationSeconds: 300, channelYoutubeId: 'UCvideo' })
    expect(pl.channels?.map((c) => c.youtubeId).sort()).toEqual(['UCowner', 'UCvideo'])
  })
})

describe('fetchPlaylist with unavailable items (YC-13)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps private and deleted items, and a private video is not taken for a deleted one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/playlists?')) return jsonResponse({ items: [{ snippet: { title: 'P' }, contentDetails: { itemCount: 3 } }] })
        if (url.includes('/playlistItems?')) {
          return jsonResponse({
            items: [
              { snippet: { title: 'Ok', position: 0, resourceId: { videoId: 'ok' } } },
              { snippet: { title: 'Private video', position: 1, resourceId: { videoId: 'priv' } } },
              { snippet: { title: 'Deleted video', position: 2, resourceId: { videoId: 'del' } } },
            ],
          })
        }
        // videos.list returns neither the private nor the deleted one.
        if (url.includes('/videos?')) return jsonResponse({ items: [{ id: 'ok', contentDetails: { duration: 'PT1M' }, status: {} }] })
        return jsonResponse({ items: [] })
      }),
    )
    const pl = await fetchPlaylist('PL')
    expect(pl.videos.map((v) => [v.youtubeId, v.unavailable, v.details?.status])).toEqual([
      ['ok', undefined, 'AVAILABLE'],
      ['priv', 'PRIVATE', 'PRIVATE'],
      ['del', 'DELETED', 'DELETED'],
    ])
    expect(pl.videos[2].title).toBe('Vidéo supprimée')
  })
})
