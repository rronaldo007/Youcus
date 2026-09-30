import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { deletePlaylist, getPlaylist, listPlaylists } from '@/services/playlist.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playlist: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    playlistVideo: { findMany: vi.fn() },
  },
}))

describe('playlist.service (lecture / suppression)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listPlaylists mappe _count.videos vers videoCount et filtre par owner', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      { id: 'p1', youtubeId: 'y1', title: 'T', thumbnailUrl: null, _count: { videos: 3 } },
    ] as never)
    // Progression globale (CS-70) : 3 vidéos disponibles, dont 2 vues.
    const ok = { status: 'AVAILABLE', embeddable: true, blockedRegions: null }
    vi.mocked(prisma.playlistVideo.findMany).mockResolvedValue([
      { playlistId: 'p1', video: { ...ok, progress: [{ id: 'x' }] } },
      { playlistId: 'p1', video: { ...ok, progress: [{ id: 'y' }] } },
      { playlistId: 'p1', video: { ...ok, progress: [] } },
    ] as never)

    const res = await listPlaylists('u1')

    expect(prisma.playlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'u1' } }),
    )
    expect(res).toEqual([
      { id: 'p1', youtubeId: 'y1', title: 'T', thumbnailUrl: null, videoCount: 3, completedCount: 2, availableCount: 3 },
    ])
  })

  it('getPlaylist renvoie 404 quand la playlist n\'appartient pas à l\'utilisateur', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null as never)
    await expect(getPlaylist('u1', 'pX')).rejects.toMatchObject({ status: 404 })
  })

  it('deletePlaylist scope par ownerId et renvoie 404 si rien supprimé', async () => {
    vi.mocked(prisma.playlist.deleteMany).mockResolvedValue({ count: 0 } as never)
    await expect(deletePlaylist('u1', 'pX')).rejects.toMatchObject({ status: 404 })
    expect(prisma.playlist.deleteMany).toHaveBeenCalledWith({ where: { id: 'pX', ownerId: 'u1' } })
  })

  it('deletePlaylist réussit quand une ligne est supprimée', async () => {
    vi.mocked(prisma.playlist.deleteMany).mockResolvedValue({ count: 1 } as never)
    await expect(deletePlaylist('u1', 'p1')).resolves.toBeUndefined()
  })

  it('counts only playable videos for the percentage: a deleted one never blocks 100 % (YC-13)', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      { id: 'p1', youtubeId: 'y1', title: 'T', thumbnailUrl: null, _count: { videos: 3 } },
    ] as never)
    vi.mocked(prisma.playlistVideo.findMany).mockResolvedValue([
      { playlistId: 'p1', video: { status: 'AVAILABLE', embeddable: true, blockedRegions: null, progress: [{ id: 'x' }] } },
      { playlistId: 'p1', video: { status: 'AVAILABLE', embeddable: true, blockedRegions: null, progress: [{ id: 'y' }] } },
      // Seen before it was deleted: counts neither as available nor as seen.
      { playlistId: 'p1', video: { status: 'DELETED', embeddable: false, blockedRegions: null, progress: [{ id: 'z' }] } },
    ] as never)
    const [pl] = await listPlaylists('u1')
    expect(pl).toMatchObject({ videoCount: 3, availableCount: 2, completedCount: 2 })
  })

  it('getPlaylist gives each video its availability and counts the unavailable ones by reason (YC-13)', async () => {
    const row = (id: string, video: Record<string, unknown>) => ({
      position: Number(id),
      video: {
        id, youtubeId: `y${id}`, title: `V${id}`, thumbnailUrl: null, durationSeconds: 60, progress: [],
        status: 'AVAILABLE', embeddable: true, blockedRegions: null, ...video,
      },
    })
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
      id: 'p1', youtubeId: 'PL', title: 'T', thumbnailUrl: null, description: null,
      videos: [
        row('0', {}),
        row('1', { status: 'PRIVATE' }),
        row('2', { status: 'DELETED' }),
        row('3', { embeddable: false }),
        row('4', { blockedRegions: ['DE', 'FR'] }),
        row('5', { blockedRegions: ['DE'] }),
        row('6', { status: 'UPCOMING' }),
        row('7', { status: 'LIVE' }),
      ],
    } as never)
    const pl = await getPlaylist('u1', 'p1')
    expect(pl.videos.map((v) => v.availability)).toEqual([
      'AVAILABLE', 'PRIVATE', 'DELETED', 'NOT_EMBEDDABLE', 'BLOCKED', 'AVAILABLE', 'UPCOMING', 'AVAILABLE',
    ])
    expect(pl.unavailable).toEqual({ total: 5, private: 1, deleted: 1, notEmbeddable: 1, blocked: 1, upcoming: 1 })
    expect(pl.availableCount).toBe(3)
  })

  it('getPlaylist reports no unavailable video when all can be played (YC-13)', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
      id: 'p1', youtubeId: 'PL', title: 'T', thumbnailUrl: null, description: null,
      videos: [{ position: 0, video: { id: 'a', youtubeId: 'ya', title: 'A', thumbnailUrl: null, durationSeconds: 1, progress: [], status: 'AVAILABLE', embeddable: true, blockedRegions: null } }],
    } as never)
    const pl = await getPlaylist('u1', 'p1')
    expect(pl.unavailable.total).toBe(0)
  })
})
