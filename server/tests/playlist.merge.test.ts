import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { mergePlaylists } from '@/services/playlist.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playlist: { findMany: vi.fn(), create: vi.fn() },
    video: { deleteMany: vi.fn(), createMany: vi.fn() },
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

  it('fusionne en dédupliquant les vidéos par youtubeId', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      {
        id: 'a',
        thumbnailUrl: 'ta',
        videos: [
          { youtubeId: 'v1', title: 'V1', thumbnailUrl: null, position: 0 },
          { youtubeId: 'v2', title: 'V2', thumbnailUrl: null, position: 1 },
        ],
      },
      {
        id: 'b',
        thumbnailUrl: null,
        videos: [
          { youtubeId: 'v2', title: 'V2b', thumbnailUrl: null, position: 0 }, // doublon
          { youtubeId: 'v3', title: 'V3', thumbnailUrl: null, position: 1 },
        ],
      },
    ] as never)
    vi.mocked(prisma.playlist.create).mockResolvedValue({
      id: 'merged',
      youtubeId: 'merge:xyz',
      title: 'Fusion',
      thumbnailUrl: 'ta',
    } as never)
    vi.mocked(prisma.video.deleteMany).mockResolvedValue({ count: 0 } as never)
    vi.mocked(prisma.video.createMany).mockResolvedValue({ count: 3 } as never)

    const res = await mergePlaylists('u1', ['a', 'b'], 'Fusion')

    expect(res.videoCount).toBe(3) // v1, v2, v3 (v2 dédupliqué)
    const createArg = vi.mocked(prisma.playlist.create).mock.calls[0][0] as { data: { youtubeId: string; ownerId: string } }
    expect(createArg.data.ownerId).toBe('u1')
    expect(createArg.data.youtubeId).toMatch(/^merge:/)
    const videosArg = vi.mocked(prisma.video.createMany).mock.calls[0][0] as { data: unknown[] }
    expect(videosArg.data).toHaveLength(3)
  })
})
