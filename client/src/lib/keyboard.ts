/** True when a key goes to a field (input, select, the note's text): there, a letter is a letter. */
export function isTyping(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || !!target.closest('[contenteditable]:not([contenteditable="false"])')
}
