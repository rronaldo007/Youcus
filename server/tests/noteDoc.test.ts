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

  it('accepts a code block, stores only a real language and hidden line numbers (YC-44)', () => {
    const code = (attrs?: unknown) => ({ type: 'codeBlock', ...(attrs ? { attrs } : {}), content: [{ type: 'text', text: 'const a = 1\n  return a' }] })
    const res = parseNoteDoc({
      type: 'doc',
      content: [code({ language: 'javascript', lineNumbers: true }), code({ language: null, lineNumbers: false }), code()],
    })
    expect(res.ok && res.doc.content.map((n) => n.attrs ?? null)).toEqual([{ language: 'javascript' }, { lineNumbers: false }, null])
    expect(res.ok && docToPlainText(res.doc)).toBe('const a = 1\n  return a\nconst a = 1\n  return a\nconst a = 1\n  return a')
  })

  it('drops marks inside a code block: code is plain text (YC-44)', () => {
    const res = parseNoteDoc({ type: 'doc', content: [{ type: 'codeBlock', content: [t('x', [{ type: 'bold' }])] }] })
    expect(res.ok && res.doc.content[0]).toEqual({ type: 'codeBlock', content: [{ type: 'text', text: 'x' }] })
  })

  it.each([
    ['a language off the list', { type: 'codeBlock', attrs: { language: 'brainfuck' }, content: [t('x')] }],
    ['a paragraph inside a code block', { type: 'codeBlock', content: [p(t('x'))] }],
  ])('refuses %s (YC-44)', (_name, node) => {
    expect(parseNoteDoc({ type: 'doc', content: [node] })).toMatchObject({ ok: false, status: 400 })
  })

  it('accepts nested task lists with their checked state (YC-43)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: true }, content: [p(t('fait'))] },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [p(t('à faire')), { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [p(t('sous'))] }] }],
            },
          ],
        },
      ],
    }
    const res = parseNoteDoc(doc)
    expect(res.ok && res.doc).toEqual(doc)
    expect(res.ok && docToPlainText(res.doc)).toBe('fait\nà faire\nsous')
  })

  it('keeps a real alignment, stores nothing for null or left (YC-43)', () => {
    const res = parseNoteDoc({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { textAlign: null }, content: [t('a')] },
        { type: 'paragraph', attrs: { textAlign: 'left' }, content: [t('b')] },
        { type: 'paragraph', attrs: { textAlign: 'center' }, content: [t('c')] },
        { type: 'heading', attrs: { level: 2, textAlign: 'justify' }, content: [t('d')] },
        { type: 'heading', attrs: { level: 3, textAlign: null }, content: [t('e')] },
      ],
    })
    expect(res.ok && res.doc.content.map((n) => n.attrs ?? null)).toEqual([null, null, { textAlign: 'center' }, { level: 2, textAlign: 'justify' }, { level: 3 }])
  })

  it.each([
    ['an alignment off the list', { type: 'paragraph', attrs: { textAlign: 'start' }, content: [t('x')] }],
    ['an alignment as CSS', { type: 'paragraph', attrs: { textAlign: 'center;color:red' }, content: [t('x')] }],
    ['a task item without its state', { type: 'taskList', content: [{ type: 'taskItem', content: [p(t('x'))] }] }],
    ['a task item in a bullet list', { type: 'bulletList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(t('x'))] }] }],
  ])('refuses %s (YC-43)', (_name, node) => {
    expect(parseNoteDoc({ type: 'doc', content: [node] })).toMatchObject({ ok: false, status: 400 })
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

describe('timestamped markers (YC-56)', () => {
  it('keeps a marker on a paragraph and a heading, and drops the null the editor sends', () => {
    const res = parseNoteDoc({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2, textAlign: null, marker: 245 }, content: [t('Les hooks')] },
        { type: 'paragraph', attrs: { textAlign: 'center', marker: 0 }, content: [t('au début')] },
        { type: 'paragraph', attrs: { textAlign: null, marker: null }, content: [t('sans repère')] },
      ],
    })
    expect(res.ok && res.doc.content.map((n) => n.attrs ?? null)).toEqual([
      { level: 2, marker: 245 },
      { textAlign: 'center', marker: 0 },
      null,
    ])
  })

  it('keeps a marker on a line inside a list', () => {
    const item = { type: 'listItem', content: [{ type: 'paragraph', attrs: { marker: 61 }, content: [t('point')] }] }
    const res = parseNoteDoc({ type: 'doc', content: [{ type: 'bulletList', content: [item] }] })
    expect(res.ok && res.doc.content[0].content?.[0].content?.[0].attrs).toEqual({ marker: 61 })
  })

  it.each([
    ['a negative second', -1],
    ['a fraction', 12.5],
    ['a string', '04:05'],
    ['more than 100 hours', 360_001],
  ])('refuses %s as marker', (_name, value) => {
    expect(parseNoteDoc({ type: 'doc', content: [{ type: 'paragraph', attrs: { marker: value }, content: [t('x')] }] })).toMatchObject({
      ok: false,
      status: 400,
    })
  })
})
