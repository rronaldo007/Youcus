import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractPlaylistId, fetchPlaylist } from '@/lib/youtube'

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
        return jsonResponse({}, 404)
      }),
    )

    const result = await fetchPlaylist('PL123abc')

    expect(result.title).toBe('Ma playlist')
    expect(result.thumbnailUrl).toBe('thumb')
    expect(result.videos.map((v) => v.youtubeId)).toEqual(['v1', 'v2']) // "Private video" ignorée
    expect(result.videos[0]).toMatchObject({ title: 'V1', thumbnailUrl: 't1', position: 0 })
  })

  it('renvoie une erreur 404 si la playlist est introuvable ou privée', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ items: [] })))
    await expect(fetchPlaylist('PLmissing')).rejects.toMatchObject({ status: 404 })
  })
})
