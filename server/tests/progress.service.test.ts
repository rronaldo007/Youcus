import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { setProgress } from '@/services/progress.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: { findFirst: vi.fn() },
    progress: { upsert: vi.fn(), findUnique: vi.fn() },
  },
}))

describe('setProgress', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 404 si la vidéo n\'appartient pas à une playlist de l\'utilisateur', async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue(null as never)
    await expect(
      setProgress('u1', { videoId: 'v1', playlistId: 'p1', completed: true }),
    ).rejects.toMatchObject({ status: 404 })
    expect(prisma.progress.upsert).not.toHaveBeenCalled()
  })

  it('upsert la progression sur userId+videoId (marquée vue)', async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.progress.upsert).mockResolvedValue({
      videoId: 'v1',
      completed: true,
      watchedSeconds: 0,
    } as never)

    const res = await setProgress('u1', { videoId: 'v1', playlistId: 'p1', completed: true })

    expect(res).toEqual({ videoId: 'v1', completed: true, watchedSeconds: 0 })
    expect(prisma.progress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_videoId: { userId: 'u1', videoId: 'v1' } } }),
    )
  })
})

describe('the day a video became seen (YC-79)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.progress.upsert).mockResolvedValue({ videoId: 'v1', completed: true, watchedSeconds: 0 } as never)
  })
  const sent = () => vi.mocked(prisma.progress.upsert).mock.calls[0][0] as { create: Record<string, unknown>; update: Record<string, unknown> }

  it('marked seen now: the date is set', async () => {
    vi.mocked(prisma.progress.findUnique).mockResolvedValue({ completed: false } as never)
    await setProgress('u1', { videoId: 'v1', completed: true })
    expect(sent().update.completedAt).toBeInstanceOf(Date)
    expect(sent().create.completedAt).toBeInstanceOf(Date)
  })

  it('already seen: the first date stays, sent again or not', async () => {
    vi.mocked(prisma.progress.findUnique).mockResolvedValue({ completed: true } as never)
    await setProgress('u1', { videoId: 'v1', completed: true })
    expect(sent().update).not.toHaveProperty('completedAt')
  })

  it('unmarked: the date goes', async () => {
    await setProgress('u1', { videoId: 'v1', completed: false })
    expect(sent().update.completedAt).toBeNull()
  })

  it('a position alone touches nothing of it, and reads nothing more', async () => {
    await setProgress('u1', { videoId: 'v1', watchedSeconds: 90 })
    expect(sent().update).not.toHaveProperty('completedAt')
    expect(prisma.progress.findUnique).not.toHaveBeenCalled()
  })
})
