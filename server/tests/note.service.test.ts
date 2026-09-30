import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import type { NoteDoc } from '@/lib/noteDoc'
import { getPlaylistNote, getVideoNote, savePlaylistNote, saveVideoNote } from '@/services/note.service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: { findFirst: vi.fn() },
    playlist: { findFirst: vi.fn() },
    note: { findUnique: vi.fn(), upsert: vi.fn() },
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
  beforeEach(() => vi.clearAllMocks())

  it("refuse (404) d'écrire sur une vidéo non possédée", async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue(null as never)
    await expect(saveVideoNote('u1', 'v1', DOC)).rejects.toMatchObject({ status: 404 })
    expect(prisma.note.upsert).not.toHaveBeenCalled()
  })

  it('stores the document and its plain text on (authorId, videoId)', async () => {
    vi.mocked(prisma.video.findFirst).mockResolvedValue({ id: 'v1' } as never)
    vi.mocked(prisma.note.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.note.upsert).mockResolvedValue({ content: 'Note\nobjectifs', doc: DOC, updatedAt: new Date('2026-03-03') } as never)

    const res = await saveVideoNote('u1', 'v1', DOC)

    expect(res.doc).toEqual(DOC)
    expect(prisma.note.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId_videoId: { authorId: 'u1', videoId: 'v1' } },
        create: { authorId: 'u1', videoId: 'v1', doc: DOC, content: 'Note\nobjectifs' },
        update: { doc: DOC, content: 'Note\nobjectifs' },
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

describe('saving a legacy Markdown note (YC-40)', () => {
  beforeEach(() => vi.clearAllMocks())

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
  beforeEach(() => vi.clearAllMocks())

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
        create: { authorId: 'u1', playlistId: 'p1', doc: DOC, content: 'Note\nobjectifs' },
      }),
    )
  })
})
