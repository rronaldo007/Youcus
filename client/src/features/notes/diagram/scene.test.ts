import { describe, expect, it } from 'vitest'
import { arrowLine, borderPoint, boundsOf, newId, sceneToSvg, wrapText, type Scene, type Shape } from './scene'

// The geometry of a diagram (YC-53): arrows leave each shape on its border, whatever its kind.

const shape = (over: Partial<Shape>): Shape => ({ id: 'a', kind: 'rect', x: 0, y: 0, w: 100, h: 50, text: '', color: 'bleu', ...over })

describe('diagram geometry (YC-53)', () => {
  it('an arrow leaves a rectangle on its side, an ellipse and a diamond on their curve', () => {
    expect(borderPoint(shape({ kind: 'rect' }), { x: 500, y: 25 })).toEqual({ x: 100, y: 25 })
    expect(borderPoint(shape({ kind: 'rect' }), { x: 50, y: 500 })).toEqual({ x: 50, y: 50 })
    // An ellipse 100 × 50 towards the right: its rightmost point.
    expect(borderPoint(shape({ kind: 'ellipse' }), { x: 500, y: 25 })).toEqual({ x: 100, y: 25 })
    // A diamond towards a corner of its box: the middle of its edge, not the corner.
    const p = borderPoint(shape({ kind: 'diamond' }), { x: 100, y: 50 })
    expect(p.x).toBeCloseTo(75)
    expect(p.y).toBeCloseTo(37.5)
  })

  it('an arrow goes from border to border, and follows a shape that moved', () => {
    const scene: Scene = {
      shapes: [shape({ id: 'a' }), shape({ id: 'b', x: 300 })],
      arrows: [{ id: 'z', from: 'a', to: 'b', label: '' }],
    }
    expect(arrowLine(scene, scene.arrows[0])).toEqual({ x1: 100, y1: 25, x2: 298, y2: 25 })
    const moved = { ...scene, shapes: [scene.shapes[0], shape({ id: 'b', x: 0, y: 300 })] }
    expect(arrowLine(moved, moved.arrows[0])).toMatchObject({ x1: 50, y1: 50, y2: 298 })
    // An arrow to a shape that is gone is not drawn.
    expect(arrowLine({ ...scene, shapes: [scene.shapes[0]] }, scene.arrows[0])).toBeNull()
  })

  it('wraps a label to its shape, keeps its own line breaks', () => {
    expect(wrapText('Dépendances changées ?', 100, 15)).toEqual(['Dépendances', 'changées ?'])
    expect(wrapText('un\ndeux', 500, 15)).toEqual(['un', 'deux'])
  })

  it('boxes every shape with a margin; an empty scene has a default page', () => {
    expect(boundsOf({ shapes: [shape({ x: 10, y: 20 })], arrows: [] })).toEqual({ x: -14, y: -4, w: 148, h: 98 })
    expect(boundsOf({ shapes: [], arrows: [] })).toEqual({ x: 0, y: 0, w: 700, h: 260 })
  })

  it('gives ids no other shape or arrow has', () => {
    const scene: Scene = { shapes: [shape({ id: 'a' })], arrows: [] }
    const id = newId(scene)
    expect(id).toMatch(/^[a-z0-9]{1,12}$/)
    expect(id).not.toBe('a')
  })

  it('draws a standalone light SVG for the export, its text escaped', () => {
    const { svg, width, height } = sceneToSvg({
      shapes: [shape({ id: 'a', text: 'A < B & C' }), shape({ id: 'b', x: 300, kind: 'diamond', color: 'orange' })],
      arrows: [{ id: 'z', from: 'a', to: 'b', label: 'oui' }],
    })
    expect(svg).toContain('<rect x="0" y="0" width="100" height="50" rx="12" fill="#cfe0f5" stroke="#1d4e89"')
    expect(svg).toContain('<polygon')
    expect(svg).toContain('fill="#f6de84"')
    expect(svg).toContain('A &lt; B &amp; C')
    expect(svg).toContain('>oui</text>')
    expect(svg).not.toContain('var(--')
    expect(width).toBeGreaterThan(400)
    expect(height).toBeGreaterThan(50)
  })
})
