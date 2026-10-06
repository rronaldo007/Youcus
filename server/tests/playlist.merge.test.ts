import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { mergePlaylists } from '@/services/playlist.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playlist: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    playlistVideo: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/youtube', () => ({ fetchPlaylist: vi.fn(), extractPlaylistId: vi.fn() }))

const row = (playlistId: string, videoId: string, position: number) => ({ playlistId, videoId, position })
const playlist = (id: string, videos: ReturnType<typeof row>[], extra: Record<string, unknown> = {}) => ({
  id,
  youtubeId: `PL${id}`,
  thumbnailUrl: null,
  mergedIntoId: null,
  videos,
  ...extra,
})

describe('mergePlaylists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$transaction).mockImplementation(
      async (cb: (tx: typeof prisma) => unknown) => cb(prisma),
    )
    vi.mocked(prisma.playlist.create).mockResolvedValue({
      id: 'merged',
      youtubeId: 'merge:xyz',
      title: 'Fusion',
      thumbnailUrl: 'ta',
    } as never)
    vi.mocked(prisma.playlistVideo.createMany).mockResolvedValue({ count: 0 } as never)
    vi.mocked(prisma.playlist.updateMany).mockResolvedValue({ count: 2 } as never)
  })

  it('refuse (400) moins de 2 playlists', async () => {
    await expect(mergePlaylists('u1', ['a'], 'X')).rejects.toMatchObject({ status: 400 })
  })

  it('renvoie 404 si une source n\'appartient pas à l\'utilisateur', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([playlist('a', [])] as never)
    await expect(mergePlaylists('u1', ['a', 'b'], 'X')).rejects.toMatchObject({ status: 404 })
  })

  it('fusionne en dédupliquant les vidéos partagées par videoId (CS-70)', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      playlist('a', [row('a', 'vid1', 0), row('a', 'vid2', 1)], { thumbnailUrl: 'ta' }),
      playlist('b', [row('b', 'vid2', 0), row('b', 'vid3', 1)]),
    ] as never)

    const res = await mergePlaylists('u1', ['a', 'b'], 'Fusion')

    expect(res.videoCount).toBe(3)
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

  it('garde les sources et les rattache à la fusion, qui les masque (YC-95)', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([playlist('a', []), playlist('b', [])] as never)

    await mergePlaylists('u1', ['a', 'b'], 'Fusion')

    expect(prisma.playlist.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, ownerId: 'u1' },
      data: { mergedIntoId: 'merged' },
    })
  })

  it('suit l\'ordre choisi par l\'utilisateur, pas celui de la base (YC-95)', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      playlist('a', [row('a', 'vidA', 0)]),
      playlist('b', [row('b', 'vidB', 0)]),
    ] as never)

    await mergePlaylists('u1', ['b', 'a'], 'Fusion')

    const rowsArg = vi.mocked(prisma.playlistVideo.createMany).mock.calls[0][0] as { data: { videoId: string }[] }
    expect(rowsArg.data.map((r) => r.videoId)).toEqual(['vidB', 'vidA'])
  })

  it('refuse (400) une playlist qui fait déjà partie d\'une fusion (YC-95)', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      playlist('a', []),
      playlist('b', [], { mergedIntoId: 'other' }),
    ] as never)

    await expect(mergePlaylists('u1', ['a', 'b'], 'X')).rejects.toMatchObject({ status: 400 })
    expect(prisma.playlist.updateMany).not.toHaveBeenCalled()
  })

  it('ajoute à une fusion existante au lieu d\'en créer une seconde (YC-95)', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      playlist('m', [row('m', 'vid1', 0), row('m', 'vid2', 1)], { youtubeId: 'merge:old' }),
      playlist('c', [row('c', 'vid2', 0), row('c', 'vid9', 1)]),
    ] as never)
    vi.mocked(prisma.playlist.update).mockResolvedValue({
      id: 'm',
      youtubeId: 'merge:old',
      title: 'Backend',
      thumbnailUrl: null,
    } as never)

    const res = await mergePlaylists('u1', ['c', 'm'], 'Backend')

    expect(prisma.playlist.create).not.toHaveBeenCalled()
    expect(prisma.playlist.update).toHaveBeenCalledWith({ where: { id: 'm' }, data: { title: 'Backend' } })
    // The merge keeps its videos and order; only what is new is added after them.
    const rowsArg = vi.mocked(prisma.playlistVideo.createMany).mock.calls[0][0] as { data: unknown[] }
    expect(rowsArg.data).toEqual([{ playlistId: 'm', videoId: 'vid9', position: 2 }])
    expect(prisma.playlist.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['c'] }, ownerId: 'u1' },
      data: { mergedIntoId: 'm' },
    })
    expect(res.videoCount).toBe(3)
  })

  it('refuse (400) deux fusions à la fois (YC-95)', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      playlist('m1', [], { youtubeId: 'merge:1' }),
      playlist('m2', [], { youtubeId: 'merge:2' }),
    ] as never)

    await expect(mergePlaylists('u1', ['m1', 'm2'], 'X')).rejects.toMatchObject({ status: 400 })
    expect(prisma.playlist.updateMany).not.toHaveBeenCalled()
  })
})
