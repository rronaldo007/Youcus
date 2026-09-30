import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'
import { markdownToDoc } from '@/lib/markdownToDoc'
import type { NoteDoc } from '@/lib/noteDoc'

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
  }
  playlists: {
    youtubeId: string
    title: string
    description: string | null
    videos: { youtubeId: string; title: string; position: number }[]
  }[]
  progress: { videoId: string; completed: boolean; watchedSeconds: number }[]
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
 * Les relations (playlists, vidéos, progression, notes) tombent en cascade (onDelete: Cascade).
 */
export async function deleteAccount(userId: string): Promise<void> {
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
