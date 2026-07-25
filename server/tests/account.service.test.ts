import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { deleteAccount, exportUserData } from '@/services/account.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), delete: vi.fn() },
  },
}))

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
      progress: [{ videoId: 'v1', completed: true, watchedSeconds: 42 }],
      notes: [{ videoId: 'v1', playlistId: null, content: '# Note', updatedAt: new Date('2026-02-02') }],
    } as never)

    const data = await exportUserData('u1')

    expect(data.profile).toMatchObject({ id: 'u1', email: 'jane@example.com', youtubeConnected: true })
    expect(data.playlists[0].videos[0]).toEqual({ youtubeId: 'v1', title: 'Intro', position: 0 })
    expect(data.progress[0]).toEqual({ videoId: 'v1', completed: true, watchedSeconds: 42 })
    expect(data.notes[0].content).toBe('# Note')
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

  it('renvoie 404 si le compte est déjà supprimé (P2025)', async () => {
    vi.mocked(prisma.user.delete).mockRejectedValue({ code: 'P2025' } as never)
    await expect(deleteAccount('u1')).rejects.toMatchObject({ status: 404 })
  })
})
