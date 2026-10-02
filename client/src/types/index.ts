export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  /** Vrai si le compte a accordé l'accès YouTube (import des playlists du compte). */
  youtubeConnected?: boolean
  /** Its YouTube token died and the server erased it (YC-84): « Connexion YouTube expirée ». */
  youtubeExpired?: boolean
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
  /** Whose videos these are, under the card (YC-74); null when none or several. */
  channelTitle?: string | null
  /** The videos come from several channels: « Plusieurs chaînes » (YC-74). */
  multipleChannels?: boolean
  /** Last time one of its videos was watched or marked, for « Récentes » (YC-74). */
  lastActivityAt?: string | null
}

/** The video the dashboard offers to resume (GET /resume, YC-74). */
export interface ResumeItem {
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  watchedSeconds: number
  /** Null for a video kept on its own (YC-61). */
  playlist: { id: string; title: string; position: number; total: number } | null
}

/** Why a video cannot be played, or AVAILABLE (YC-13). */
export type Availability = 'AVAILABLE' | 'PRIVATE' | 'DELETED' | 'NOT_EMBEDDABLE' | 'BLOCKED' | 'UPCOMING'

/** A video kept on its own in the library, outside any playlist (YC-61). */
export interface LibraryVideo {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  channelTitle: string | null
  availability: Availability
  addedAt: string
  completed: boolean
  watchedSeconds: number
  /** When it was marked seen, null otherwise. */
  completedAt: string | null
}

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
  /** The playlist author's note on this video, in THIS playlist (YC-14). */
  creatorNote?: string | null
}

export interface PlaylistDetail extends Playlist {
  description: string | null
  videos: Video[]
  unavailable?: UnavailableSummary
  /** Channel that owns the playlist on YouTube, author of the creator notes (YC-14). */
  channelTitle?: string | null
  /** Whose videos these are, for the « À propos » card (YC-75). */
  contentChannel?: { title: string; avatarUrl: string | null } | null
  multipleChannels?: boolean
  privacyStatus?: 'PUBLIC' | 'UNLISTED' | 'PRIVATE' | null
  /** When the last video was added on YouTube, if YouTube said. */
  lastAddedAt?: string | null
  /** Null for a playlist merged in Youcus, which exists nowhere else. */
  youtubeUrl?: string | null
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
  /** YouTube category id, e.g. "28" for Science & Technology (YC-15). */
  categoryId: string | null
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
  /** Where the user is in the video (global per video, CS-70), for the note page (YC-77). */
  progress: { watchedSeconds: number; completed: boolean }
}
