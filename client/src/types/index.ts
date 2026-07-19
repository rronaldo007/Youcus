export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
}

export interface Playlist {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  videoCount: number
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
}

export interface PlaylistDetail extends Playlist {
  description: string | null
  videos: Video[]
}
