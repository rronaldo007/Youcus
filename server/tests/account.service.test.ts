import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { deleteAccount, exportUserData } from '@/services/account.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), delete: vi.fn() },
    noteImage: { findMany: vi.fn(async () => []) },
  },
}))
// The image files leave the bucket before the account (YC-50).
const deleteObject = vi.hoisted(() => vi.fn())
vi.mock('@/lib/imageStorage', () => ({ deleteObject, getObject: vi.fn(), putObject: vi.fn() }))

describe('exportUserData', () => {
  beforeEach(() => vi.clearAllMocks())

  it("renvoie 404 si l'utilisateur n'existe pas", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never)
    await expect(exportUserData('u1')).rejects.toMatchObject({ status: 404 })
  })

  it('agrège les données personnelles sans exposer les jetons OAuth', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'jane@example.com',
      displayName: 'Jane',
      avatarUrl: null,
      createdAt: new Date('2026-01-01'),
      ytAccessToken: 'SECRET-TOKEN',
      playlists: [
        {
          youtubeId: 'PL1',
          title: 'Cours',
          description: null,
          // Modèle N:N (CS-70) : la position vient de la jonction, la vidéo est imbriquée.
          videos: [{ position: 0, video: { youtubeId: 'v1', title: 'Intro' } }],
        },
      ],
      progress: [{ videoId: 'v1', completed: true, watchedSeconds: 42, completedAt: new Date('2026-10-03T12:00:00Z') }],
      studyDays: [{ day: new Date('2026-10-03T00:00:00Z'), seconds: 900 }],
      notes: [{ videoId: 'v1', playlistId: null, content: '# Note', updatedAt: new Date('2026-02-02') }],
      libraryVideos: [{ videoId: 'v2', addedAt: new Date('2026-10-01'), video: { youtubeId: 'yt2', title: 'Seule' } }],
      noteImages: [{ id: 'img1', key: 'notes/u1/img1.webp', name: 'schema.png', width: 800, height: 600, bytes: 42000, createdAt: new Date('2026-10-01') }],
    } as never)

    const data = await exportUserData('u1')

    expect(data.profile).toMatchObject({ id: 'u1', email: 'jane@example.com', youtubeConnected: true })
    expect(data.playlists[0].videos[0]).toEqual({ youtubeId: 'v1', title: 'Intro', position: 0 })
    expect(data.progress[0]).toEqual({ videoId: 'v1', completed: true, watchedSeconds: 42, completedAt: new Date('2026-10-03T12:00:00Z') })
    // The study log is personal data too (YC-79): every day, as the user's calendar day.
    expect(data.studyDays).toEqual([{ day: '2026-10-03', seconds: 900 }])
    expect(data.notes[0].content).toBe('# Note')
    // Videos kept on their own are personal data too (YC-61).
    expect(data.libraryVideos).toEqual([{ videoId: 'v2', youtubeId: 'yt2', title: 'Seule', addedAt: new Date('2026-10-01') }])
    // What was stored, never where: the bucket key stays on the server.
    expect(data.noteImages).toEqual([{ id: 'img1', name: 'schema.png', width: 800, height: 600, bytes: 42000, createdAt: new Date('2026-10-01') }])
    expect(JSON.stringify(data)).not.toContain('notes/u1/')
    // Aucune fuite de jeton OAuth dans l'export.
    expect(JSON.stringify(data)).not.toContain('SECRET-TOKEN')
  })
})

describe('deleteAccount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('supprime le compte (les relations tombent en cascade)', async () => {
    vi.mocked(prisma.user.delete).mockResolvedValue({ id: 'u1' } as never)
    await deleteAccount('u1')
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
  })

  it("retire d'abord les fichiers d'images du stockage, puis le compte (YC-50)", async () => {
    vi.mocked(prisma.noteImage.findMany).mockResolvedValue([{ key: 'notes/u1/a.webp' }, { key: 'notes/u1/b.webp' }] as never)
    deleteObject.mockRejectedValueOnce(new Error('down'))
    vi.mocked(prisma.user.delete).mockResolvedValue({ id: 'u1' } as never)
    await deleteAccount('u1')
    // A file that fails is logged, the next one is still removed, the account still goes.
    expect(deleteObject.mock.calls.map((c) => c[0])).toEqual(['notes/u1/a.webp', 'notes/u1/b.webp'])
    expect(prisma.noteImage.findMany).toHaveBeenCalledWith({ where: { userId: 'u1' }, select: { key: true } })
    expect(prisma.user.delete).toHaveBeenCalled()
  })

  it('renvoie 404 si le compte est déjà supprimé (P2025)', async () => {
    vi.mocked(prisma.user.delete).mockRejectedValue({ code: 'P2025' } as never)
    await expect(deleteAccount('u1')).rejects.toMatchObject({ status: 404 })
  })
})
