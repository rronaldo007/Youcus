import { describe, expect, it, vi } from 'vitest'
import { planImportMerge } from '@/services/playlist.service'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const pl = (id: string, title: string, youtubeId = `PL${id}`) => ({ id, title, youtubeId })

describe('planImportMerge (YC-96)', () => {
  it('stands alone when no visible playlist has its name', () => {
    expect(planImportMerge(pl('new', 'Cours'), [pl('a', 'Backend')])).toBeNull()
  })

  it('merges with the playlist of the same name, under ITS title, the existing videos first', () => {
    expect(planImportMerge(pl('new', 'cours  '), [pl('a', 'Backend'), pl('b', 'Cours')])).toEqual({
      ids: ['b', 'new'],
      title: 'Cours',
    })
  })

  it('a 3rd import of that name joins the merge, never a merge of merges', () => {
    const visible = [pl('m', 'Cours', 'merge:x'), pl('a', 'Backend')]
    expect(planImportMerge(pl('new', 'COURS'), visible)).toEqual({ ids: ['m', 'new'], title: 'Cours' })
  })

  it('takes the other visible playlists of that name into the merge too', () => {
    const visible = [pl('old', 'cours'), pl('m', 'Cours', 'merge:x')]
    expect(planImportMerge(pl('new', 'Cours'), visible)).toEqual({ ids: ['m', 'old', 'new'], title: 'Cours' })
  })

  it('without a merge, the oldest playlist gives its title', () => {
    expect(planImportMerge(pl('new', 'cours'), [pl('a', 'Cours'), pl('b', 'COURS')])).toEqual({
      ids: ['a', 'b', 'new'],
      title: 'Cours',
    })
  })

  it('two merges of that name: nothing is merged, the user chooses', () => {
    const visible = [pl('m1', 'Cours', 'merge:x'), pl('m2', 'cours', 'merge:y')]
    expect(planImportMerge(pl('new', 'Cours'), visible)).toBeNull()
  })

  it('accents count: « Résumé » does not merge with « Resume »', () => {
    expect(planImportMerge(pl('new', 'Résumé'), [pl('a', 'Resume')])).toBeNull()
  })

  it('never merges the import with itself', () => {
    expect(planImportMerge(pl('new', 'Cours'), [pl('new', 'Cours')])).toBeNull()
  })
})
