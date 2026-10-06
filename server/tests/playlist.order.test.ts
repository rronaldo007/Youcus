import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { fetchPlaylist } from '@/lib/youtube'
import { refreshPlaylist, reorderPlaylist, resetPlaylistOrder } from '@/services/playlist.service'
import { optionalAccessToken } from '@/services/youtubeToken.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playlist: { findFirst: vi.fn(), update: vi.fn() },
    playlistVideo: { findMany: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    video: { upsert: vi.fn() },
    channel: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/youtube', () => ({ fetchPlaylist: vi.fn(), extractPlaylistId: vi.fn() }))
vi.mock('@/services/youtubeToken.service', () => ({ optionalAccessToken: vi.fn() }))

const positions = () =>
  vi.mocked(prisma.playlistVideo.update).mock.calls.map(([arg]) => {
    const a = arg as { where: { playlistId_videoId: { videoId: string } }; data: { position: number } }
    return [a.where.playlistId_videoId.videoId, a.data.position]
  })

describe('reorderPlaylist (YC-101)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: typeof prisma) => unknown) => cb(prisma))
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({ id: 'p' } as never)
    vi.mocked(prisma.playlistVideo.findMany).mockResolvedValue([{ videoId: 'a' }, { videoId: 'b' }, { videoId: 'c' }] as never)
  })

  it('writes the user’s order and marks the playlist as reordered', async () => {
    await reorderPlaylist('u1', 'p', ['c', 'a', 'b'])
    expect(positions()).toEqual([['c', 0], ['a', 1], ['b', 2]])
    expect(prisma.playlist.update).toHaveBeenCalledWith({ where: { id: 'p' }, data: { customOrder: true } })
  })

  it.each([
    ['a missing video', ['c', 'a']],
    ['an unknown video', ['c', 'a', 'z']],
    ['a video twice', ['c', 'a', 'a', 'b']],
  ])('refuses (400) a list with %s, and writes nothing', async (_, list) => {
    await expect(reorderPlaylist('u1', 'p', list)).rejects.toMatchObject({ status: 400 })
    expect(prisma.playlistVideo.update).not.toHaveBeenCalled()
    expect(prisma.playlist.update).not.toHaveBeenCalled()
  })

  it('404 for a playlist of someone else', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null as never)
    await expect(reorderPlaylist('u1', 'p', ['a', 'b', 'c'])).rejects.toMatchObject({ status: 404 })
    expect(prisma.playlist.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p', ownerId: 'u1' } }))
  })
})

describe('resetPlaylistOrder (YC-101)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: typeof prisma) => unknown) => cb(prisma))
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({ id: 'p' } as never)
  })

  it('puts the videos back in the order they came with, without asking YouTube', async () => {
    vi.mocked(prisma.playlistVideo.findMany).mockResolvedValue([
      { videoId: 'c', position: 0, sourcePosition: 2 },
      { videoId: 'a', position: 1, sourcePosition: 0 },
      { videoId: 'x', position: 2, sourcePosition: null },
      { videoId: 'b', position: 3, sourcePosition: 1 },
    ] as never)
    await resetPlaylistOrder('u1', 'p')
    expect(positions()).toEqual([['a', 0], ['b', 1], ['c', 2], ['x', 3]])
    expect(prisma.playlist.update).toHaveBeenCalledWith({ where: { id: 'p' }, data: { customOrder: false } })
    expect(fetchPlaylist).not.toHaveBeenCalled()
  })
})

describe('refreshPlaylist keeps the user’s order (YC-101)', () => {
  const youtube = (...ids: string[]) => ({
    youtubeId: 'PL1', title: 'T', description: null, thumbnailUrl: null,
    videos: ids.map((id, position) => ({ youtubeId: id, title: id, thumbnailUrl: null, position })),
  })
  const written = () =>
    (vi.mocked(prisma.playlistVideo.createMany).mock.calls[0][0] as { data: { videoId: string; position: number; sourcePosition: number }[] }).data
      .slice()
      .sort((x, y) => x.position - y.position)
      .map((r) => `${r.videoId}@${r.position}/${r.sourcePosition}`)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(optionalAccessToken).mockResolvedValue(undefined)
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: typeof prisma) => unknown) => cb(prisma))
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({ id: 'p1', ownerId: 'u1', youtubeId: 'PL1' } as never)
    vi.mocked(prisma.video.upsert).mockImplementation((async (args: { where: { youtubeId: string } }) => ({ id: args.where.youtubeId })) as never)
    // The user put c first; YouTube removed b and added d.
    vi.mocked(fetchPlaylist).mockResolvedValue(youtube('a', 'c', 'd') as never)
    vi.mocked(prisma.playlistVideo.findMany).mockResolvedValue([
      { videoId: 'c', position: 0 }, { videoId: 'a', position: 1 }, { videoId: 'b', position: 2 },
    ] as never)
  })

  it('reordered: known videos keep their place, the new one goes last; YouTube’s order is kept aside', async () => {
    vi.mocked(prisma.playlist.update).mockResolvedValue({ id: 'p1', youtubeId: 'PL1', title: 'T', thumbnailUrl: null, customOrder: true } as never)
    await refreshPlaylist('u1', 'p1')
    expect(written()).toEqual(['c@0/1', 'a@1/0', 'd@2/2'])
  })

  it('not reordered: YouTube’s order, as before', async () => {
    vi.mocked(prisma.playlist.update).mockResolvedValue({ id: 'p1', youtubeId: 'PL1', title: 'T', thumbnailUrl: null, customOrder: false } as never)
    await refreshPlaylist('u1', 'p1')
    expect(written()).toEqual(['a@0/0', 'c@1/1', 'd@2/2'])
  })
})
