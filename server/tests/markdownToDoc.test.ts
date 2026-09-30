import { describe, expect, it } from 'vitest'
import { markdownToDoc } from '@/lib/markdownToDoc'
import { docToPlainText, parseNoteDoc } from '@/lib/noteDoc'

const LEGACY = `# Les hooks essentiels

Après le rendu, **jamais pendant** : il synchronise avec *l'extérieur*. ~~Faux~~ et \`a<b && c\`.

Voir [la doc](https://react.dev) et [piège](javascript:alert(1)).

1. vide : une seule fois
2. aucun tableau
   - comparées avec \`Object.is\`

> Un effet par responsabilité.

\`\`\`js
useEffect(() => {
  return () => clearInterval(id)
}, [])
\`\`\`

| a | b |
|---|---|
| 1 | 2 |

<b>html brut</b>

#### Titre 4 ramené au niveau 3`

describe('markdownToDoc (YC-40)', () => {
  const doc = markdownToDoc(LEGACY)

  it('always produces a document the server accepts', () => {
    expect(parseNoteDoc(doc)).toMatchObject({ ok: true })
    for (const sample of ['', '   ', 'texte seul', '- [ ] tâche', '***', '1) liste', 'a  \nb', '![img](x.png)', '\\*échappé\\*']) {
      expect(parseNoteDoc(markdownToDoc(sample))).toMatchObject({ ok: true })
    }
  })

  it('keeps the structure: headings, marks, lists, quote', () => {
    expect(doc.content[0]).toEqual({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Les hooks essentiels' }] })
    const json = JSON.stringify(doc)
    expect(json).toContain('{"type":"text","text":"jamais pendant","marks":[{"type":"bold"}]}')
    expect(json).toContain('{"type":"text","text":"l\'extérieur","marks":[{"type":"italic"}]}')
    expect(json).toContain('{"type":"text","text":"Faux","marks":[{"type":"strike"}]}')
    expect(json).toContain('{"type":"text","text":"a<b && c","marks":[{"type":"code"}]}')
    expect(json).toContain('{"type":"link","attrs":{"href":"https://react.dev"}}')
    expect(json).toContain('"type":"orderedList"')
    expect(json).toContain('"type":"bulletList"')
    expect(json).toContain('"type":"blockquote"')
    expect(json).toContain('{"type":"heading","attrs":{"level":3}')
  })

  it('keeps a thematic break as a horizontal rule (YC-41)', () => {
    expect(markdownToDoc('avant\n\n***\n\naprès').content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'avant' }] },
      { type: 'horizontalRule' },
      { type: 'paragraph', content: [{ type: 'text', text: 'après' }] },
    ])
  })

  it('never keeps an unsafe link, but keeps its text', () => {
    const json = JSON.stringify(doc)
    expect(json).not.toContain('javascript:')
    expect(json).toContain('"text":"piège"')
  })

  it('loses no text: code, table and raw HTML stay readable', () => {
    const text = docToPlainText(doc)
    for (const expected of ['clearInterval(id)', 'a | b', '1 | 2', '<b>html brut</b>', 'Un effet par responsabilité.', 'vide : une seule fois']) {
      expect(text).toContain(expected)
    }
  })
})
