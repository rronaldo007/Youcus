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

  it('accepts a horizontal rule (YC-41) and keeps nothing but its type', () => {
    const res = parseNoteDoc({ type: 'doc', content: [p(t('avant')), { type: 'horizontalRule', attrs: { style: 'x' } }, p(t('après'))] })
    expect(res.ok && res.doc.content[1]).toEqual({ type: 'horizontalRule' })
  })

  it('accepts colours, highlight, font and size by name (YC-42)', () => {
    const marks = [
      { type: 'textColor', attrs: { color: 'rouge' } },
      { type: 'highlight', attrs: { color: 'jaune' } },
      { type: 'textFont', attrs: { font: 'lora' } },
      { type: 'textSize', attrs: { size: 18 } },
    ]
    const res = parseNoteDoc({ type: 'doc', content: [p(t('coloré', marks))] })
    expect(res.ok && res.doc.content[0]).toEqual(p(t('coloré', marks)))
  })

  it.each([
    ['a hex colour', { type: 'textColor', attrs: { color: '#b0311c' } }],
    ['an unknown colour name', { type: 'textColor', attrs: { color: 'fuchsia' } }],
    ['a CSS highlight', { type: 'highlight', attrs: { color: 'rgb(255,0,0)' } }],
    ['an unknown font', { type: 'textFont', attrs: { font: 'Comic Sans MS' } }],
    ['a size off the list', { type: 'textSize', attrs: { size: 13 } }],
    ['a size as a CSS string', { type: 'textSize', attrs: { size: '18px' } }],
  ])('refuses %s (YC-42)', (_name, mark) => {
    expect(parseNoteDoc({ type: 'doc', content: [p(t('x', [mark]))] })).toMatchObject({ ok: false, status: 400 })
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
