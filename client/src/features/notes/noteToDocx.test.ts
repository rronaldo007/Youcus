import { Packer } from 'docx'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import type { NoteDoc, NoteNode } from './noteDoc'
import { DEFAULT_PAGE } from './notePage'
import { buildNoteDocument, docxFileName } from './noteToDocx'

const t = (text: string, marks?: unknown[]): NoteNode => (marks ? { type: 'text', text, marks: marks as NoteNode['marks'] } : { type: 'text', text })
const p = (content: NoteNode[], attrs?: Record<string, unknown>): NoteNode => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content })
const item = (...content: NoteNode[]): NoteNode => ({ type: 'listItem', content })

/** The XML of the document and of its links, from the .docx built for `content`. */
async function build(content: NoteNode[], page = DEFAULT_PAGE) {
  // Packed for Node here (jsdom's Blob cannot be read back); the browser gets the same as a Blob.
  const buffer = await Packer.toBuffer(buildNoteDocument({ type: 'doc', content } as NoteDoc, { eyebrow: 'Fullstack · Vidéo 4', title: 'useEffect en profondeur', page }))
  const zip = await JSZip.loadAsync(buffer)
  return {
    xml: await zip.file('word/document.xml')!.async('string'),
    rels: await zip.file('word/_rels/document.xml.rels')!.async('string'),
  }
}

/** The runs (w:r) whose text is `text`, as XML. */
const runOf = (xml: string, text: string) => xml.split('<w:r>').find((r) => r.includes(`>${text}</w:t>`)) ?? ''

describe('a note as .docx (YC-49)', () => {
  it('writes the title, where it comes from, and the text', async () => {
    const { xml } = await build([p([t('Les hooks essentiels')])])
    expect(xml).toContain('>useEffect en profondeur</w:t>')
    expect(xml).toContain('FULLSTACK · VIDÉO 4')
    expect(xml).toContain('>Les hooks essentiels</w:t>')
  })

  it('keeps bold, italic, underline, strike, colour, highlight, font and size', async () => {
    const { xml } = await build([
      p([
        t('gras', [{ type: 'bold' }]),
        t('italique', [{ type: 'italic' }]),
        t('souligné', [{ type: 'underline' }]),
        t('barré', [{ type: 'strike' }]),
        t('rouge', [{ type: 'textColor', attrs: { color: 'rouge' } }]),
        t('surligné', [{ type: 'highlight', attrs: { color: 'jaune' } }]),
        t('lora', [{ type: 'textFont', attrs: { font: 'lora' } }]),
        t('grand', [{ type: 'textSize', attrs: { size: 24 } }]),
      ]),
    ])
    expect(runOf(xml, 'gras')).toContain('<w:b/>')
    expect(runOf(xml, 'italique')).toContain('<w:i/>')
    expect(runOf(xml, 'souligné')).toContain('<w:u w:val="single"/>')
    expect(runOf(xml, 'barré')).toContain('<w:strike/>')
    expect(runOf(xml, 'rouge')).toContain('<w:color w:val="B0311C"/>')
    expect(runOf(xml, 'surligné')).toContain('w:fill="F6DE84"')
    expect(runOf(xml, 'lora')).toContain('w:ascii="Lora"')
    expect(runOf(xml, 'grand')).toContain('<w:sz w:val="36"/>')
  })

  it('writes a marker as [mm:ss] before its line, in the accent', async () => {
    const { xml } = await build([p([t('Le tableau de dépendances')], { marker: 245 })])
    const marker = runOf(xml, '[04:05] ')
    expect(marker).toContain('<w:color w:val="B0311C"/>')
    expect(xml.indexOf('[04:05] ')).toBeLessThan(xml.indexOf('Le tableau de dépendances'))
  })

  it('numbers the lists, only on the first line of an item; a task has its box, no bullet', async () => {
    const { xml } = await build([
      { type: 'orderedList', content: [item(p([t('un')]), p([t('suite de un')])), item(p([t('deux')]))] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p([t('fait')])] }, { type: 'taskItem', attrs: { checked: false }, content: [p([t('à faire')])] }] },
    ])
    const paragraph = (text: string) => xml.split('<w:p>').find((x) => x.includes(`>${text}</w:t>`)) ?? ''
    expect(paragraph('un')).toContain('<w:numPr>')
    expect(paragraph('suite de un')).not.toContain('<w:numPr>')
    expect(paragraph('deux')).toContain('<w:numPr>')
    expect(paragraph('fait')).toContain('☑ ')
    expect(paragraph('à faire')).toContain('☐ ')
    expect(paragraph('fait')).not.toContain('<w:numPr>')
  })

  it('writes a code block line by line, in the mono font', async () => {
    const { xml } = await build([{ type: 'codeBlock', content: [t('const a = 1\nreturn a')] }])
    expect(runOf(xml, 'const a = 1')).toContain('w:ascii="JetBrains Mono"')
    expect(runOf(xml, 'return a')).toContain('w:ascii="JetBrains Mono"')
  })

  it('keeps a link as a link, an icon as its symbol, a heading as a heading', async () => {
    const { xml, rels } = await build([
      { type: 'heading', attrs: { level: 2 }, content: [t('Trois cas')] },
      p([{ type: 'noteIcon', attrs: { name: 'ampoule' } }, t(' voir '), t('la doc', [{ type: 'link', attrs: { href: 'https://react.dev' } }])]),
    ])
    expect(xml).toContain('<w:pStyle w:val="Heading2"/>')
    // The heading style gives its size: no run size to override it.
    expect(runOf(xml, 'Trois cas')).not.toContain('<w:sz')
    expect(xml).toContain('💡')
    expect(xml).toContain('<w:hyperlink')
    expect(rels).toContain('https://react.dev')
  })

  it('takes the base font and size of the note', async () => {
    const { xml } = await build([p([t('base')])], { ...DEFAULT_PAGE, font: 'atkinson', size: 18 })
    expect(runOf(xml, 'base')).toContain('w:ascii="Atkinson Hyperlegible"')
    expect(runOf(xml, 'base')).toContain('<w:sz w:val="27"/>')
  })

  it('ignores what it does not know, rather than failing', async () => {
    const { xml } = await build([p([t('x', [{ type: 'textColor', attrs: { color: 'fluo' } }])]), { type: 'mystère', content: [] } as NoteNode])
    expect(runOf(xml, 'x')).not.toContain('<w:color')
  })
})

describe('the file name (YC-49)', () => {
  it.each([
    ['useEffect en profondeur', 'useEffect-en-profondeur.docx'],
    ['Réseaux : TCP/IP ?', 'Reseaux-TCPIP.docx'],
    ['   ', 'note.docx'],
  ])('« %s » gives %s', (title, name) => {
    expect(docxFileName(title)).toBe(name)
  })
})
