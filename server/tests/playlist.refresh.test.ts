import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fetchPlaylist } from '@/lib/youtube'
import { refreshPlaylist } from '@/services/playlist.service'
import { optionalAccessToken } from '@/services/youtubeToken.service'
import { HttpError } from '@/middleware/errorHandler'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playlist: { findFirst: vi.fn(), update: vi.fn() },
    video: { upsert: vi.fn(), deleteMany: vi.fn() },
    channel: { upsert: vi.fn() },
    chapter: { deleteMany: vi.fn(), createMany: vi.fn() },
    playlistVideo: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/youtube', () => ({
  fetchPlaylist: vi.fn(),
  extractPlaylistId: vi.fn(),
}))

vi.mock('@/services/youtubeToken.service', () => ({ optionalAccessToken: vi.fn() }))

describe('refreshPlaylist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(optionalAccessToken).mockResolvedValue(undefined)
    // $transaction exécute le callback avec prisma comme client transactionnel.
    vi.mocked(prisma.$transaction).mockImplementation(
      async (cb: (tx: typeof prisma) => unknown) => cb(prisma),
    )
  })

  it('renvoie 404 si la playlist n\'appartient pas à l\'utilisateur', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null as never)
    await expect(refreshPlaylist('u1', 'p1')).rejects.toMatchObject({ status: 404 })
  })

  it('refuse (400) de rafraîchir une playlist fusionnée', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
      id: 'p1',
      ownerId: 'u1',
      youtubeId: 'merge:abc',
    } as never)
    await expect(refreshPlaylist('u1', 'p1')).rejects.toMatchObject({ status: 400 })
    expect(fetchPlaylist).not.toHaveBeenCalled()
  })

  it('re-fetch par youtubeId puis synchronise la jonction sans toucher aux Video (CS-70)', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
      id: 'p1',
      ownerId: 'u1',
      youtubeId: 'PL1',
    } as never)
    vi.mocked(fetchPlaylist).mockResolvedValue({
      youtubeId: 'PL1',
      title: 'Titre MAJ',
      description: null,
      thumbnailUrl: 't',
      videos: [
        { youtubeId: 'v1', title: 'V1', thumbnailUrl: null, position: 0 },
        { youtubeId: 'v2', title: 'V2', thumbnailUrl: null, position: 1 },
      ],
    } as never)
    vi.mocked(prisma.playlist.update).mockResolvedValue({
      id: 'p1',
      youtubeId: 'PL1',
      title: 'Titre MAJ',
      thumbnailUrl: 't',
    } as never)
    vi.mocked(prisma.video.upsert)
      .mockResolvedValueOnce({ id: 'vid1', youtubeId: 'v1' } as never)
      .mockResolvedValueOnce({ id: 'vid2', youtubeId: 'v2' } as never)
    vi.mocked(prisma.playlistVideo.deleteMany).mockResolvedValue({ count: 0 } as never)
    vi.mocked(prisma.playlistVideo.createMany).mockResolvedValue({ count: 2 } as never)

    const res = await refreshPlaylist('u1', 'p1')

    expect(fetchPlaylist).toHaveBeenCalledWith('PL1', undefined)
    // Les vidéos sont upsertées (partagées), jamais supprimées.
    expect(prisma.video.upsert).toHaveBeenCalledTimes(2)
    expect(prisma.video.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { youtubeId: 'v1' } }),
    )
    // NON-RÉGRESSION CS-68 : aucun deleteMany sur Video au refresh —
    // les Note et Progress qui pointent dessus survivent.
    expect(prisma.video.deleteMany).not.toHaveBeenCalled()
    // Seule la jonction est remplacée.
    expect(prisma.playlistVideo.deleteMany).toHaveBeenCalledWith({ where: { playlistId: 'p1' } })
    expect(prisma.playlistVideo.createMany).toHaveBeenCalledWith({
      data: [
        { playlistId: 'p1', videoId: 'vid1', position: 0, sourcePosition: 0, creatorNote: null, addedAt: null },
        { playlistId: 'p1', videoId: 'vid2', position: 1, sourcePosition: 1, creatorNote: null, addedAt: null },
      ],
    })
    expect(res).toMatchObject({ id: 'p1', title: 'Titre MAJ', videoCount: 2 })
  })

  it('writes the YouTube metadata: channel link, BigInt counters, null likes, sync date (YC-1)', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({ id: 'p1', ownerId: 'u1', youtubeId: 'PL1' } as never)
    vi.mocked(fetchPlaylist).mockResolvedValue({
      youtubeId: 'PL1',
      title: 'React',
      description: null,
      thumbnailUrl: null,
      itemCount: 5,
      privacyStatus: 'PUBLIC',
      channelYoutubeId: 'UC1',
      channels: [{ youtubeId: 'UC1', title: 'Fireship', handle: '@fireship', avatarUrl: null }],
      videos: [
        {
          youtubeId: 'v1',
          title: 'V1',
          thumbnailUrl: null,
          position: 0,
          creatorNote: 'Start here',
          addedAt: '2025-01-02T00:00:00Z',
          details: {
            durationSeconds: 600,
            description: 'Intro',
            channelYoutubeId: 'UC1',
            publishedAt: '2024-05-01T10:00:00Z',
            categoryId: '28',
            viewCount: 3000000000,
            likeCount: null,
            status: 'AVAILABLE',
            embeddable: true,
            blockedRegions: null,
            topics: ['t'],
            hasPaidPromotion: false,
            definition: 'hd',
            hasCaptions: true,
          },
        },
      ],
    } as never)
    vi.mocked(prisma.channel.upsert).mockResolvedValue({ id: 'ch1' } as never)
    vi.mocked(prisma.playlist.update).mockResolvedValue({ id: 'p1', youtubeId: 'PL1', title: 'React', thumbnailUrl: null } as never)
    vi.mocked(prisma.video.upsert).mockResolvedValue({ id: 'vid1' } as never)
    vi.mocked(prisma.playlistVideo.deleteMany).mockResolvedValue({ count: 0 } as never)
    vi.mocked(prisma.playlistVideo.createMany).mockResolvedValue({ count: 1 } as never)

    await refreshPlaylist('u1', 'p1')

    expect(prisma.channel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { youtubeId: 'UC1' } }),
    )
    const playlistData = vi.mocked(prisma.playlist.update).mock.calls[0][0].data
    expect(playlistData).toMatchObject({ itemCount: 5, privacyStatus: 'PUBLIC', channelId: 'ch1' })
    expect(playlistData.syncedAt).toBeInstanceOf(Date)

    const create = vi.mocked(prisma.video.upsert).mock.calls[0][0].create
    expect(create).toMatchObject({
      durationSeconds: 600,
      channelId: 'ch1',
      viewCount: 3000000000n,
      likeCount: null,
      status: 'AVAILABLE',
      topics: ['t'],
      categoryId: '28',
    })
    expect(create.publishedAt).toEqual(new Date('2024-05-01T10:00:00Z'))
    expect(create.blockedRegions).toBe(Prisma.DbNull)
    expect(create.syncedAt).toBeInstanceOf(Date)

    expect(prisma.playlistVideo.createMany).toHaveBeenCalledWith({
      data: [
        { playlistId: 'p1', videoId: 'vid1', position: 0, sourcePosition: 0, creatorNote: 'Start here', addedAt: new Date('2025-01-02T00:00:00Z') },
      ],
    })
    // No chapter list in "Intro": old chapters are cleared, none created.
    expect(prisma.chapter.deleteMany).toHaveBeenCalledWith({ where: { videoId: 'vid1' } })
    expect(prisma.chapter.createMany).not.toHaveBeenCalled()
  })

  it('rebuilds the chapters of a video from its description (YC-3)', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({ id: 'p1', ownerId: 'u1', youtubeId: 'PL1' } as never)
    vi.mocked(fetchPlaylist).mockResolvedValue({
      youtubeId: 'PL1',
      title: 'React',
      description: null,
      thumbnailUrl: null,
      videos: [
        {
          youtubeId: 'v1',
          title: 'V1',
          thumbnailUrl: null,
          position: 0,
          details: {
            durationSeconds: 600,
            description: '0:00 Intro\n1:00 Hooks\n5:00 Effects',
            channelYoutubeId: null,
            publishedAt: null,
            categoryId: null,
            viewCount: null,
            likeCount: null,
            status: 'AVAILABLE',
            embeddable: true,
            blockedRegions: null,
            topics: null,
            hasPaidPromotion: false,
            definition: null,
            hasCaptions: false,
          },
        },
      ],
    } as never)
    vi.mocked(prisma.playlist.update).mockResolvedValue({ id: 'p1', youtubeId: 'PL1', title: 'React', thumbnailUrl: null } as never)
    vi.mocked(prisma.video.upsert).mockResolvedValue({ id: 'vid1' } as never)
    vi.mocked(prisma.playlistVideo.deleteMany).mockResolvedValue({ count: 0 } as never)
    vi.mocked(prisma.playlistVideo.createMany).mockResolvedValue({ count: 1 } as never)

    await refreshPlaylist('u1', 'p1')

    expect(prisma.chapter.deleteMany).toHaveBeenCalledWith({ where: { videoId: 'vid1' } })
    expect(prisma.chapter.createMany).toHaveBeenCalledWith({
      data: [
        { videoId: 'vid1', position: 0, startSeconds: 0, title: 'Intro' },
        { videoId: 'vid1', position: 1, startSeconds: 60, title: 'Hooks' },
        { videoId: 'vid1', position: 2, startSeconds: 300, title: 'Effects' },
      ],
    })
  })

  it('keeps the known title and thumbnail of a video that became private (YC-13)', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({ id: 'p1', ownerId: 'u1', youtubeId: 'PL1' } as never)
    vi.mocked(fetchPlaylist).mockResolvedValue({
      youtubeId: 'PL1', title: 'P', description: null, thumbnailUrl: null,
      videos: [{ youtubeId: 'v1', title: 'Vidéo privée', thumbnailUrl: null, position: 0, unavailable: 'PRIVATE' }],
    } as never)
    vi.mocked(prisma.playlist.update).mockResolvedValue({ id: 'p1', youtubeId: 'PL1', title: 'P', thumbnailUrl: null } as never)
    vi.mocked(prisma.video.upsert).mockResolvedValue({ id: 'vid1' } as never)
    vi.mocked(prisma.playlistVideo.deleteMany).mockResolvedValue({ count: 0 } as never)
    vi.mocked(prisma.playlistVideo.createMany).mockResolvedValue({ count: 1 } as never)

    await refreshPlaylist('u1', 'p1')

    const args = vi.mocked(prisma.video.upsert).mock.calls[0][0]
    expect(args.update).not.toHaveProperty('title')
    expect(args.update).not.toHaveProperty('thumbnailUrl')
    // A first import still needs a title.
    expect(args.create).toMatchObject({ title: 'Vidéo privée' })
  })

  describe('private playlists (YC-30)', () => {
    const emptyPlaylist = { youtubeId: 'PLpriv', title: 'Private', description: null, thumbnailUrl: null, videos: [] }

    it("reads the playlist with the user's YouTube token when they have one", async () => {
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: 'p1',
        ownerId: 'u1',
        youtubeId: 'PLpriv',
        privacyStatus: 'PRIVATE',
      } as never)
      vi.mocked(optionalAccessToken).mockResolvedValue('user-token')
      vi.mocked(fetchPlaylist).mockResolvedValue(emptyPlaylist as never)
      vi.mocked(prisma.playlist.update).mockResolvedValue({ id: 'p1', youtubeId: 'PLpriv', title: 'Private' } as never)
      vi.mocked(prisma.playlistVideo.deleteMany).mockResolvedValue({ count: 0 } as never)
      vi.mocked(prisma.playlistVideo.createMany).mockResolvedValue({ count: 0 } as never)

      await refreshPlaylist('u1', 'p1')

      expect(optionalAccessToken).toHaveBeenCalledWith('u1')
      expect(fetchPlaylist).toHaveBeenCalledWith('PLpriv', 'user-token')
    })

    it('answers 403 on a private playlist when the account has no working YouTube token', async () => {
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: 'p1',
        ownerId: 'u1',
        youtubeId: 'PLpriv',
        privacyStatus: 'PRIVATE',
      } as never)
      vi.mocked(fetchPlaylist).mockRejectedValue(new HttpError(404, 'Playlist introuvable ou privée'))

      await expect(refreshPlaylist('u1', 'p1')).rejects.toMatchObject({ status: 403 })
      expect(fetchPlaylist).toHaveBeenCalledWith('PLpriv', undefined)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('keeps the 404 for a public playlist that no longer exists', async () => {
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: 'p1',
        ownerId: 'u1',
        youtubeId: 'PLgone',
        privacyStatus: 'PUBLIC',
      } as never)
      vi.mocked(fetchPlaylist).mockRejectedValue(new HttpError(404, 'Playlist introuvable ou privée'))

      await expect(refreshPlaylist('u1', 'p1')).rejects.toMatchObject({ status: 404 })
    })
  })
})
