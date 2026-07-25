import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { fetchPlaylist } from '@/lib/youtube'
import { refreshPlaylist } from '@/services/playlist.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playlist: { findFirst: vi.fn(), update: vi.fn() },
    video: { upsert: vi.fn(), deleteMany: vi.fn() },
    playlistVideo: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/youtube', () => ({
  fetchPlaylist: vi.fn(),
  extractPlaylistId: vi.fn(),
}))

describe('refreshPlaylist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // $transaction exécute le callback avec prisma comme client transactionnel.
    vi.mocked(prisma.$transaction).mockImplementation(
      async (cb: (tx: typeof prisma) => unknown) => cb(prisma),
    )
  })

  it('renvoie 404 si la playlist n\'appartient pas à l\'utilisateur', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null as never)
    await expect(refreshPlaylist('u1', 'p1')).rejects.toMatchObject({ status: 404 })
  })

  it('refuse (400) de rafraîchir une playlist fusionnée', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
      id: 'p1',
      ownerId: 'u1',
      youtubeId: 'merge:abc',
    } as never)
    await expect(refreshPlaylist('u1', 'p1')).rejects.toMatchObject({ status: 400 })
    expect(fetchPlaylist).not.toHaveBeenCalled()
  })

  it('re-fetch par youtubeId puis synchronise la jonction sans toucher aux Video (CS-70)', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
      id: 'p1',
      ownerId: 'u1',
      youtubeId: 'PL1',
    } as never)
    vi.mocked(fetchPlaylist).mockResolvedValue({
      youtubeId: 'PL1',
      title: 'Titre MAJ',
      description: null,
      thumbnailUrl: 't',
      videos: [
        { youtubeId: 'v1', title: 'V1', thumbnailUrl: null, position: 0 },
        { youtubeId: 'v2', title: 'V2', thumbnailUrl: null, position: 1 },
      ],
    } as never)
    vi.mocked(prisma.playlist.update).mockResolvedValue({
      id: 'p1',
      youtubeId: 'PL1',
      title: 'Titre MAJ',
      thumbnailUrl: 't',
    } as never)
    vi.mocked(prisma.video.upsert)
      .mockResolvedValueOnce({ id: 'vid1', youtubeId: 'v1' } as never)
      .mockResolvedValueOnce({ id: 'vid2', youtubeId: 'v2' } as never)
    vi.mocked(prisma.playlistVideo.deleteMany).mockResolvedValue({ count: 0 } as never)
    vi.mocked(prisma.playlistVideo.createMany).mockResolvedValue({ count: 2 } as never)

    const res = await refreshPlaylist('u1', 'p1')

    expect(fetchPlaylist).toHaveBeenCalledWith('PL1')
    // Les vidéos sont upsertées (partagées), jamais supprimées.
    expect(prisma.video.upsert).toHaveBeenCalledTimes(2)
    expect(prisma.video.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { youtubeId: 'v1' } }),
    )
    // NON-RÉGRESSION CS-68 : aucun deleteMany sur Video au refresh —
    // les Note et Progress qui pointent dessus survivent.
    expect(prisma.video.deleteMany).not.toHaveBeenCalled()
    // Seule la jonction est remplacée.
    expect(prisma.playlistVideo.deleteMany).toHaveBeenCalledWith({ where: { playlistId: 'p1' } })
    expect(prisma.playlistVideo.createMany).toHaveBeenCalledWith({
      data: [
        { playlistId: 'p1', videoId: 'vid1', position: 0 },
        { playlistId: 'p1', videoId: 'vid2', position: 1 },
      ],
    })
    expect(res).toMatchObject({ id: 'p1', title: 'Titre MAJ', videoCount: 2 })
  })
})
