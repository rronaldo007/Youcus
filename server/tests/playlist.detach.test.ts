import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { detachSource } from '@/services/playlist.service'
import { carryMergeNote } from '@/services/note.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playlist: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    playlistVideo: { findMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/services/note.service', () => ({ carryMergeNote: vi.fn() }))
vi.mock('@/lib/youtube', () => ({ fetchPlaylist: vi.fn(), extractPlaylistId: vi.fn() }))

const merge = { id: 'm', title: 'Backend', youtubeId: 'merge:x' }
const rows = (...ids: string[]) => ids.map((videoId) => ({ videoId }))

describe('detachSource (YC-97)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: typeof prisma) => unknown) => cb(prisma))
    vi.mocked(prisma.playlist.findFirst).mockImplementation((async (args: { where: { id: string } }) =>
      args.where.id === 'm' ? merge : { id: args.where.id, title: 'backend' }) as never)
    vi.mocked(prisma.playlist.findUnique).mockResolvedValue({ id: 'm', title: 'Backend', sources: [] } as never)
  })

  it('404 when the merge is not the user’s, or is not a merge', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValueOnce(null as never)
    await expect(detachSource('u1', 'm', 'a')).rejects.toMatchObject({ status: 404 })
    vi.mocked(prisma.playlist.findFirst).mockResolvedValueOnce({ ...merge, youtubeId: 'PLx' } as never)
    await expect(detachSource('u1', 'm', 'a')).rejects.toMatchObject({ status: 404 })
  })

  it('404 when the playlist is not a source of THIS merge', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValueOnce(merge as never).mockResolvedValueOnce(null as never)
    await expect(detachSource('u1', 'm', 'z')).rejects.toMatchObject({ status: 404 })
    expect(prisma.playlist.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: 'z', ownerId: 'u1', mergedIntoId: 'm' } }),
    )
  })

  it('shows the source again; the merge keeps the videos another source still brings', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([{ id: 'b' }, { id: 'c' }] as never)
    vi.mocked(prisma.playlistVideo.findMany)
      .mockResolvedValueOnce(rows('only-a', 'shared') as never)
      .mockResolvedValueOnce(rows('shared', 'only-b') as never)

    const res = await detachSource('u1', 'm', 'a')

    expect(prisma.playlist.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { mergedIntoId: null } })
    expect(prisma.playlistVideo.deleteMany).toHaveBeenCalledWith({ where: { playlistId: 'm', videoId: { in: ['only-a'] } } })
    expect(prisma.playlist.delete).not.toHaveBeenCalled()
    expect(res).toMatchObject({ detached: { id: 'a' }, dissolved: false, mergeNote: null })
    expect(res.merge).not.toBeNull()
  })

  it('removes nothing when every video of the source is also in another one', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([{ id: 'b' }, { id: 'c' }] as never)
    vi.mocked(prisma.playlistVideo.findMany)
      .mockResolvedValueOnce(rows('shared') as never)
      .mockResolvedValueOnce(rows('shared') as never)
    await detachSource('u1', 'm', 'a')
    expect(prisma.playlistVideo.deleteMany).not.toHaveBeenCalled()
  })

  it('the last but one dissolves the merge: the other source shows again, the note is carried, the merge is deleted', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([{ id: 'b' }] as never)
    vi.mocked(carryMergeNote).mockResolvedValue('moved')

    const res = await detachSource('u1', 'm', 'a')

    expect(carryMergeNote).toHaveBeenCalledWith(prisma, 'u1', merge, 'b')
    expect(prisma.playlist.updateMany).toHaveBeenCalledWith({ where: { mergedIntoId: 'm' }, data: { mergedIntoId: null } })
    expect(prisma.playlist.delete).toHaveBeenCalledWith({ where: { id: 'm' } })
    // The note is carried BEFORE the merge (and its note, by cascade) is deleted.
    expect(vi.mocked(carryMergeNote).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(prisma.playlist.delete).mock.invocationCallOrder[0],
    )
    expect(prisma.playlistVideo.deleteMany).not.toHaveBeenCalled()
    expect(res).toEqual({ detached: { id: 'a', title: 'backend' }, dissolved: true, merge: null, mergeNote: 'moved' })
  })
})
