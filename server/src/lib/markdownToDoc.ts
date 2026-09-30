import { marked, type Token, type Tokens } from 'marked'
import { isSafeHref, type NoteDoc, type NoteMark, type NoteNode } from '@/lib/noteDoc'

/**
 * Converts a legacy Markdown note into the rich-editor document (YC-40).
 *
 * Used on read for notes written before the rich editor: the Markdown stays in `content`
 * until the note is saved again, so a bad conversion never loses the original. What the
 * editor cannot hold yet is kept as text rather than dropped: code blocks become code-marked
 * lines, tables become " | "-joined rows, raw HTML stays as literal text.
 */
export function markdownToDoc(markdown: string): NoteDoc {
  const content = blocks(marked.lexer(markdown))
  return { type: 'doc', content }
}

function blocks(tokens: Token[]): NoteNode[] {
  const out: NoteNode[] = []
  for (const token of tokens) out.push(...block(token))
  return out
}

function block(token: Token): NoteNode[] {
  switch (token.type) {
    case 'heading': {
      const t = token as Tokens.Heading
      return [{ type: 'heading', attrs: { level: Math.min(t.depth, 3) }, ...inlineContent(t.tokens) }]
    }
    case 'paragraph':
      return [{ type: 'paragraph', ...inlineContent((token as Tokens.Paragraph).tokens) }]
    case 'text': {
      const t = token as Tokens.Text
      return [{ type: 'paragraph', ...inlineContent(t.tokens ?? [{ type: 'text', raw: t.raw, text: t.text }]) }]
    }
    case 'blockquote': {
      const inner = blocks((token as Tokens.Blockquote).tokens)
      return inner.length ? [{ type: 'blockquote', content: inner }] : []
    }
    case 'list': {
      const t = token as Tokens.List
      const items = t.items.map((item) => {
        const inner = blocks(item.tokens)
        return { type: 'listItem', content: inner.length ? inner : [{ type: 'paragraph' }] }
      })
      if (!items.length) return []
      // « - [ ] » everywhere: a real task list (YC-43). A list that mixes tasks and plain items
      // stays a bullet list, the box kept as text so nothing is lost.
      if (!t.ordered && t.items.every((item) => item.task)) {
        return [{ type: 'taskList', content: t.items.map((item, i) => ({ type: 'taskItem', attrs: { checked: !!item.checked }, content: items[i].content })) }]
      }
      if (t.items.some((item) => item.task)) {
        t.items.forEach((item, i) => {
          if (!item.task) return
          const first = items[i].content[0]
          const box = item.checked ? '[x] ' : '[ ] '
          if (first?.type === 'paragraph') first.content = [{ type: 'text', text: box }, ...(first.content ?? [])]
        })
      }
      if (t.ordered) {
        const start = typeof t.start === 'number' ? t.start : 1
        return [{ type: 'orderedList', attrs: { start }, content: items }]
      }
      return [{ type: 'bulletList', content: items }]
    }
    case 'code':
      return (token as Tokens.Code).text.split('\n').map((line) =>
        line ? { type: 'paragraph', content: [{ type: 'text', text: line, marks: [{ type: 'code' }] }] } : { type: 'paragraph' },
      )
    case 'table': {
      const t = token as Tokens.Table
      const rows = [t.header.map((c) => c.text), ...t.rows.map((r) => r.map((c) => c.text))]
      return rows.map((cells) => ({ type: 'paragraph', ...textContent(cells.join(' | ')) }))
    }
    case 'html':
      return [{ type: 'paragraph', ...textContent((token as Tokens.HTML).text.trim()) }]
    case 'hr':
      return [{ type: 'horizontalRule' }]
    default:
      // space, def, checkbox (read from the list item): nothing to keep.
      return []
  }
}

function textContent(text: string): { content?: NoteNode[] } {
  return text ? { content: [{ type: 'text', text }] } : {}
}

function inlineContent(tokens: Token[] | undefined): { content?: NoteNode[] } {
  const nodes = inline(tokens ?? [], [])
  return nodes.length ? { content: nodes } : {}
}

function withMark(marks: NoteMark[], mark: NoteMark): NoteMark[] {
  return marks.some((m) => m.type === mark.type) ? marks : [...marks, mark]
}

function inline(tokens: Token[], marks: NoteMark[]): NoteNode[] {
  const out: NoteNode[] = []
  const text = (value: string) => {
    if (value) out.push(marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value })
  }
  for (const token of tokens) {
    switch (token.type) {
      case 'strong':
        out.push(...inline((token as Tokens.Strong).tokens, withMark(marks, { type: 'bold' })))
        break
      case 'em':
        out.push(...inline((token as Tokens.Em).tokens, withMark(marks, { type: 'italic' })))
        break
      case 'del':
        out.push(...inline((token as Tokens.Del).tokens, withMark(marks, { type: 'strike' })))
        break
      case 'codespan': {
        const value = (token as Tokens.Codespan).text
        if (value) out.push({ type: 'text', text: value, marks: withMark(marks, { type: 'code' }) })
        break
      }
      case 'link': {
        const t = token as Tokens.Link
        const next = isSafeHref(t.href) ? withMark(marks, { type: 'link', attrs: { href: t.href } }) : marks
        out.push(...inline(t.tokens, next))
        break
      }
      case 'image':
        text((token as Tokens.Image).text)
        break
      case 'br':
        out.push({ type: 'hardBreak' })
        break
      case 'text': {
        const t = token as Tokens.Text
        if (t.tokens?.length) out.push(...inline(t.tokens, marks))
        else text(t.text)
        break
      }
      default:
        // escape, html and anything unknown: keep the literal text.
        text((token as { text?: string; raw: string }).text ?? token.raw)
    }
  }
  return out
}
