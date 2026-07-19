import { env } from '@/config/env'
import { HttpError } from '@/middleware/errorHandler'

const API_BASE = 'https://www.googleapis.com/youtube/v3'

export interface YouTubeVideo {
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  position: number
}

export interface YouTubePlaylist {
  youtubeId: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  videos: YouTubeVideo[]
}

/** Extrait l'identifiant de playlist d'une URL YouTube (paramètre `list`) ou d'un ID brut. */
export function extractPlaylistId(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) throw new HttpError(400, 'Identifiant ou URL de playlist manquant')

  const listMatch = trimmed.match(/[?&]list=([A-Za-z0-9_-]+)/)
  if (listMatch) return listMatch[1]

  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed

  throw new HttpError(400, 'URL ou identifiant de playlist invalide')
}

interface YouTubeThumbnails {
  default?: { url: string }
  medium?: { url: string }
  high?: { url: string }
}

function pickThumbnail(thumbnails?: YouTubeThumbnails): string | null {
  return thumbnails?.medium?.url ?? thumbnails?.high?.url ?? thumbnails?.default?.url ?? null
}

function mapYouTubeError(status: number, body: unknown): HttpError {
  const message =
    (body as { error?: { message?: string } })?.error?.message ?? `statut ${status}`
  if (status === 403 && /quota/i.test(message)) {
    return new HttpError(503, 'Quota YouTube dépassé, réessayez plus tard')
  }
  if (status === 404) return new HttpError(404, 'Playlist introuvable')
  return new HttpError(502, `Erreur de l'API YouTube : ${message}`)
}

/**
 * Appelle l'API YouTube. Avec `accessToken` (OAuth utilisateur) → accès aux playlists privées ;
 * sinon utilise la clé API serveur (public / non répertorié uniquement).
 */
async function youtubeGet(path: string, accessToken?: string): Promise<Record<string, unknown>> {
  let url = `${API_BASE}/${path}`
  const init: RequestInit = {}
  if (accessToken) {
    init.headers = { Authorization: `Bearer ${accessToken}` }
  } else {
    const key = env.YOUTUBE_API_KEY
    if (!key) throw new HttpError(503, 'Import YouTube non configuré sur le serveur')
    url += (path.includes('?') ? '&' : '?') + `key=${key}`
  }
  const res = await fetch(url, init)
  const body = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw mapYouTubeError(res.status, body)
  return body
}

interface PlaylistItemSnippet {
  title: string
  position?: number
  thumbnails?: YouTubeThumbnails
  resourceId?: { videoId?: string }
}

/** Récupère une playlist et toutes ses vidéos via la YouTube Data API v3 (avec pagination). */
export async function fetchPlaylist(playlistId: string, accessToken?: string): Promise<YouTubePlaylist> {
  const meta = await youtubeGet(`playlists?part=snippet&id=${playlistId}`, accessToken)
  const playlistItem = (meta.items as { snippet?: Record<string, unknown> }[] | undefined)?.[0]
  if (!playlistItem?.snippet) {
    throw new HttpError(404, 'Playlist introuvable ou privée')
  }
  const snippet = playlistItem.snippet as {
    title: string
    description?: string
    thumbnails?: YouTubeThumbnails
  }

  const videos: YouTubeVideo[] = []
  let pageToken: string | undefined
  do {
    const page = await youtubeGet(
      `playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}` +
        (pageToken ? `&pageToken=${pageToken}` : ''),
      accessToken,
    )
    const items = (page.items as { snippet?: PlaylistItemSnippet }[] | undefined) ?? []
    for (const item of items) {
      const s = item.snippet
      const videoId = s?.resourceId?.videoId
      // Ignore les vidéos privées / supprimées (pas de videoId exploitable).
      if (!s || !videoId || s.title === 'Private video' || s.title === 'Deleted video') continue
      videos.push({
        youtubeId: videoId,
        title: s.title,
        thumbnailUrl: pickThumbnail(s.thumbnails),
        position: s.position ?? videos.length,
      })
    }
    pageToken = page.nextPageToken as string | undefined
  } while (pageToken)

  return {
    youtubeId: playlistId,
    title: snippet.title,
    description: snippet.description?.trim() ? snippet.description : null,
    thumbnailUrl: pickThumbnail(snippet.thumbnails),
    videos,
  }
}

export interface MyPlaylist {
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  videoCount: number
}

/** Liste les playlists du compte de l'utilisateur (mine=true), avec le jeton OAuth. */
export async function listMyPlaylists(accessToken: string): Promise<MyPlaylist[]> {
  const out: MyPlaylist[] = []
  let pageToken: string | undefined
  do {
    const page = await youtubeGet(
      `playlists?part=snippet,contentDetails&mine=true&maxResults=50` +
        (pageToken ? `&pageToken=${pageToken}` : ''),
      accessToken,
    )
    const items =
      (page.items as
        | { id: string; snippet?: { title?: string; thumbnails?: YouTubeThumbnails }; contentDetails?: { itemCount?: number } }[]
        | undefined) ?? []
    for (const it of items) {
      out.push({
        youtubeId: it.id,
        title: it.snippet?.title ?? '(sans titre)',
        thumbnailUrl: pickThumbnail(it.snippet?.thumbnails),
        videoCount: it.contentDetails?.itemCount ?? 0,
      })
    }
    pageToken = page.nextPageToken as string | undefined
  } while (pageToken)
  return out
}
