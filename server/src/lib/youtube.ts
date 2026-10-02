import { env } from '@/config/env'
import { HttpError } from '@/middleware/errorHandler'

const API_BASE = 'https://www.googleapis.com/youtube/v3'

/** Availability of a video, same values as the Prisma VideoStatus enum. */
export type VideoAvailability = 'AVAILABLE' | 'PRIVATE' | 'DELETED' | 'BLOCKED' | 'LIVE' | 'UPCOMING'
export type PlaylistPrivacyValue = 'PUBLIC' | 'UNLISTED' | 'PRIVATE'

/**
 * Metadata from videos.list (YC-1). Dates stay ISO strings and counters plain numbers so the
 * whole playlist survives the JSON round trip of the Redis cache.
 */
export interface VideoDetails {
  durationSeconds: number
  description: string | null
  channelYoutubeId: string | null
  publishedAt: string | null
  /** snippet.categoryId, e.g. "27" (Education) or "28" (Science & Technology). */
  categoryId: string | null
  viewCount: number | null
  /** null when the uploader hides likes: never a fake 0. */
  likeCount: number | null
  status: VideoAvailability
  embeddable: boolean
  blockedRegions: string[] | null
  topics: string[] | null
  hasPaidPromotion: boolean
  definition: string | null
  hasCaptions: boolean
}

export interface YouTubeChannel {
  youtubeId: string
  title: string
  handle: string | null
  avatarUrl: string | null
}

export interface YouTubeVideo {
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  position: number
  /** Uploader note on the playlist item (playlistItems.contentDetails.note). */
  creatorNote?: string | null
  /** Date the video was added to the playlist (ISO), distinct from its publication date. */
  addedAt?: string | null
  details?: VideoDetails
  /**
   * Set when playlistItems itself says the video is gone ("Private video" / "Deleted video",
   * YC-13): YouTube hides its real title, so a title already known must not be overwritten.
   */
  unavailable?: 'PRIVATE' | 'DELETED'
}

export interface YouTubePlaylist {
  youtubeId: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  videos: YouTubeVideo[]
  /** Item count declared by YouTube; more than videos.length means private or deleted ones. */
  itemCount?: number
  privacyStatus?: PlaylistPrivacyValue | null
  channelYoutubeId?: string | null
  /** Every channel referenced by the playlist or its videos. */
  channels?: YouTubeChannel[]
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

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/**
 * The id of a video from a YouTube link (watch, youtu.be, shorts, embed, live) or a bare
 * 11-character id (YC-61); null when the input names no video. A link carrying `list=` is a
 * playlist for the import, whatever video it also points at: the caller checks that first.
 */
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (VIDEO_ID.test(trimmed)) return trimmed
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  const valid = (id: string | null | undefined) => (id && VIDEO_ID.test(id) ? id : null)
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  if (host === 'youtu.be') return valid(url.pathname.split('/')[1])
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null
  return valid(url.searchParams.get('v')) ?? valid(url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/)?.[1])
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
    return new HttpError(503, 'Quota YouTube dépassé, réessayez plus tard', 'youtube_quota')
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
  publishedAt?: string
  thumbnails?: YouTubeThumbnails
  resourceId?: { videoId?: string }
}

interface PlaylistItemResource {
  snippet?: PlaylistItemSnippet
  contentDetails?: { note?: string }
}

/** Largest batch the YouTube Data API accepts in an `id=` list, for 1 quota unit. */
export const YOUTUBE_BATCH_SIZE = 50

/** Splits a list into consecutive batches of at most `size` items. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Converts an ISO 8601 duration (PT1H2M3S, P1DT2H) to seconds. Unknown formats give 0. */
export function parseIsoDuration(iso: string | undefined | null): number {
  const match = iso?.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/)
  if (!match) return 0
  const [, days, hours, minutes, seconds] = match
  return (
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Math.floor(Number(seconds ?? 0))
  )
}

function toCount(value: string | undefined): number | null {
  if (value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

interface VideoResource {
  id: string
  snippet?: {
    title?: string
    thumbnails?: YouTubeThumbnails
    description?: string
    channelId?: string
    publishedAt?: string
    categoryId?: string
    liveBroadcastContent?: string
  }
  contentDetails?: {
    duration?: string
    definition?: string
    caption?: string
    regionRestriction?: { blocked?: string[] }
  }
  statistics?: { viewCount?: string; likeCount?: string }
  status?: { privacyStatus?: string; uploadStatus?: string; embeddable?: boolean }
  topicDetails?: { topicCategories?: string[] }
  paidProductPlacementDetails?: { hasPaidProductPlacement?: boolean }
}

/** Maps the YouTube status fields to a single availability value. */
export function toAvailability(v: VideoResource): VideoAvailability {
  const upload = v.status?.uploadStatus
  if (upload === 'deleted' || upload === 'rejected' || upload === 'failed') return 'DELETED'
  if (v.status?.privacyStatus === 'private') return 'PRIVATE'
  if (v.snippet?.liveBroadcastContent === 'live') return 'LIVE'
  if (v.snippet?.liveBroadcastContent === 'upcoming') return 'UPCOMING'
  return 'AVAILABLE'
}

function toDetails(v: VideoResource): VideoDetails {
  const description = v.snippet?.description?.trim() ? v.snippet.description : null
  const blocked = v.contentDetails?.regionRestriction?.blocked
  const topics = v.topicDetails?.topicCategories
  return {
    durationSeconds: parseIsoDuration(v.contentDetails?.duration),
    description,
    channelYoutubeId: v.snippet?.channelId ?? null,
    publishedAt: v.snippet?.publishedAt ?? null,
    categoryId: v.snippet?.categoryId ?? null,
    viewCount: toCount(v.statistics?.viewCount),
    likeCount: toCount(v.statistics?.likeCount),
    status: toAvailability(v),
    embeddable: v.status?.embeddable ?? true,
    blockedRegions: blocked && blocked.length > 0 ? blocked : null,
    topics: topics && topics.length > 0 ? topics : null,
    hasPaidPromotion: v.paidProductPlacementDetails?.hasPaidProductPlacement ?? false,
    definition: v.contentDetails?.definition ?? null,
    hasCaptions: v.contentDetails?.caption === 'true',
  }
}

/**
 * Full metadata of videos, by batches of 50 (1 quota unit each).
 * An id missing from the answer is a video YouTube no longer serves: it comes back DELETED.
 */
export async function fetchVideoDetails(
  videoIds: string[],
  accessToken?: string,
): Promise<Map<string, VideoDetails>> {
  const out = new Map<string, VideoDetails>()
  const unique = [...new Set(videoIds)]
  for (const batch of chunk(unique, YOUTUBE_BATCH_SIZE)) {
    const page = await youtubeGet(
      'videos?part=snippet,contentDetails,statistics,status,topicDetails,paidProductPlacementDetails' +
        `&id=${batch.join(',')}`,
      accessToken,
    )
    for (const item of (page.items as VideoResource[] | undefined) ?? []) {
      out.set(item.id, toDetails(item))
    }
  }
  for (const id of unique) {
    if (!out.has(id)) {
      out.set(id, {
        durationSeconds: 0,
        description: null,
        channelYoutubeId: null,
        publishedAt: null,
        categoryId: null,
        viewCount: null,
        likeCount: null,
        status: 'DELETED',
        embeddable: false,
        blockedRegions: null,
        topics: null,
        hasPaidPromotion: false,
        definition: null,
        hasCaptions: false,
      })
    }
  }
  return out
}

/**
 * One video with its full metadata and its channel, for the library (YC-61): 2 quota units.
 * The server key reads public and unlisted videos; a private one is « introuvable ».
 */
export async function fetchVideo(
  videoId: string,
  accessToken?: string,
): Promise<{ video: YouTubeVideo; channels: YouTubeChannel[] }> {
  const page = await youtubeGet(
    'videos?part=snippet,contentDetails,statistics,status,topicDetails,paidProductPlacementDetails' + `&id=${videoId}`,
    accessToken,
  )
  const item = (page.items as VideoResource[] | undefined)?.[0]
  if (!item?.snippet) throw new HttpError(404, 'Vidéo introuvable ou privée')
  const details = toDetails(item)
  const channels = details.channelYoutubeId ? await fetchChannels([details.channelYoutubeId], accessToken) : []
  return {
    video: {
      youtubeId: item.id,
      title: item.snippet.title ?? '',
      thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
      position: 0,
      details,
    },
    channels,
  }
}

interface ChannelResource {
  id: string
  snippet?: { title?: string; customUrl?: string; thumbnails?: YouTubeThumbnails }
}

/** Channels (title, @handle, avatar) by batches of 50, 1 quota unit each. */
export async function fetchChannels(channelIds: string[], accessToken?: string): Promise<YouTubeChannel[]> {
  const out: YouTubeChannel[] = []
  const unique = [...new Set(channelIds)]
  for (const batch of chunk(unique, YOUTUBE_BATCH_SIZE)) {
    const page = await youtubeGet(
      `channels?part=snippet&id=${batch.join(',')}`,
      accessToken,
    )
    for (const item of (page.items as ChannelResource[] | undefined) ?? []) {
      out.push({
        youtubeId: item.id,
        title: item.snippet?.title ?? '',
        handle: item.snippet?.customUrl ?? null,
        avatarUrl: pickThumbnail(item.snippet?.thumbnails),
      })
    }
  }
  return out
}

function toPrivacy(value: string | undefined): PlaylistPrivacyValue | null {
  if (value === 'public') return 'PUBLIC'
  if (value === 'unlisted') return 'UNLISTED'
  if (value === 'private') return 'PRIVATE'
  return null
}

/**
 * Fetches a playlist, all its videos (paginated) and their full metadata (YC-1).
 * Cost for 50 videos: about 3 quota units (playlistItems, videos, channels).
 */
export async function fetchPlaylist(playlistId: string, accessToken?: string): Promise<YouTubePlaylist> {
  const meta = await youtubeGet(`playlists?part=snippet,contentDetails,status&id=${playlistId}`, accessToken)
  const playlistItem = (
    meta.items as
      | {
          snippet?: Record<string, unknown>
          contentDetails?: { itemCount?: number }
          status?: { privacyStatus?: string }
        }[]
      | undefined
  )?.[0]
  if (!playlistItem?.snippet) {
    throw new HttpError(404, 'Playlist introuvable ou privée')
  }
  const snippet = playlistItem.snippet as {
    title: string
    description?: string
    channelId?: string
    thumbnails?: YouTubeThumbnails
  }

  const videos: YouTubeVideo[] = []
  let pageToken: string | undefined
  do {
    const page = await youtubeGet(
      `playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}` +
        (pageToken ? `&pageToken=${pageToken}` : ''),
      accessToken,
    )
    const items = (page.items as PlaylistItemResource[] | undefined) ?? []
    for (const item of items) {
      const s = item.snippet
      const videoId = s?.resourceId?.videoId
      if (!s || !videoId) continue
      // Private and deleted videos are KEPT (YC-13): the playlist must say they exist and why
      // they cannot be played, instead of silently shrinking.
      const unavailable =
        s.title === 'Private video' ? 'PRIVATE' : s.title === 'Deleted video' ? 'DELETED' : undefined
      const note = item.contentDetails?.note?.trim()
      videos.push({
        youtubeId: videoId,
        title: unavailable === 'PRIVATE' ? 'Vidéo privée' : unavailable === 'DELETED' ? 'Vidéo supprimée' : s.title,
        thumbnailUrl: unavailable ? null : pickThumbnail(s.thumbnails),
        position: s.position ?? videos.length,
        creatorNote: note ? note.slice(0, 280) : null,
        addedAt: s.publishedAt ?? null,
        ...(unavailable ? { unavailable } : {}),
      })
    }
    pageToken = page.nextPageToken as string | undefined
  } while (pageToken)

  const details = await fetchVideoDetails(
    videos.map((v) => v.youtubeId),
    accessToken,
  )
  for (const v of videos) {
    v.details = details.get(v.youtubeId)
    // videos.list does not return private videos: without the hint they would look deleted.
    if (v.details && v.unavailable === 'PRIVATE') v.details.status = 'PRIVATE'
  }

  const channelIds = [
    ...(snippet.channelId ? [snippet.channelId] : []),
    ...videos.map((v) => v.details?.channelYoutubeId).filter((id): id is string => Boolean(id)),
  ]
  const channels = channelIds.length > 0 ? await fetchChannels(channelIds, accessToken) : []

  return {
    youtubeId: playlistId,
    title: snippet.title,
    description: snippet.description?.trim() ? snippet.description : null,
    thumbnailUrl: pickThumbnail(snippet.thumbnails),
    videos,
    itemCount: playlistItem.contentDetails?.itemCount ?? videos.length,
    privacyStatus: toPrivacy(playlistItem.status?.privacyStatus),
    channelYoutubeId: snippet.channelId ?? null,
    channels,
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
