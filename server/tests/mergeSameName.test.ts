import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { sameNameKey } from '@/lib/playlistTitle'
import { describeReport, runSameNameMerges } from '@/jobs/mergeSameName'
import { mergePlaylists } from '@/services/playlist.service'

vi.mock('@/lib/prisma', () => ({ prisma: { playlist: { findMany: vi.fn() } } }))

vi.mock('@/services/playlist.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/playlist.service')>()),
  mergePlaylists: vi.fn(),
}))

const row = (id: string, ownerId: string, title: string, videoIds: string[], extra: { youtubeId?: string; sources?: number } = {}) => ({
  id,
  ownerId,
  title,
  youtubeId: extra.youtubeId ?? `PL${id}`,
  videos: videoIds.map((videoId) => ({ videoId })),
  _count: { sources: extra.sources ?? 0 },
})

describe('sameNameKey (YC-105, shared with the import of YC-96)', () => {
  it('ignores case, surrounding spaces and runs of spaces', () => {
    expect(sameNameKey('Cours')).toBe(sameNameKey('  cours '))
    expect(sameNameKey('COURS')).toBe(sameNameKey('cours'))
    expect(sameNameKey('Back   end')).toBe(sameNameKey('back end'))
  })

  it('keeps the accents: « Résumé » is not « Resume »', () => {
    expect(sameNameKey('Résumé')).not.toBe(sameNameKey('Resume'))
    // The same accent typed two ways (composed, or e + combining accent) is the same name.
    expect(sameNameKey('Résumé')).toBe(sameNameKey('Résumé'))
  })
})

describe('runSameNameMerges (YC-105)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mergePlaylists).mockResolvedValue({} as never)
  })

  it('reads only the visible playlists, oldest first for each user', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([] as never)
    await runSameNameMerges({ apply: false })
    const args = vi.mocked(prisma.playlist.findMany).mock.calls[0][0]
    expect(args?.where).toEqual({ mergedIntoId: null })
    expect(args?.orderBy).toEqual([{ ownerId: 'asc' }, { createdAt: 'asc' }])
  })

  it('a dry run plans the merge and writes nothing', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      row('a', 'u1', 'Backend', ['v1', 'v2']),
      row('b', 'u1', ' backend', ['v2', 'v3']),
    ] as never)

    const report = await runSameNameMerges({ apply: false })

    expect(mergePlaylists).not.toHaveBeenCalled()
    expect(report.applied).toBe(false)
    expect(report.merges).toEqual([
      {
        ownerId: 'u1',
        title: 'Backend',
        into: null,
        playlists: [
          { id: 'a', title: 'Backend', videoCount: 2 },
          { id: 'b', title: ' backend', videoCount: 2 },
        ],
        // v2 is in both: it counts once.
        videoCount: 3,
      },
    ])
  })

  it('--apply merges each group, oldest first, under the oldest title', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      row('a', 'u1', 'Backend', ['v1']),
      row('b', 'u1', 'BACKEND', ['v2']),
      row('c', 'u1', 'backend', ['v3']),
    ] as never)

    await runSameNameMerges({ apply: true })

    expect(mergePlaylists).toHaveBeenCalledTimes(1)
    expect(mergePlaylists).toHaveBeenCalledWith('u1', ['a', 'b', 'c'], 'Backend')
  })

  it('never merges the playlists of two different users', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      row('a', 'u1', 'Backend', ['v1']),
      row('z', 'u2', 'Backend', ['v1']),
    ] as never)

    const report = await runSameNameMerges({ apply: true })

    expect(report.merges).toEqual([])
    expect(mergePlaylists).not.toHaveBeenCalled()
  })

  it('a merge of that name takes the others in: first, and its title is kept', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      row('a', 'u1', 'backend', ['v1']),
      row('m', 'u1', 'Backend', ['v1', 'v2'], { youtubeId: 'merge:x', sources: 2 }),
      row('c', 'u1', 'BACKEND', ['v3']),
    ] as never)

    const report = await runSameNameMerges({ apply: true })

    expect(report.merges[0]).toMatchObject({ into: 'm', title: 'Backend', videoCount: 3 })
    expect(mergePlaylists).toHaveBeenCalledWith('u1', ['m', 'a', 'c'], 'Backend')
  })

  it('leaves alone a group holding two merges, and says why', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      row('m1', 'u1', 'Backend', [], { youtubeId: 'merge:1', sources: 2 }),
      row('m2', 'u1', 'backend', [], { youtubeId: 'merge:2', sources: 2 }),
    ] as never)

    const report = await runSameNameMerges({ apply: true })

    expect(mergePlaylists).not.toHaveBeenCalled()
    expect(report.skipped).toEqual([{ ownerId: 'u1', title: 'Backend', reason: '2 fusions portent ce nom' }])
  })

  it('lists apart the merges made before YC-95, whose sources were never recorded', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      row('old', 'u1', 'Vieille fusion', ['v1', 'v2'], { youtubeId: 'merge:old', sources: 0 }),
      row('new', 'u1', 'Fusion récente', ['v1'], { youtubeId: 'merge:new', sources: 2 }),
      row('p', 'u1', 'Seule', ['v1']),
    ] as never)

    const report = await runSameNameMerges({ apply: false })

    expect(report.unknownSources).toEqual([{ id: 'old', title: 'Vieille fusion', videoCount: 2 }])
    expect(report.merges).toEqual([])
  })

  it('a group that fails is reported, the others still merge', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      row('a', 'u1', 'Backend', ['v1']),
      row('b', 'u1', 'backend', ['v2']),
      row('c', 'u1', 'Frontend', ['v3']),
      row('d', 'u1', 'frontend', ['v4']),
    ] as never)
    vi.mocked(mergePlaylists).mockRejectedValueOnce(new Error('Une de ces playlists fait déjà partie d’une fusion'))

    const report = await runSameNameMerges({ apply: true })

    expect(mergePlaylists).toHaveBeenCalledTimes(2)
    expect(report.failed).toEqual([{ ownerId: 'u1', title: 'Backend', reason: 'Une de ces playlists fait déjà partie d’une fusion' }])
  })

  it('a second pass finds nothing left to do: only the merge is visible', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      row('m', 'u1', 'Backend', ['v1', 'v2'], { youtubeId: 'merge:x', sources: 2 }),
    ] as never)

    const report = await runSameNameMerges({ apply: true })

    expect(report.merges).toEqual([])
    expect(report.unknownSources).toEqual([])
    expect(mergePlaylists).not.toHaveBeenCalled()
  })

  it('the dry run says that nothing is written, and how to write', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      row('a', 'u1', 'Backend', ['v1']),
      row('b', 'u1', 'backend', ['v2']),
    ] as never)

    const lines = describeReport(await runSameNameMerges({ apply: false }))

    expect(lines[0]).toMatch(/^ESSAI, rien n’est écrit/)
    expect(lines).toContain('    - a « Backend », 1 vidéo')
    expect(lines[1]).toMatch(/: 2 vidéos une fois fusionnées$/)
    expect(lines.at(-1)).toBe('Pour écrire : relancer avec --apply.')
  })
})
