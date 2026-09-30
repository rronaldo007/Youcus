import { describe, expect, it } from 'vitest'
import { MAX_DOC_CHARS, docToPlainText, parseNoteDoc } from '@/lib/noteDoc'

const p = (...content: unknown[]) => ({ type: 'paragraph', content })
const t = (text: string, marks?: unknown[]) => (marks ? { type: 'text', text, marks } : { type: 'text', text })

describe('parseNoteDoc (YC-40)', () => {
  it('accepts what the editor produces and drops unknown attributes', () => {
    const input = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1, id: 'x' }, content: [t('Les hooks')] },
        p(t('Un '), t('gras', [{ type: 'bold' }]), t(' lien', [{ type: 'link', attrs: { href: 'https://react.dev', target: '_blank', rel: null } }])),
        { type: 'orderedList', attrs: { start: 3, type: null }, content: [{ type: 'listItem', content: [p(t('trois'))] }] },
        { type: 'blockquote', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [p(t('cité'))] }] }] },
      ],
    }
    const res = parseNoteDoc(input)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.doc.content[0]).toEqual({ type: 'heading', attrs: { level: 1 }, content: [t('Les hooks')] })
    expect(JSON.stringify(res.doc)).not.toContain('_blank')
  })

  it('accepts the empty paragraph TipTap keeps after a final heading', () => {
    expect(parseNoteDoc({ type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [t('T')] }, { type: 'paragraph' }] })).toMatchObject({ ok: true })
  })

  it.each([
    ['a script node', { type: 'doc', content: [{ type: 'script', text: 'alert(1)' }] }],
    ['a javascript: link', { type: 'doc', content: [p(t('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]))] }],
    ['a data: link', { type: 'doc', content: [p(t('x', [{ type: 'link', attrs: { href: 'data:text/html,<b>' } }]))] }],
    ['an unknown mark', { type: 'doc', content: [p(t('x', [{ type: 'textStyle', attrs: { color: '#f00' } }]))] }],
    ['a heading level 4', { type: 'doc', content: [{ type: 'heading', attrs: { level: 4 }, content: [t('x')] }] }],
    ['not a doc', { type: 'paragraph' }],
    ['a Markdown string', '# titre'],
  ])('refuses %s', (_name, input) => {
    expect(parseNoteDoc(input)).toMatchObject({ ok: false, status: 400 })
  })

  it('refuses a document over the size limit with 413', () => {
    const big = { type: 'doc', content: [p(t('x'.repeat(MAX_DOC_CHARS)))] }
    expect(parseNoteDoc(big)).toMatchObject({ ok: false, status: 413 })
  })

  it('refuses a document nested too deeply', () => {
    let node: unknown = p(t('fond'))
    for (let i = 0; i < 30; i++) node = { type: 'blockquote', content: [node] }
    expect(parseNoteDoc({ type: 'doc', content: [node] })).toMatchObject({ ok: false, status: 400 })
  })

  it('gives the plain text, one line per block', () => {
    const res = parseNoteDoc({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [t('Titre')] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('a'), { type: 'hardBreak' }, t('b'))] }] },
      ],
    })
    expect(res.ok && docToPlainText(res.doc)).toBe('Titre\na\nb')
  })
})
