import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Editor } from '@tiptap/react'
import { isSafeHref, normalizeHref } from '@/features/notes/noteDoc'

interface LinkFieldProps {
  editor: Editor
  onClose: () => void
}

/**
 * The field opened by the link tool or Ctrl+K (YC-41). Applies the link to the selection, or
 * inserts the address as a link when nothing is selected. Échap closes it and gives the focus
 * back to the note. Only http(s) and mailto are accepted, like the server.
 */
export function LinkField({ editor, onClose }: LinkFieldProps) {
  const [value, setValue] = useState(() => (editor.getAttributes('link').href as string | undefined) ?? '')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // Two notes can share a page (video and playlist): ids must stay unique.
  const inputId = useId()
  const errorId = useId()
  const hasLink = editor.isActive('link')

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const close = () => {
    onClose()
    editor.commands.focus()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const href = normalizeHref(value)
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      onClose()
      return
    }
    if (!isSafeHref(href)) {
      setError('Adresse refusée : seuls http, https et mailto sont acceptés.')
      return
    }
    const chain = editor.chain().focus().extendMarkRange('link')
    if (editor.state.selection.empty && !hasLink) {
      chain.insertContent({ type: 'text', text: value.trim(), marks: [{ type: 'link', attrs: { href } }] }).run()
    } else {
      chain.setLink({ href }).run()
    }
    onClose()
  }

  return (
    <form
      className="yc-link-field"
      aria-label="Lien"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          close()
        }
      }}
    >
      <label htmlFor={inputId} className="yc-link-label">
        Adresse du lien
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://…"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setValue(e.target.value)
          setError('')
        }}
      />
      <button type="submit" className="yc-link-button">
        Appliquer
      </button>
      {hasLink && (
        <button
          type="button"
          className="yc-link-button"
          onClick={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            onClose()
          }}
        >
          Retirer le lien
        </button>
      )}
      {error && (
        <p id={errorId} role="alert" className="yc-link-error">
          {error}
        </p>
      )}
    </form>
  )
}
