import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { NodeViewWrapper, useEditorState, type ReactNodeViewProps } from '@tiptap/react'
import { ACCEPTED_IMAGES, imageProblem, noteImageUrl, uploadNoteImage } from '@/features/notes/noteImageUpload'
import type { ImageAlign } from '@/features/notes/noteImage'
import alignLeftIcon from './icons/align-left.svg'
import alignCenterIcon from './icons/align-center.svg'
import imageIcon from './icons/image.svg'
import closeIcon from './icons/note/fermer.svg'

function Icon({ src, size = 24 }: { src: string; size?: number }) {
  return <span aria-hidden="true" className="yc-tool-icon" style={{ '--icon': `url("${src}")`, '--size': `${size}px` } as CSSProperties} />
}

const ALIGNS: { id: ImageAlign; label: string; icon: string }[] = [
  { id: 'left', label: 'Aligner à gauche', icon: alignLeftIcon },
  { id: 'center', label: 'Centrer', icon: alignCenterIcon },
  { id: 'full', label: 'Pleine largeur', icon: imageIcon },
]
const MIN_WIDTH = 20

/**
 * An image in a note (YC-50), Figma « Bloc de note › Image » (65:2007): selected, it shows its
 * bar (alignment, alternative text, replace, delete) and corner handles that set its width;
 * the caption sits under it. The block is padded to a whole number of ruled rows, like the code
 * block, so the text after it falls on the ruling.
 */
export function NoteImageView({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const id = node.attrs.id as string | null
  const alt = (node.attrs.alt as string | null) ?? ''
  const caption = (node.attrs.caption as string | null) ?? ''
  const align = (node.attrs.align as ImageAlign) ?? 'center'
  const width = node.attrs.width as number | null
  // Read on every transaction: « Aperçu » turns editing off without touching the node.
  const editable = useEditorState({ editor, selector: ({ editor: e }) => e.isEditable }) ?? editor.isEditable
  const [altOpen, setAltOpen] = useState(false)
  const [broken, setBroken] = useState(false)
  // Typing in the caption does not select the block: the field stays while it has the focus.
  const [captionFocused, setCaptionFocused] = useState(false)
  const [replacing, setReplacing] = useState<'idle' | 'busy' | string>('idle')
  const fileRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const altId = useId()
  // The caption field is as tall as its text, wrapped to the width it has.
  const fitCaption = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  useEffect(() => setBroken(false), [id])

  // Round the block's height up to the ruling step (32 px), as the code block does.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const step = parseFloat(getComputedStyle(el).getPropertyValue('--note-step')) || 32
      el.style.marginBottom = '0px'
      const h = el.getBoundingClientRect().height
      el.style.marginBottom = `${Math.ceil(h / step) * step - h}px`
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const replace = async (file: File | undefined) => {
    if (!file) return
    const problem = imageProblem(file)
    if (problem) return setReplacing(problem)
    setReplacing('busy')
    try {
      const uploaded = await uploadNoteImage(file)
      updateAttributes({ id: uploaded.id })
      setReplacing('idle')
    } catch (err) {
      setReplacing((err as Error).message || "L'image n'a pas pu être envoyée.")
    }
  }

  // A corner handle: the width follows the pointer, as a share of the column (20 to 100 %).
  const startResize = (side: 'left' | 'right') => (e: ReactPointerEvent) => {
    const frame = frameRef.current
    const column = ref.current?.parentElement
    if (!frame || !column) return
    e.preventDefault()
    const startX = e.clientX
    const startWidth = frame.getBoundingClientRect().width
    const columnWidth = column.getBoundingClientRect().width || 1
    // Centred, the image grows on both sides: a pixel of pointer is two of image.
    const factor = (side === 'right' ? 1 : -1) * (align === 'center' ? 2 : 1)
    const move = (ev: PointerEvent) => {
      const next = Math.round(((startWidth + (ev.clientX - startX) * factor) / columnWidth) * 100)
      updateAttributes({ width: Math.min(100, Math.max(MIN_WIDTH, next)) })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const frameStyle: CSSProperties = align === 'full' ? { width: '100%' } : width ? { width: `${width}%` } : {}
  const showBar = editable && selected

  return (
    <NodeViewWrapper as="figure" ref={ref} className="yc-image" data-align={align} data-selected={showBar || undefined}>
      {showBar && (
        <div role="toolbar" aria-label="Image" className="yc-image-bar" contentEditable={false}>
          {ALIGNS.map((a) => (
            <button
              key={a.id}
              type="button"
              className="yc-tool"
              aria-label={a.label}
              title={a.label}
              aria-pressed={align === a.id}
              onClick={() => updateAttributes({ align: a.id })}
            >
              <Icon src={a.icon} />
            </button>
          ))}
          <span aria-hidden="true" className="yc-image-bar-sep" />
          <button type="button" className="yc-image-bar-text" aria-expanded={altOpen} aria-controls={altId} onClick={() => setAltOpen((v) => !v)}>
            Texte alternatif
          </button>
          <button type="button" className="yc-image-bar-text" disabled={replacing === 'busy'} onClick={() => fileRef.current?.click()}>
            {replacing === 'busy' ? 'Envoi…' : 'Remplacer'}
          </button>
          <button type="button" className="yc-tool" aria-label="Supprimer l'image" title="Supprimer l'image" onClick={() => deleteNode()}>
            <Icon src={closeIcon} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_IMAGES}
            hidden
            onChange={(e) => {
              void replace(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      )}

      <div className="yc-image-align" contentEditable={false}>
        <div ref={frameRef} className="yc-image-frame" style={frameStyle}>
          {id && !broken ? (
            <img src={noteImageUrl(id)} alt={alt} draggable={false} onError={() => setBroken(true)} />
          ) : (
            <div className="yc-image-missing" role="img" aria-label={alt || 'Image indisponible'}>
              <Icon src={imageIcon} size={40} />
              <span>Image indisponible</span>
            </div>
          )}
          {showBar && align !== 'full' && (
            <>
              <span aria-hidden="true" className="yc-image-handle" data-corner="top-left" onPointerDown={startResize('left')} />
              <span aria-hidden="true" className="yc-image-handle" data-corner="top-right" onPointerDown={startResize('right')} />
              <span aria-hidden="true" className="yc-image-handle" data-corner="bottom-left" onPointerDown={startResize('left')} />
              <span aria-hidden="true" className="yc-image-handle" data-corner="bottom-right" onPointerDown={startResize('right')} />
            </>
          )}
        </div>
      </div>

      {typeof replacing === 'string' && replacing !== 'idle' && replacing !== 'busy' && (
        <p role="alert" className="yc-image-error" contentEditable={false}>
          {replacing}
        </p>
      )}

      {editable && altOpen && (
        <label id={altId} className="yc-image-alt" contentEditable={false}>
          <span>Texte alternatif : ce que l'image montre, pour qui ne la voit pas.</span>
          <input
            value={alt}
            maxLength={300}
            placeholder="Le cycle d'un effet : rendu, nettoyage, nouvel effet"
            onChange={(e) => updateAttributes({ alt: e.target.value || null })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault()
                setAltOpen(false)
              }
            }}
          />
        </label>
      )}
      {editable && selected && !alt && !altOpen && (
        <p className="yc-image-hint" contentEditable={false}>
          Pas encore de texte alternatif : il sert aux lecteurs d'écran et à l'export.
        </p>
      )}

      {editable ? (
        (selected || caption || captionFocused) && (
        // A textarea that grows with its text: on a phone a caption takes two lines, never cut
        // (YC-62). Entrée adds no line: a caption is one sentence.
        <textarea
          ref={fitCaption}
          rows={1}
          className="yc-image-caption"
          value={caption}
          maxLength={300}
          aria-label="Légende de l'image"
          placeholder={selected ? 'Ajouter une légende' : ''}
          onChange={(e) => {
            updateAttributes({ caption: e.target.value.replace(/\n/g, ' ') || null })
            fitCaption(e.target)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault()
          }}
          onFocus={() => setCaptionFocused(true)}
          onBlur={() => setCaptionFocused(false)}
          contentEditable={false}
        />
        )
      ) : (
        caption && <figcaption className="yc-image-caption">{caption}</figcaption>
      )}
    </NodeViewWrapper>
  )
}
