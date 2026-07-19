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
  },
}))

describe('playlist.service (lecture / suppression)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listPlaylists mappe _count.videos vers videoCount et filtre par owner', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      { id: 'p1', youtubeId: 'y1', title: 'T', thumbnailUrl: null, _count: { videos: 3 } },
    ] as never)

    const res = await listPlaylists('u1')

    expect(prisma.playlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'u1' } }),
    )
    expect(res).toEqual([{ id: 'p1', youtubeId: 'y1', title: 'T', thumbnailUrl: null, videoCount: 3 }])
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
})
