import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { fetchPlaylist } from '@/lib/youtube'
import { HttpError } from '@/middleware/errorHandler'
import { refreshPlaylist } from '@/services/playlist.service'
import { optionalAccessToken } from '@/services/youtubeToken.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playlist: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    playlistVideo: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    video: { upsert: vi.fn() },
    channel: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/youtube', () => ({ fetchPlaylist: vi.fn(), extractPlaylistId: vi.fn() }))
vi.mock('@/services/youtubeToken.service', () => ({ optionalAccessToken: vi.fn() }))

/** A tiny in-memory PlaylistVideo table, so the merge is rebuilt from what the sources really hold. */
let table: { playlistId: string; videoId: string; position: number }[]
const merge = { id: 'm', youtubeId: 'merge:x', title: 'Backend', thumbnailUrl: null }
const sources = [
  { id: 'A', youtubeId: 'PLA', title: 'Backend', privacyStatus: null },
  { id: 'B', youtubeId: 'PLB', title: 'backend', privacyStatus: 'PRIVATE' },
]
const youtube: Record<string, string[]> = {}
const of = (playlistId: string) =>
  table.filter((r) => r.playlistId === playlistId).sort((a, b) => a.position - b.position).map((r) => r.videoId)

beforeEach(() => {
  vi.clearAllMocks()
  // The user put b1 first in the merge.
  table = [
    { playlistId: 'A', videoId: 'a1', position: 0 }, { playlistId: 'A', videoId: 'shared', position: 1 },
    { playlistId: 'B', videoId: 'shared', position: 0 }, { playlistId: 'B', videoId: 'b1', position: 1 },
    { playlistId: 'm', videoId: 'b1', position: 0 }, { playlistId: 'm', videoId: 'a1', position: 1 },
    { playlistId: 'm', videoId: 'shared', position: 2 },
  ]
  youtube.PLA = ['a1', 'shared']
  youtube.PLB = ['shared', 'b1']
  vi.mocked(optionalAccessToken).mockResolvedValue(undefined)
  vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: typeof prisma) => unknown) => cb(prisma))
  vi.mocked(prisma.playlist.findFirst).mockResolvedValue({ ...merge, ownerId: 'u1' } as never)
  vi.mocked(prisma.playlist.findMany).mockResolvedValue(sources as never)
  vi.mocked(prisma.playlist.update).mockImplementation((async ({ where }: { where: { id: string } }) => ({
    id: where.id, youtubeId: `PL${where.id}`, title: where.id, thumbnailUrl: null, customOrder: false,
  })) as never)
  vi.mocked(prisma.video.upsert).mockImplementation((async ({ where }: { where: { youtubeId: string } }) => ({ id: where.youtubeId })) as never)
  vi.mocked(fetchPlaylist).mockImplementation((async (id: string) => {
    if (!youtube[id]) throw new HttpError(404, 'Playlist introuvable sur YouTube')
    return { youtubeId: id, title: id, description: null, thumbnailUrl: null, videos: youtube[id].map((v, position) => ({ youtubeId: v, title: v, thumbnailUrl: null, position })) }
  }) as never)
  vi.mocked(prisma.playlistVideo.findMany).mockImplementation((async ({ where }: { where: { playlistId: string | { in: string[] } } }) => {
    const ids = typeof where.playlistId === 'string' ? [where.playlistId] : where.playlistId.in
    return table.filter((r) => ids.includes(r.playlistId)).map((r) => ({ ...r }))
  }) as never)
  vi.mocked(prisma.playlistVideo.deleteMany).mockImplementation((async ({ where }: { where: { playlistId: string; videoId?: { in: string[] } } }) => {
    table = table.filter((r) => !(r.playlistId === where.playlistId && (!where.videoId || where.videoId.in.includes(r.videoId))))
    return { count: 0 }
  }) as never)
  vi.mocked(prisma.playlistVideo.createMany).mockImplementation((async ({ data }: { data: { playlistId: string; videoId: string; position: number }[] }) => {
    table.push(...data.map(({ playlistId, videoId, position }) => ({ playlistId, videoId, position })))
    return { count: data.length }
  }) as never)
})

describe('refreshPlaylist on a merge (YC-100)', () => {
  it('refreshes every source from YouTube', async () => {
    await refreshPlaylist('u1', 'm')
    expect(vi.mocked(fetchPlaylist).mock.calls.map(([id]) => id)).toEqual(['PLA', 'PLB'])
  })

  it('keeps the merge’s order; a video new in a source goes last', async () => {
    youtube.PLB = ['shared', 'b1', 'b2']
    const res = await refreshPlaylist('u1', 'm')
    expect(of('m')).toEqual(['b1', 'a1', 'shared', 'b2'])
    expect(res.videoCount).toBe(4)
    expect(res.failedSources).toBeUndefined()
  })

  it('a video gone from EVERY source leaves the merge; one still in another source stays', async () => {
    youtube.PLA = ['a1']
    youtube.PLB = ['b1']
    await refreshPlaylist('u1', 'm')
    expect(of('m')).toEqual(['b1', 'a1'])
    youtube.PLA = ['a1', 'shared']
    youtube.PLB = []
    await refreshPlaylist('u1', 'm')
    expect(of('m')).toEqual(['a1', 'shared'])
  })

  it('a source that fails is told; it keeps its videos, the others go on', async () => {
    delete youtube.PLB
    youtube.PLA = ['a1', 'shared', 'a2']
    const res = await refreshPlaylist('u1', 'm')
    expect(res.failedSources).toEqual([
      { id: 'B', title: 'backend', message: 'Connectez votre compte YouTube pour rafraîchir cette playlist privée' },
    ])
    expect(of('B')).toEqual(['shared', 'b1'])
    expect(of('m')).toEqual(['b1', 'a1', 'shared', 'a2'])
  })
})
