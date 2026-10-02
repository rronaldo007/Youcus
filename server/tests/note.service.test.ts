import { DEFAULT_PREFERENCES } from '@/lib/notePage'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import type { NoteDoc } from '@/lib/noteDoc'
import { getPlaylistNote, getVideoNote, listNotes, listPlaylistVideoNotes, savePlaylistNote, saveVideoNote } from '@/services/note.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: { findFirst: vi.fn() },
    playlist: { findFirst: vi.fn() },
    note: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))

const DOC: NoteDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Note' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'objectifs', marks: [{ type: 'bold' }] }] },
  ],
}

describe('getVideoNote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ notePreferences: null } as never)
  })

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

  it('returns a stored document as it is (YC-40)', async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.note.findUnique).mockResolvedValue({ content: 'Note\nobjectifs', doc: DOC, updatedAt: new Date() } as never)
    await expect(getVideoNote('u1', 'v1')).resolves.toMatchObject({ doc: DOC })
  })

  it('converts a legacy Markdown note on read, without writing it (YC-40)', async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.note.findUnique).mockResolvedValue({ content: '# Note\n\n**objectifs**', doc: null, updatedAt: new Date() } as never)
    await expect(getVideoNote('u1', 'v1')).resolves.toMatchObject({ doc: DOC })
    expect(prisma.note.upsert).not.toHaveBeenCalled()
  })
})

describe('saveVideoNote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ notePreferences: null } as never)
  })

  it("refuse (404) d'écrire sur une vidéo non possédée", async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue(null as never)
    await expect(saveVideoNote('u1', 'v1', DOC)).rejects.toMatchObject({ status: 404 })
    expect(prisma.note.upsert).not.toHaveBeenCalled()
  })

  it('stores the document and its plain text on (authorId, videoId)', async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.note.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ notePreferences: null } as never)
    vi.mocked(prisma.note.upsert).mockResolvedValue({ content: 'Note\nobjectifs', doc: DOC, updatedAt: new Date('2026-03-03') } as never)

    const res = await saveVideoNote('u1', 'v1', DOC)

    expect(res.doc).toEqual(DOC)
    // A new note starts with the account's settings, here never set: the defaults (YC-48).
    expect(prisma.note.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId_videoId: { authorId: 'u1', videoId: 'v1' } },
        create: { authorId: 'u1', videoId: 'v1', doc: DOC, content: 'Note\nobjectifs', page: DEFAULT_PREFERENCES },
        update: { doc: DOC, content: 'Note\nobjectifs' },
      }),
    )
    expect(res.page).toBeNull()
  })

  it('a new note starts with the settings of its author (YC-48)', async () => {
    const prefs = { paper: 'seyes', tint: 'sepia', margin: false, timestamps: false, font: 'lora', size: 18 }
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.note.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ notePreferences: prefs } as never)
    vi.mocked(prisma.note.upsert).mockResolvedValue({ content: 'x', doc: DOC, page: prefs, updatedAt: new Date() } as never)
    await saveVideoNote('u1', 'v1', DOC)
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }))
    expect(vi.mocked(prisma.note.upsert).mock.calls[0][0].create).toMatchObject({ page: prefs })
  })

  it('an existing note keeps its page: the settings are never read for it (YC-48)', async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.note.findUnique).mockResolvedValue({ content: 'old', doc: DOC } as never)
    vi.mocked(prisma.note.upsert).mockResolvedValue({ content: 'x', doc: DOC, page: null, updatedAt: new Date() } as never)
    await saveVideoNote('u1', 'v1', DOC)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(vi.mocked(prisma.note.upsert).mock.calls[0][0].update).not.toHaveProperty('page')
  })

  it('a page sent with a new note wins over the settings (YC-48)', async () => {
    const page = { paper: 'uni', tint: 'blanc', margin: true } as const
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.note.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.note.upsert).mockResolvedValue({ content: 'x', doc: DOC, page, updatedAt: new Date() } as never)
    await saveVideoNote('u1', 'v1', DOC, page)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(vi.mocked(prisma.note.upsert).mock.calls[0][0].create).toMatchObject({ page })
  })

  it('writes the page when one is sent, and reads it back (YC-45)', async () => {
    const page = { paper: 'points', tint: 'bleu', margin: true } as const
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.note.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.note.upsert).mockResolvedValue({ content: 'Note\nobjectifs', doc: DOC, page, updatedAt: new Date() } as never)
    const res = await saveVideoNote('u1', 'v1', DOC, page)
    expect(res.page).toEqual(page)
    expect(prisma.note.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ page }), update: expect.objectContaining({ page }) }),
    )
  })
})

describe('getPlaylistNote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ notePreferences: null } as never)
  })

  it("renvoie 404 si la playlist n'appartient pas à l'utilisateur", async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null as never)
    await expect(getPlaylistNote('u1', 'p1')).rejects.toMatchObject({ status: 404 })
    expect(prisma.note.findUnique).not.toHaveBeenCalled()
  })
})

describe('saving a legacy Markdown note (YC-40)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ notePreferences: null } as never)
  })

  it('copies the original Markdown to legacyMarkdown on its first rich save', async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.note.findUnique).mockResolvedValue({ doc: null, content: '# Note\n\n**objectifs**' } as never)
    vi.mocked(prisma.note.upsert).mockResolvedValue({ content: 'Note\nobjectifs', doc: DOC, updatedAt: new Date() } as never)

    await saveVideoNote('u1', 'v1', DOC)

    expect(prisma.note.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { doc: DOC, content: 'Note\nobjectifs', legacyMarkdown: '# Note\n\n**objectifs**' } }),
    )
  })

  it('never touches legacyMarkdown again once the note has a document', async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.note.findUnique).mockResolvedValue({ doc: { type: 'doc', content: [] }, content: '' } as never)
    vi.mocked(prisma.note.upsert).mockResolvedValue({ content: 'Note\nobjectifs', doc: DOC, updatedAt: new Date() } as never)

    await saveVideoNote('u1', 'v1', DOC)

    expect(prisma.note.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { doc: DOC, content: 'Note\nobjectifs' } }))
  })
})

describe('savePlaylistNote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ notePreferences: null } as never)
  })

  it("refuse (404) d'écrire sur une playlist non possédée", async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null as never)
    await expect(savePlaylistNote('u1', 'p1', DOC)).rejects.toMatchObject({ status: 404 })
    expect(prisma.note.upsert).not.toHaveBeenCalled()
  })

  it('stores the document and its plain text on (authorId, playlistId)', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.note.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.note.upsert).mockResolvedValue({ content: 'Note\nobjectifs', doc: DOC, updatedAt: new Date('2026-03-03') } as never)

    await savePlaylistNote('u1', 'p1', DOC)

    expect(prisma.note.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId_playlistId: { authorId: 'u1', playlistId: 'p1' } },
        create: { authorId: 'u1', playlistId: 'p1', doc: DOC, content: 'Note\nobjectifs', page: DEFAULT_PREFERENCES },
      }),
    )
  })
})

describe('listPlaylistVideoNotes (YC-77)', () => {
  beforeEach(() => vi.clearAllMocks())

  const line = (text: string, marker?: number) => ({
    type: 'paragraph',
    ...(marker === undefined ? {} : { attrs: { marker } }),
    content: [{ type: 'text', text }],
  })

  it('refuses (404) a playlist of someone else, and reads no note', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null as never)
    await expect(listPlaylistVideoNotes('u1', 'p1')).rejects.toMatchObject({ status: 404 })
    expect(prisma.note.findMany).not.toHaveBeenCalled()
  })

  it('reads only the notes of THIS user on the videos of THIS playlist', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.note.findMany).mockResolvedValue([] as never)
    await listPlaylistVideoNotes('u1', 'p1')
    expect(vi.mocked(prisma.note.findMany).mock.calls[0][0]?.where).toEqual({
      authorId: 'u1',
      video: { playlists: { some: { playlistId: 'p1' } } },
    })
  })

  it('counts the markers at any depth, and leaves out a note left empty', async () => {
    vi.mocked(prisma.playlist.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.note.findMany).mockResolvedValue([
      // Two markers on the page, one inside a list item: three.
      {
        videoId: 'v1',
        content: 'a b c',
        doc: {
          type: 'doc',
          content: [
            line('a', 65),
            line('b'),
            { type: 'bulletList', content: [{ type: 'listItem', content: [line('c', 520)] }] },
            line('d', 0),
          ],
        },
      },
      // Written, no marker.
      { videoId: 'v2', content: 'idée', doc: { type: 'doc', content: [line('idée')] } },
      // Opened then emptied: the row exists, the note does not.
      { videoId: 'v3', content: '  ', doc: { type: 'doc', content: [] } },
      // Written before the rich editor (YC-40): Markdown only, no marker can exist.
      { videoId: 'v4', content: '# Titre', doc: null },
    ] as never)

    expect(await listPlaylistVideoNotes('u1', 'p1')).toEqual([
      { videoId: 'v1', markers: 3 },
      { videoId: 'v2', markers: 0 },
      { videoId: 'v4', markers: 0 },
    ])
  })
})

describe('listNotes (YC-78)', () => {
  beforeEach(() => vi.clearAllMocks())

  const line = (text: string, marker?: number) => ({
    type: 'paragraph',
    ...(marker === undefined ? {} : { attrs: { marker } }),
    content: [{ type: 'text', text }],
  })
  const at = new Date('2026-10-02T20:00:00Z')

  it('reads only the notes of THIS user, on what they can still open, the most recent first', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValue([] as never)
    await listNotes('u1')
    const args = vi.mocked(prisma.note.findMany).mock.calls[0][0]
    expect(args?.where).toEqual({
      authorId: 'u1',
      OR: [
        { video: { OR: [{ playlists: { some: { playlist: { ownerId: 'u1' } } } }, { libraryEntries: { some: { userId: 'u1' } } }] } },
        { playlist: { ownerId: 'u1' } },
      ],
    })
    expect(args?.orderBy).toEqual({ updatedAt: 'desc' })
    // The playlists of the video are THIS user's only, not those of someone else holding it.
    expect(args?.select?.video).toMatchObject({ select: { playlists: { where: { playlist: { ownerId: 'u1' } } } } })
  })

  it('a video card: first line, three markers in time order, their count, its playlists', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValue([
      {
        id: 'n1',
        content: 'x',
        updatedAt: at,
        doc: { type: 'doc', content: [line(''), line('Après le rendu.'), line('d', 520), line('a', 65), line('c', 300), line('b', 120)] },
        video: { id: 'v1', youtubeId: 'yt1', title: 'useEffect', playlists: [{ position: 3, playlist: { id: 'p1', title: 'fullstack' } }] },
        playlist: null,
      },
    ] as never)
    const { notes, totals } = await listNotes('u1')
    expect(notes).toEqual([
      {
        id: 'n1',
        kind: 'video',
        updatedAt: at,
        excerpt: 'Après le rendu.',
        markers: [
          { seconds: 65, text: 'a' },
          { seconds: 120, text: 'b' },
          { seconds: 300, text: 'c' },
        ],
        markerCount: 4,
        video: { id: 'v1', youtubeId: 'yt1', title: 'useEffect' },
        playlists: [{ id: 'p1', title: 'fullstack', position: 3 }],
      },
    ])
    expect(totals).toEqual({ notes: 1, markers: 4, playlists: 1 })
  })

  it('a playlist note is a card too; an emptied note is none; playlists are counted once', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValue([
      {
        id: 'n2',
        content: 'Objectif',
        updatedAt: at,
        doc: { type: 'doc', content: [line('Objectif')] },
        video: null,
        playlist: { id: 'p1', title: 'fullstack', _count: { videos: 17 } },
      },
      { id: 'n3', content: '   ', updatedAt: at, doc: { type: 'doc', content: [] }, video: { id: 'v2', youtubeId: 'yt2', title: 'vide', playlists: [] }, playlist: null },
      {
        id: 'n4',
        content: 'seule',
        updatedAt: at,
        doc: { type: 'doc', content: [line('seule', 10)] },
        video: { id: 'v3', youtubeId: 'yt3', title: 'Vidéo seule', playlists: [{ position: 0, playlist: { id: 'p1', title: 'fullstack' } }, { position: 2, playlist: { id: 'p2', title: 'games' } }] },
        playlist: null,
      },
    ] as never)
    const { notes, totals } = await listNotes('u1')
    expect(notes.map((n) => n.id)).toEqual(['n2', 'n4'])
    expect(notes[0]).toMatchObject({ kind: 'playlist', excerpt: 'Objectif', playlist: { id: 'p1', title: 'fullstack', videoCount: 17 } })
    expect(totals).toEqual({ notes: 2, markers: 1, playlists: 2 })
  })

  it('a note written before the rich editor (YC-40) is read from its Markdown', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValue([
      { id: 'n5', content: '# Titre\nla suite', updatedAt: at, doc: null, video: { id: 'v1', youtubeId: 'yt1', title: 't', playlists: [] }, playlist: null },
    ] as never)
    const { notes } = await listNotes('u1')
    expect(notes[0]).toMatchObject({ excerpt: 'Titre', markerCount: 0, playlists: [] })
  })
})
