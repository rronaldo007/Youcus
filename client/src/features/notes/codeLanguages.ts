import { createLowlight } from 'lowlight'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import php from 'highlight.js/lib/languages/php'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'

/**
 * Languages of a code block (YC-44). Ten grammars only, not the 190 of highlight.js: the editor
 * chunk stays light. `null` is plain text. The server accepts the same ids
 * (server/src/lib/noteDoc.ts).
 */
export const CODE_LANGUAGES: { id: string | null; label: string }[] = [
  { id: null, label: 'Texte brut' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'bash', label: 'Shell' },
  { id: 'sql', label: 'SQL' },
  { id: 'java', label: 'Java' },
  { id: 'php', label: 'PHP' },
]

export const languageLabel = (id: string | null) => CODE_LANGUAGES.find((l) => l.id === id)?.label ?? 'Texte brut'

export const lowlight = createLowlight({ bash, css, html: xml, java, javascript, json, php, python, sql, typescript })
