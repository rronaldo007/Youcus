import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { ToolMenu } from '@/features/notes/ToolMenu'
import { CODE_LANGUAGES, languageLabel } from '@/features/notes/codeLanguages'
import chevronIcon from './icons/chevron-down.svg'
import copyIcon from './icons/copy.svg'
import checkIcon from './icons/check.svg'

function Icon({ src, size }: { src: string; size: number }) {
  return <span aria-hidden="true" className="yc-tool-icon" style={{ '--icon': `url("${src}")`, '--size': `${size}px` } as CSSProperties} />
}

/**
 * A code block in a note (YC-44), Figma « Bloc de code » (36:592): language picker, Copier (the
 * code alone, never the line numbers), line numbers that can be hidden, horizontal scroll.
 * The block is padded to a whole number of ruled rows, so the text after it falls on the ruling.
 */
export function CodeBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const language = (node.attrs.language as string | null) ?? null
  const lineNumbers = node.attrs.lineNumbers !== false
  const lines = Math.max(1, node.textContent.split('\n').length)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Round the block's height up to the ruling step (32 px), whatever the number of lines.
  useEffect(() => {
    const el = ref.current
    if (!el) return
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const label = languageLabel(language)

  return (
    <NodeViewWrapper ref={ref} className="yc-code" data-line-numbers={lineNumbers ? 'true' : 'false'}>
      <div className="yc-code-header" contentEditable={false}>
        {editor.isEditable ? (
          <ToolMenu
            buttonLabel={`Langage du bloc : ${label}`}
            buttonClassName="yc-code-language"
            buttonContent={
              <>
                <span>{label}</span>
                <Icon src={chevronIcon} size={14} />
              </>
            }
            menuLabel="Langage du bloc"
            inToolbar={false}
          >
            {(close) => (
              <>
                <p aria-hidden="true" className="yc-menu-label">
                  LANGAGE
                </p>
                {CODE_LANGUAGES.map((l) => (
                  <button
                    key={l.id ?? 'plain'}
                    type="button"
                    role="menuitemradio"
                    aria-checked={l.id === language}
                    tabIndex={-1}
                    className="yc-menu-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      updateAttributes({ language: l.id })
                      close()
                    }}
                  >
                    <span className="yc-menu-item-label yc-menu-item-medium">{l.label}</span>
                    {l.id === language && <Icon src={checkIcon} size={18} />}
                  </button>
                ))}
                <div aria-hidden="true" className="yc-menu-rule" />
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={lineNumbers}
                  tabIndex={-1}
                  className="yc-menu-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    updateAttributes({ lineNumbers: !lineNumbers })
                    close()
                  }}
                >
                  <span className="yc-menu-item-label yc-menu-item-medium">Numéros de ligne</span>
                  {lineNumbers && <Icon src={checkIcon} size={18} />}
                </button>
              </>
            )}
          </ToolMenu>
        ) : (
          <span className="yc-code-language">{label}</span>
        )}
        <span className="yc-code-spacer" />
        <button type="button" className="yc-code-copy" aria-label="Copier le code" onMouseDown={(e) => e.preventDefault()} onClick={copy}>
          <Icon src={copyIcon} size={16} />
          <span>{copied ? 'Copié' : 'Copier'}</span>
        </button>
        <span className="yc-visually-hidden" aria-live="polite">
          {copied ? 'Code copié' : ''}
        </span>
      </div>
      <div className="yc-code-body">
        {lineNumbers && (
          <div className="yc-code-gutter" aria-hidden="true" contentEditable={false}>
            {Array.from({ length: lines }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        )}
        <pre spellCheck={false}>
          {/* NodeViewContent sets an inline « pre-wrap »; code never wraps, it scrolls (36:592). */}
          <NodeViewContent<'code'> as="code" className={language ? `hljs language-${language}` : 'hljs'} style={{ whiteSpace: 'pre' }} />
        </pre>
      </div>
    </NodeViewWrapper>
  )
}
