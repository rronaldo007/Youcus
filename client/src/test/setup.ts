import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom n'implémente pas matchMedia ; stub minimal pour useTheme.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// jsdom n'a pas de mise en page : ProseMirror mesure la sélection (Range) pour la faire défiler
// après focus(). Sans ce stub, l'erreur tombe hors test et fait échouer la suite (YC-41).
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
}
