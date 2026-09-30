import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { fetchChannels, fetchVideoDetails } from '@/lib/youtube'
import { refreshStaleVideos } from '@/jobs/refreshMetadata'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: { findMany: vi.fn(), update: vi.fn() },
    channel: { upsert: vi.fn() },
    chapter: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/youtube', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/youtube')>()
  return { ...real, fetchVideoDetails: vi.fn(), fetchChannels: vi.fn() }
})

const available = {
  durationSeconds: 600,
  description: '0:00 Intro\n1:00 Hooks\n5:00 Effects',
  channelYoutubeId: 'UC1',
  publishedAt: '2024-05-01T10:00:00Z',
  viewCount: 1200,
  likeCount: null,
  status: 'AVAILABLE' as const,
  embeddable: true,
  blockedRegions: null,
  topics: null,
  hasPaidPromotion: false,
  definition: 'hd',
  hasCaptions: false,
}
const gone = { ...available, durationSeconds: 0, description: null, channelYoutubeId: null, publishedAt: null, viewCount: null, status: 'DELETED' as const, embeddable: false, definition: null }

describe('refreshStaleVideos (YC-8)', () => {
  const now = new Date('2026-09-30T02:00:00Z')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: typeof prisma) => unknown) => cb(prisma))
    vi.mocked(prisma.channel.upsert).mockResolvedValue({ id: 'ch1' } as never)
  })

  it('picks videos never synced or synced more than 30 days ago, oldest first', async () => {
    vi.mocked(prisma.video.findMany).mockResolvedValue([] as never)
    await refreshStaleVideos({ now, maxVideos: 10 })
    expect(prisma.video.findMany).toHaveBeenCalledWith({
      where: { OR: [{ syncedAt: null }, { syncedAt: { lt: new Date('2026-08-31T02:00:00Z') } }] },
      orderBy: { syncedAt: 'asc' },
      take: 10,
      select: { id: true, youtubeId: true },
    })
    expect(fetchVideoDetails).not.toHaveBeenCalled()
  })

  it('refreshes by batches of 50: 51 videos cost 2 calls', async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({ id: `id${i}`, youtubeId: `yt${i}` }))
    vi.mocked(prisma.video.findMany).mockResolvedValue(rows as never)
    vi.mocked(fetchVideoDetails).mockImplementation(async (ids) => new Map(ids.map((id) => [id, available])))
    vi.mocked(fetchChannels).mockResolvedValue([{ youtubeId: 'UC1', title: 'C', handle: null, avatarUrl: null }])

    const report = await refreshStaleVideos({ now })

    expect(fetchVideoDetails).toHaveBeenCalledTimes(2)
    expect(vi.mocked(fetchVideoDetails).mock.calls[0][0]).toHaveLength(50)
    expect(report).toEqual({ checked: 51, refreshed: 51, unavailable: 0, quotaUnits: 4 })
  })

  it('writes the metadata, the sync date, the channel and rebuilds the chapters', async () => {
    vi.mocked(prisma.video.findMany).mockResolvedValue([{ id: 'id1', youtubeId: 'yt1' }] as never)
    vi.mocked(fetchVideoDetails).mockResolvedValue(new Map([['yt1', available]]))
    vi.mocked(fetchChannels).mockResolvedValue([{ youtubeId: 'UC1', title: 'C', handle: null, avatarUrl: null }])

    await refreshStaleVideos({ now })

    const data = vi.mocked(prisma.video.update).mock.calls[0][0].data
    expect(data).toMatchObject({ durationSeconds: 600, channelId: 'ch1', viewCount: 1200n, likeCount: null, syncedAt: now })
    expect(prisma.chapter.deleteMany).toHaveBeenCalledWith({ where: { videoId: 'id1' } })
    expect(prisma.chapter.createMany).toHaveBeenCalled()
  })

  it('wipes the API data of a video YouTube no longer serves (30-day policy)', async () => {
    vi.mocked(prisma.video.findMany).mockResolvedValue([{ id: 'id1', youtubeId: 'yt1' }] as never)
    vi.mocked(fetchVideoDetails).mockResolvedValue(new Map([['yt1', gone]]))

    const report = await refreshStaleVideos({ now })

    expect(fetchChannels).not.toHaveBeenCalled()
    const data = vi.mocked(prisma.video.update).mock.calls[0][0].data
    expect(data).toMatchObject({ description: null, viewCount: null, likeCount: null, publishedAt: null, status: 'DELETED', syncedAt: now })
    // Chapters come from the description: gone with it.
    expect(prisma.chapter.deleteMany).toHaveBeenCalledWith({ where: { videoId: 'id1' } })
    expect(prisma.chapter.createMany).not.toHaveBeenCalled()
    expect(report).toMatchObject({ refreshed: 0, unavailable: 1 })
  })
})
