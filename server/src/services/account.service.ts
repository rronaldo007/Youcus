import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'
import { markdownToDoc } from '@/lib/markdownToDoc'
import type { NoteDoc } from '@/lib/noteDoc'
import { deleteUserImageFiles } from '@/services/noteImage.service'

/** Données personnelles exportées (RGPD) — sans les jetons OAuth (sensibles). */
export interface AccountExport {
  exportedAt: string
  profile: {
    id: string
    email: string
    displayName: string
    avatarUrl: string | null
    createdAt: Date
    youtubeConnected: boolean
    /** Starting settings of new notes (YC-48); null = never set. */
    notePreferences: unknown
  }
  playlists: {
    youtubeId: string
    title: string
    description: string | null
    videos: { youtubeId: string; title: string; position: number }[]
  }[]
  progress: { videoId: string; completed: boolean; watchedSeconds: number }[]
  /** Videos kept on their own, outside any playlist (YC-61). */
  libraryVideos: { videoId: string; youtubeId: string; title: string; addedAt: Date }[]
  /** Images of the notes (YC-50): what was stored, not the files themselves. */
  noteImages: { id: string; name: string | null; width: number; height: number; bytes: number; createdAt: Date }[]
  // `doc` is the rich-editor document (YC-40); `content` its plain text, or the legacy Markdown.
  notes: { videoId: string | null; playlistId: string | null; content: string; doc: NoteDoc; legacyMarkdown: string | null; updatedAt: Date }[]
}

/**
 * Rassemble toutes les données personnelles de l'utilisateur pour l'export RGPD.
 * Exclut volontairement les jetons OAuth YouTube (secrets) ; expose juste un booléen.
 */
export async function exportUserData(userId: string): Promise<AccountExport> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      playlists: {
        include: {
          videos: { orderBy: { position: 'asc' }, include: { video: true } },
        },
      },
      progress: true,
      notes: true,
      libraryVideos: { orderBy: { addedAt: 'asc' }, include: { video: { select: { youtubeId: true, title: true } } } },
      noteImages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!user) throw new HttpError(404, 'Compte introuvable')

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      youtubeConnected: Boolean(user.ytAccessToken),
      notePreferences: user.notePreferences ?? null,
    },
    playlists: user.playlists.map((p) => ({
      youtubeId: p.youtubeId,
      title: p.title,
      description: p.description,
      videos: p.videos.map((pv) => ({
        youtubeId: pv.video.youtubeId,
        title: pv.video.title,
        position: pv.position,
      })),
    })),
    progress: user.progress.map((pr) => ({
      videoId: pr.videoId,
      completed: pr.completed,
      watchedSeconds: pr.watchedSeconds,
    })),
    libraryVideos: user.libraryVideos.map((lv) => ({
      videoId: lv.videoId,
      youtubeId: lv.video.youtubeId,
      title: lv.video.title,
      addedAt: lv.addedAt,
    })),
    noteImages: user.noteImages.map((i) => ({
      id: i.id,
      name: i.name,
      width: i.width,
      height: i.height,
      bytes: i.bytes,
      createdAt: i.createdAt,
    })),
    notes: user.notes.map((n) => ({
      videoId: n.videoId,
      playlistId: n.playlistId,
      content: n.content,
      doc: n.doc ? (n.doc as unknown as NoteDoc) : markdownToDoc(n.content),
      legacyMarkdown: n.legacyMarkdown,
      updatedAt: n.updatedAt,
    })),
  }
}

/**
 * Supprime définitivement le compte et toutes les données liées.
 * Les relations (playlists, vidéos, progression, notes, bibliothèque, images) tombent en cascade (onDelete: Cascade).
 */
export async function deleteAccount(userId: string): Promise<void> {
  // The image files are not in the database: they leave the bucket first (YC-50).
  await deleteUserImageFiles(userId)
  try {
    await prisma.user.delete({ where: { id: userId } })
  } catch (err) {
    // P2025 = enregistrement à supprimer introuvable.
    if ((err as { code?: string }).code === 'P2025') {
      throw new HttpError(404, 'Compte introuvable')
    }
    throw err
  }
}
