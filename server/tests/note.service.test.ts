import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getPlaylistNote, getVideoNote, savePlaylistNote, saveVideoNote } from '@/services/note.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: { findFirst: vi.fn() },
    playlist: { findFirst: vi.fn() },
    note: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

describe('getVideoNote', () => {
  beforeEach(() => vi.clearAllMocks())

  it("renvoie 404 si la vidéo n'appartient pas à l'utilisateur", async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue(null as never)
    await expect(getVideoNote('u1', 'v1')).rejects.toMatchObject({ status: 404 })
    expect(prisma.note.findUnique).not.toHaveBeenCalled()
  })

  it('renvoie null quand aucune note existe encore', async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.note.findUnique).mockResolvedValue(null as never)
    await expect(getVideoNote('u1', 'v1')).resolves.toBeNull()
  })
})

describe('saveVideoNote', () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse (404) d'écrire sur une vidéo non possédée", async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue(null as never)
    await expect(saveVideoNote('u1', 'v1', '# Note')).rejects.toMatchObject({ status: 404 })
    expect(prisma.note.upsert).not.toHaveBeenCalled()
  })

  it('upsert la note sur (authorId, videoId)', async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.note.upsert).mockResolvedValue({ content: '# Note', updatedAt: new Date('2026-03-03') } as never)

    const res = await saveVideoNote('u1', 'v1', '# Note')

    expect(res.content).toBe('# Note')
    expect(prisma.note.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId_videoId: { authorId: 'u1', videoId: 'v1' } },
        create: { authorId: 'u1', videoId: 'v1', content: '# Note' },
        update: { content: '# Note' },
      }),
    )
  })
})

describe('getPlaylistNote', () => {
  beforeEach(() => vi.clearAllMocks())

  it("renvoie 404 si la playlist n'appartient pas à l'utilisateur", async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null as never)
    await expect(getPlaylistNote('u1', 'p1')).rejects.toMatchObject({ status: 404 })
    expect(prisma.note.findUnique).not.toHaveBeenCalled()
  })
})

describe('savePlaylistNote', () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuse (404) d'écrire sur une playlist non possédée", async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null as never)
    await expect(savePlaylistNote('u1', 'p1', '# Note')).rejects.toMatchObject({ status: 404 })
    expect(prisma.note.upsert).not.toHaveBeenCalled()
  })

  it('upsert la note sur (authorId, playlistId)', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.note.upsert).mockResolvedValue({ content: 'objectifs', updatedAt: new Date('2026-03-03') } as never)

    const res = await savePlaylistNote('u1', 'p1', 'objectifs')

    expect(res.content).toBe('objectifs')
    expect(prisma.note.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId_playlistId: { authorId: 'u1', playlistId: 'p1' } },
        create: { authorId: 'u1', playlistId: 'p1', content: 'objectifs' },
        update: { content: 'objectifs' },
      }),
    )
  })
})
