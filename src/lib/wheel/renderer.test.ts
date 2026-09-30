import { describe, expect, it } from 'vitest'
import { labelTier, lensGeometry } from './renderer'

describe('wheel labels for big lists', () => {
  it('every size gets names on the wheel', () => {
    expect(labelTier(10)).toBe('full')
    expect(labelTier(80)).toBe('compact')
    expect(labelTier(1000)).toBe('micro')
  })
  it('magnifier appears for big wheels, with ~5 readable slices', () => {
    for (const n of [120, 500, 1000, 5000]) {
      const g = lensGeometry(460, n)
      expect(g.show).toBe(true)
      // 5 slices span the lens diameter after zoom.
      expect(g.visible * g.rhoP * g.seg * g.k).toBeCloseTo(2 * g.lensR, 6)
    }
    expect(lensGeometry(460, 30).show).toBe(false)
  })
})
