import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { setProgress } from '@/services/progress.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: { findFirst: vi.fn() },
    progress: { upsert: vi.fn() },
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
