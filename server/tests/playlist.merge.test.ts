import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { mergePlaylists } from '@/services/playlist.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playlist: { findMany: vi.fn(), create: vi.fn() },
    playlistVideo: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/youtube', () => ({ fetchPlaylist: vi.fn(), extractPlaylistId: vi.fn() }))

describe('mergePlaylists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$transaction).mockImplementation(
      async (cb: (tx: typeof prisma) => unknown) => cb(prisma),
    )
  })

  it('refuse (400) moins de 2 playlists', async () => {
    await expect(mergePlaylists('u1', ['a'], 'X')).rejects.toMatchObject({ status: 400 })
  })

  it('renvoie 404 si une source n\'appartient pas à l\'utilisateur', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([{ id: 'a', videos: [] }] as never)
    await expect(mergePlaylists('u1', ['a', 'b'], 'X')).rejects.toMatchObject({ status: 404 })
  })

  it('fusionne en dédupliquant les vidéos partagées par videoId (CS-70)', async () => {
    // Modèle N:N : les sources renvoient des lignes de jonction { videoId, position }.
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      {
        id: 'a',
        thumbnailUrl: 'ta',
        videos: [
          { playlistId: 'a', videoId: 'vid1', position: 0 },
          { playlistId: 'a', videoId: 'vid2', position: 1 },
        ],
      },
      {
        id: 'b',
        thumbnailUrl: null,
        videos: [
          { playlistId: 'b', videoId: 'vid2', position: 0 }, // doublon (même Video partagée)
          { playlistId: 'b', videoId: 'vid3', position: 1 },
        ],
      },
    ] as never)
    vi.mocked(prisma.playlist.create).mockResolvedValue({
      id: 'merged',
      youtubeId: 'merge:xyz',
      title: 'Fusion',
      thumbnailUrl: 'ta',
    } as never)
    vi.mocked(prisma.playlistVideo.createMany).mockResolvedValue({ count: 3 } as never)

    const res = await mergePlaylists('u1', ['a', 'b'], 'Fusion')

    expect(res.videoCount).toBe(3) // vid1, vid2, vid3 (vid2 dédupliqué)
    const createArg = vi.mocked(prisma.playlist.create).mock.calls[0][0] as { data: { youtubeId: string; ownerId: string } }
    expect(createArg.data.ownerId).toBe('u1')
    expect(createArg.data.youtubeId).toMatch(/^merge:/)
    const rowsArg = vi.mocked(prisma.playlistVideo.createMany).mock.calls[0][0] as { data: unknown[] }
    expect(rowsArg.data).toEqual([
      { playlistId: 'merged', videoId: 'vid1', position: 0 },
      { playlistId: 'merged', videoId: 'vid2', position: 1 },
      { playlistId: 'merged', videoId: 'vid3', position: 2 },
    ])
  })
})
