import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from '@/lib/googleOAuth'
import { listMyPlaylists as ytListMyPlaylists } from '@/lib/youtube'
import { getValidAccessToken, listMyPlaylists } from '@/services/youtubeAccount.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    playlist: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/googleOAuth', () => ({ refreshAccessToken: vi.fn() }))
vi.mock('@/lib/youtube', () => ({
  listMyPlaylists: vi.fn(),
  fetchPlaylist: vi.fn(),
  extractPlaylistId: vi.fn(),
}))

describe('getValidAccessToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 403 si le compte n\'est pas connecté à YouTube', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ytAccessToken: null } as never)
    await expect(getValidAccessToken('u1')).rejects.toMatchObject({ status: 403 })
  })

  it('renvoie le jeton courant s\'il est encore valide', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ytAccessToken: 'tok',
      ytRefreshToken: 'r',
      ytTokenExpiry: new Date(Date.now() + 3_600_000),
    } as never)
    expect(await getValidAccessToken('u1')).toBe('tok')
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('rafraîchit le jeton expiré', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ytAccessToken: 'old',
      ytRefreshToken: 'r',
      ytTokenExpiry: new Date(Date.now() - 1000),
    } as never)
    vi.mocked(refreshAccessToken).mockResolvedValue({
      accessToken: 'new',
      expiresAt: new Date(Date.now() + 3_600_000),
    })
    expect(await getValidAccessToken('u1')).toBe('new')
    expect(refreshAccessToken).toHaveBeenCalledWith('r')
    expect(prisma.user.update).toHaveBeenCalled()
  })
})

describe('listMyPlaylists', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marque les playlists déjà importées', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ytAccessToken: 'tok',
      ytRefreshToken: 'r',
      ytTokenExpiry: new Date(Date.now() + 3_600_000),
    } as never)
    vi.mocked(ytListMyPlaylists).mockResolvedValue([
      { youtubeId: 'p1', title: 'A', thumbnailUrl: null, videoCount: 3 },
      { youtubeId: 'p2', title: 'B', thumbnailUrl: null, videoCount: 4 },
    ])
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([{ youtubeId: 'p1' }] as never)

    const res = await listMyPlaylists('u1')

    expect(res.find((p) => p.youtubeId === 'p1')?.alreadyImported).toBe(true)
    expect(res.find((p) => p.youtubeId === 'p2')?.alreadyImported).toBe(false)
  })
})
