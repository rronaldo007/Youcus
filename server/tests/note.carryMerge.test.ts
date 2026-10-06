import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { appendNoteDoc, carryMergeNote } from '@/services/note.service'
import type { NoteDoc } from '@/lib/noteDoc'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const doc = (...texts: string[]): NoteDoc => ({ type: 'doc', content: texts.map(para) as NoteDoc['content'] })
const stored = (id: string, d: NoteDoc) => ({ id, doc: d, content: '', page: null, updatedAt: new Date() })

function tx(notes: Record<string, ReturnType<typeof stored> | null>) {
  return {
    note: {
      findUnique: vi.fn(async ({ where }: { where: { authorId_playlistId: { playlistId: string } } }) =>
        notes[where.authorId_playlistId.playlistId] ?? null),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
}

describe('appendNoteDoc (YC-97)', () => {
  it('keeps the base, then a heading naming the added note, then the added note', () => {
    expect(appendNoteDoc(doc('mine'), doc('merged'), 'Note de la fusion « Backend »')).toEqual({
      type: 'doc',
      content: [
        para('mine'),
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Note de la fusion « Backend »' }] },
        para('merged'),
      ],
    })
  })
})

describe('carryMergeNote (YC-97, decision of Ronaldo 06/10)', () => {
  const merge = { id: 'm', title: 'Backend' }

  it('nothing to carry when the merge has no note', async () => {
    const t = tx({ m: null, b: stored('nb', doc('mine')) })
    expect(await carryMergeNote(t as unknown as Prisma.TransactionClient, 'u1', merge, 'b')).toBeNull()
    expect(t.note.update).not.toHaveBeenCalled()
  })

  it('moves the merge’s note onto the playlist that stays when it has none', async () => {
    const t = tx({ m: stored('nm', doc('merged')), b: null })
    expect(await carryMergeNote(t as unknown as Prisma.TransactionClient, 'u1', merge, 'b')).toBe('moved')
    expect(t.note.update).toHaveBeenCalledWith({ where: { id: 'nm' }, data: { playlistId: 'b' } })
    expect(t.note.delete).not.toHaveBeenCalled()
  })

  it('adds the merge’s note BELOW the one that stays, never dropping either', async () => {
    const t = tx({ m: stored('nm', doc('merged')), b: stored('nb', doc('mine')) })
    expect(await carryMergeNote(t as unknown as Prisma.TransactionClient, 'u1', merge, 'b')).toBe('appended')
    const written = t.note.update.mock.calls[0][0] as { where: { id: string }; data: { doc: NoteDoc; content: string } }
    expect(written.where).toEqual({ id: 'nb' })
    expect(written.data.doc.content.map((n) => n.type)).toEqual(['paragraph', 'heading', 'paragraph'])
    expect(written.data.content).toContain('mine')
    expect(written.data.content).toContain('Note de la fusion « Backend »')
    expect(written.data.content).toContain('merged')
    expect(t.note.delete).toHaveBeenCalledWith({ where: { id: 'nm' } })
  })
})
