import { describe, expect, it } from 'vitest'
import { labelTier, lensGeometry } from './renderer'

describe('wheel labels for big lists', () => {
  it('every size gets names on the wheel', () => {
    expect(labelTier(10)).toBe('full')
    expect(labelTier(80)).toBe('compact')
    expect(labelTier(1000)).toBe('micro')
  })
  it('magnifier appears for big wheels, with ~5 readable slices', () => {
    for (const n of [200, 500, 1000, 5000]) {
      const g = lensGeometry(460, n)
      expect(g.show).toBe(true)
      // 5 slices span the lens diameter after zoom.
      expect(g.visible * g.rhoP * g.seg * g.k).toBeCloseTo(2 * g.lensR, 6)
    }
    for (const n of [30, 120, 199]) expect(lensGeometry(460, n).show).toBe(false)
    // Decided on the event's list: a 200-person event keeps the lens after winners leave the wheel.
    expect(lensGeometry(460, 199, 200).show).toBe(true)
    expect(lensGeometry(460, 150, 200).show).toBe(true)
    expect(lensGeometry(460, 199, 199).show).toBe(false)
    // Also on small screens (phone-size wheel) the lens still appears from 200.
    expect(lensGeometry(180, 200).show).toBe(true)
  })
})
