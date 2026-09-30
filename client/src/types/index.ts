export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  /** Vrai si le compte a accordé l'accès YouTube (import des playlists du compte). */
  youtubeConnected?: boolean
}

export interface Playlist {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  videoCount: number
  completedCount?: number
  /** Playable videos: the progress percentage is counted on these only (YC-13). */
  availableCount?: number
}

/** Why a video cannot be played, or AVAILABLE (YC-13). */
export type Availability = 'AVAILABLE' | 'PRIVATE' | 'DELETED' | 'NOT_EMBEDDABLE' | 'BLOCKED' | 'UPCOMING'

export interface UnavailableSummary {
  total: number
  private: number
  deleted: number
  notEmbeddable: number
  blocked: number
  upcoming: number
}

export interface Video {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  position: number
  durationSeconds: number
  completed?: boolean
  watchedSeconds?: number
  /** Absent in old answers and in tests: treated as AVAILABLE. */
  availability?: Availability
}

export interface PlaylistDetail extends Playlist {
  description: string | null
  videos: Video[]
  unavailable?: UnavailableSummary
}

export type VideoStatus = 'AVAILABLE' | 'PRIVATE' | 'DELETED' | 'BLOCKED' | 'LIVE' | 'UPCOMING'

export interface VideoChapter {
  position: number
  startSeconds: number
  title: string
}

/** GET /api/videos/:id (YC-4): one video with its YouTube metadata and chapters. */
export interface VideoDetail {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  description: string | null
  publishedAt: string | null
  viewCount: number | null
  /** null when the uploader hides likes. */
  likeCount: number | null
  status: VideoStatus
  embeddable: boolean
  blockedRegions: string[] | null
  topics: string[] | null
  hasPaidPromotion: boolean
  definition: string | null
  hasCaptions: boolean
  /** When the counters were read: dated snapshots, not live values. */
  syncedAt: string | null
  channel: { youtubeId: string; title: string; handle: string | null; avatarUrl: string | null } | null
  chapters: VideoChapter[]
}
