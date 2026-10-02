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
    playlistVideo: { findMany: vi.fn() },
  },
}))

describe('playlist.service (lecture / suppression)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listPlaylists mappe _count.videos vers videoCount et filtre par owner', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      { id: 'p1', youtubeId: 'y1', title: 'T', thumbnailUrl: null, _count: { videos: 3 } },
    ] as never)
    // Progression globale (CS-70) : 3 vidéos disponibles, dont 2 vues.
    const ok = { status: 'AVAILABLE', embeddable: true, blockedRegions: null }
    vi.mocked(prisma.playlistVideo.findMany).mockResolvedValue([
      { playlistId: 'p1', video: { ...ok, progress: [{ completed: true, updatedAt: new Date('2026-10-01T10:00:00Z') }] } },
      { playlistId: 'p1', video: { ...ok, progress: [{ completed: true, updatedAt: new Date('2026-10-01T10:00:00Z') }] } },
      { playlistId: 'p1', video: { ...ok, progress: [] } },
    ] as never)

    const res = await listPlaylists('u1')

    expect(prisma.playlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'u1' } }),
    )
    expect(res).toEqual([
      {
        id: 'p1', youtubeId: 'y1', title: 'T', thumbnailUrl: null, videoCount: 3, completedCount: 2, availableCount: 3,
        channelTitle: null, multipleChannels: false, lastActivityAt: '2026-10-01T10:00:00.000Z',
      },
    ])
  })

  it('gives the channel under the card, and the last activity for « Récentes » (YC-74)', async () => {
    const ok = { status: 'AVAILABLE', embeddable: true, blockedRegions: null }
    const at = (d: string) => new Date(d)
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      { id: 'own', youtubeId: 'y1', title: 'A', thumbnailUrl: null, channel: { title: 'Grafikart.fr' }, _count: { videos: 1 } },
      { id: 'one', youtubeId: 'y2', title: 'B', thumbnailUrl: null, channel: null, _count: { videos: 2 } },
      // Saved by the user: the playlist is on THEIR channel, the videos are not.
      { id: 'many', youtubeId: 'y3', title: 'C', thumbnailUrl: null, channel: { title: 'ronaldo rukundo' }, _count: { videos: 2 } },
      { id: 'none', youtubeId: 'y4', title: 'D', thumbnailUrl: null, channel: null, _count: { videos: 0 } },
    ] as never)
    vi.mocked(prisma.playlistVideo.findMany).mockResolvedValue([
      // The playlist's own channel only stands in when no video names one.
      { playlistId: 'own', video: { ...ok, channel: null, progress: [] } },
      // Started but not finished: it still dates the playlist.
      { playlistId: 'one', video: { ...ok, channel: { title: 'Fireship' }, progress: [{ completed: false, updatedAt: at('2026-10-01T08:00:00Z') }] } },
      // Watched before it was deleted on YouTube: still the latest activity.
      { playlistId: 'one', video: { status: 'DELETED', embeddable: false, blockedRegions: null, channel: { title: 'Fireship' }, progress: [{ completed: true, updatedAt: at('2026-10-02T08:00:00Z') }] } },
      { playlistId: 'many', video: { ...ok, channel: { title: 'Fireship' }, progress: [] } },
      { playlistId: 'many', video: { ...ok, channel: { title: 'freeCodeCamp' }, progress: [] } },
    ] as never)

    const byId = Object.fromEntries((await listPlaylists('u1')).map((p) => [p.id, p]))

    expect(byId.own).toMatchObject({ channelTitle: 'Grafikart.fr', multipleChannels: false, lastActivityAt: null })
    expect(byId.one).toMatchObject({ channelTitle: 'Fireship', multipleChannels: false, lastActivityAt: '2026-10-02T08:00:00.000Z', completedCount: 0 })
    expect(byId.many).toMatchObject({ channelTitle: null, multipleChannels: true })
    expect(byId.none).toMatchObject({ channelTitle: null, multipleChannels: false, lastActivityAt: null })
  })

  it('getPlaylist renvoie 404 quand la playlist n\'appartient pas à l\'utilisateur', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null as never)
    await expect(getPlaylist('u1', 'pX')).rejects.toMatchObject({ status: 404 })
  })

  it('describes the playlist for the « À propos » card (YC-75)', async () => {
    const ok = { status: 'AVAILABLE', embeddable: true, blockedRegions: null, progress: [], thumbnailUrl: null, durationSeconds: 60 }
    const jsm = { title: 'JavaScript Mastery', avatarUrl: 'https://yt3/jsm.jpg' }
    const base = {
      id: 'p1', youtubeId: 'PLabc', title: 'fullstack', thumbnailUrl: null, description: null, privacyStatus: 'PUBLIC',
      // Saved by the user: the playlist is on THEIR channel.
      channel: { title: 'ronaldo rukundo', avatarUrl: null },
    }
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
      ...base,
      videos: [
        { position: 0, creatorNote: null, addedAt: new Date('2026-09-01T10:00:00Z'), video: { ...ok, id: 'a', youtubeId: 'ya', title: 'A', channel: jsm } },
        { position: 1, creatorNote: null, addedAt: new Date('2026-09-02T10:00:00Z'), video: { ...ok, id: 'b', youtubeId: 'yb', title: 'B', channel: jsm } },
        { position: 2, creatorNote: null, addedAt: null, video: { ...ok, id: 'c', youtubeId: 'yc', title: 'C', channel: null } },
      ],
    } as never)
    expect(await getPlaylist('u1', 'p1')).toMatchObject({
      channelTitle: 'ronaldo rukundo',
      contentChannel: jsm,
      multipleChannels: false,
      privacyStatus: 'PUBLIC',
      lastAddedAt: '2026-09-02T10:00:00.000Z',
      youtubeUrl: 'https://www.youtube.com/playlist?list=PLabc',
    })
  })

  it('a merged playlist has several channels and no page on YouTube (YC-75)', async () => {
    const ok = { status: 'AVAILABLE', embeddable: true, blockedRegions: null, progress: [], thumbnailUrl: null, durationSeconds: 60 }
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
      id: 'p2', youtubeId: 'merge:1234', title: 'Backend', thumbnailUrl: null, description: null, privacyStatus: null, channel: null,
      videos: [
        { position: 0, creatorNote: null, addedAt: null, video: { ...ok, id: 'a', youtubeId: 'ya', title: 'A', channel: { title: 'Fireship', avatarUrl: null } } },
        { position: 1, creatorNote: null, addedAt: null, video: { ...ok, id: 'b', youtubeId: 'yb', title: 'B', channel: { title: 'freeCodeCamp', avatarUrl: null } } },
      ],
    } as never)
    expect(await getPlaylist('u1', 'p2')).toMatchObject({
      contentChannel: null, multipleChannels: true, privacyStatus: null, lastAddedAt: null, youtubeUrl: null,
    })
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

  it('counts only playable videos for the percentage: a deleted one never blocks 100 % (YC-13)', async () => {
    vi.mocked(prisma.playlist.findMany).mockResolvedValue([
      { id: 'p1', youtubeId: 'y1', title: 'T', thumbnailUrl: null, _count: { videos: 3 } },
    ] as never)
    vi.mocked(prisma.playlistVideo.findMany).mockResolvedValue([
      { playlistId: 'p1', video: { status: 'AVAILABLE', embeddable: true, blockedRegions: null, progress: [{ completed: true, updatedAt: new Date('2026-10-01T10:00:00Z') }] } },
      { playlistId: 'p1', video: { status: 'AVAILABLE', embeddable: true, blockedRegions: null, progress: [{ completed: true, updatedAt: new Date('2026-10-01T10:00:00Z') }] } },
      // Seen before it was deleted: counts neither as available nor as seen.
      { playlistId: 'p1', video: { status: 'DELETED', embeddable: false, blockedRegions: null, progress: [{ completed: true, updatedAt: new Date('2026-10-01T10:00:00Z') }] } },
    ] as never)
    const [pl] = await listPlaylists('u1')
    expect(pl).toMatchObject({ videoCount: 3, availableCount: 2, completedCount: 2 })
  })

  it('getPlaylist gives each video its availability and counts the unavailable ones by reason (YC-13)', async () => {
    const row = (id: string, video: Record<string, unknown>) => ({
      position: Number(id),
      video: {
        id, youtubeId: `y${id}`, title: `V${id}`, thumbnailUrl: null, durationSeconds: 60, progress: [],
        status: 'AVAILABLE', embeddable: true, blockedRegions: null, ...video,
      },
    })
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
      id: 'p1', youtubeId: 'PL', title: 'T', thumbnailUrl: null, description: null,
      videos: [
        row('0', {}),
        row('1', { status: 'PRIVATE' }),
        row('2', { status: 'DELETED' }),
        row('3', { embeddable: false }),
        row('4', { blockedRegions: ['DE', 'FR'] }),
        row('5', { blockedRegions: ['DE'] }),
        row('6', { status: 'UPCOMING' }),
        row('7', { status: 'LIVE' }),
      ],
    } as never)
    const pl = await getPlaylist('u1', 'p1')
    expect(pl.videos.map((v) => v.availability)).toEqual([
      'AVAILABLE', 'PRIVATE', 'DELETED', 'NOT_EMBEDDABLE', 'BLOCKED', 'AVAILABLE', 'UPCOMING', 'AVAILABLE',
    ])
    expect(pl.unavailable).toEqual({ total: 5, private: 1, deleted: 1, notEmbeddable: 1, blocked: 1, upcoming: 1 })
    expect(pl.availableCount).toBe(3)
  })

  it('getPlaylist reports no unavailable video when all can be played (YC-13)', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
      id: 'p1', youtubeId: 'PL', title: 'T', thumbnailUrl: null, description: null,
      videos: [{ position: 0, video: { id: 'a', youtubeId: 'ya', title: 'A', thumbnailUrl: null, durationSeconds: 1, progress: [], status: 'AVAILABLE', embeddable: true, blockedRegions: null } }],
    } as never)
    const pl = await getPlaylist('u1', 'p1')
    expect(pl.unavailable.total).toBe(0)
  })

  it('getPlaylist gives each video the creator note of THIS playlist, and the playlist channel (YC-14)', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
      id: 'p1', youtubeId: 'PL', title: 'T', thumbnailUrl: null, description: null,
      channel: { title: 'JavaScript Mastery' },
      videos: [
        { position: 0, creatorNote: 'Revois la vidéo 3 avant celle-ci.', video: { id: 'a', youtubeId: 'ya', title: 'A', thumbnailUrl: null, durationSeconds: 1, progress: [], status: 'AVAILABLE', embeddable: true, blockedRegions: null } },
        { position: 1, creatorNote: null, video: { id: 'b', youtubeId: 'yb', title: 'B', thumbnailUrl: null, durationSeconds: 1, progress: [], status: 'AVAILABLE', embeddable: true, blockedRegions: null } },
      ],
    } as never)
    const pl = await getPlaylist('u1', 'p1')
    expect(pl.channelTitle).toBe('JavaScript Mastery')
    expect(pl.videos.map((v) => v.creatorNote)).toEqual(['Revois la vidéo 3 avant celle-ci.', null])
  })
})
