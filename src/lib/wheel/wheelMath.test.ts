import { describe, expect, it } from 'vitest'
import { secureRandomInt } from '../random/secureRandom'
import { computeTargetRotation, MAX_OFFSET_FRACTION, normalizeAngle, segmentAngle, segmentAtPointer, segmentCenter } from './wheelMath'

describe('angles', () => {
  it('segmentAngle = 360 / N', () => {
    expect(segmentAngle(1)).toBe(360)
    expect(segmentAngle(2)).toBe(180)
    expect(segmentAngle(10)).toBe(36)
    expect(segmentAngle(1000)).toBeCloseTo(0.36)
    expect(() => segmentAngle(0)).toThrow()
  })
  it('segmentCenter', () => {
    expect(segmentCenter(0, 4)).toBe(45)
    expect(segmentCenter(3, 4)).toBe(315)
  })
  it('normalizeAngle', () => {
    expect(normalizeAngle(-10)).toBe(350)
    expect(normalizeAngle(720)).toBe(0)
    expect(normalizeAngle(365)).toBe(5)
  })
  it('segmentAtPointer: rotation 0 puts segment 0 just right of the pointer, last segment just left', () => {
    // Pointer at local angle 0 (the seam). Rotating slightly clockwise brings the last segment under it.
    expect(segmentAtPointer(0.001, 10)).toBe(9)
    expect(segmentAtPointer(-0.001, 10)).toBe(0)
    expect(segmentAtPointer(-18, 10)).toBe(0) // center of seg 0 is at local 18°
    expect(segmentAtPointer(-54, 10)).toBe(1)
  })
})

describe('computeTargetRotation lands exactly on the chosen segment', () => {
  const sizes = [1, 2, 3, 10, 30, 31, 100, 101, 500, 1000]

  for (const N of sizes) {
    it(`N = ${N}: every index (or 200 samples) lands under the pointer`, () => {
      const indices = N <= 1000 ? Array.from({ length: N }, (_, i) => i) : []
      for (const index of indices) {
        const current = (secureRandomInt(100000) - 50000) / 7 // arbitrary, incl. negatives
        for (const offset of [0, MAX_OFFSET_FRACTION, -MAX_OFFSET_FRACTION]) {
          const target = computeTargetRotation({ currentRotation: current, targetIndex: index, count: N, rotations: 8, offsetFraction: offset })
          expect(segmentAtPointer(target, N)).toBe(index)
          // Always moves forward by at least the requested turns, less than one extra turn.
          expect(target - current).toBeGreaterThanOrEqual(8 * 360)
          expect(target - current).toBeLessThan(9 * 360)
        }
      }
    })
  }

  it('is exact at the segment center with offset 0', () => {
    const N = 12
    const t = computeTargetRotation({ currentRotation: 123.4, targetIndex: 5, count: N, rotations: 3 })
    const localUnderPointer = normalizeAngle(0 - t)
    expect(localUnderPointer).toBeCloseTo(segmentCenter(5, N), 9)
  })

  it('clamps an out-of-range cosmetic offset so it never leaves the segment', () => {
    const t = computeTargetRotation({ currentRotation: 0, targetIndex: 3, count: 7, rotations: 1, offsetFraction: 5 })
    expect(segmentAtPointer(t, 7)).toBe(3)
  })

  it('supports a non-top pointer', () => {
    for (let i = 0; i < 20; i++) {
      const t = computeTargetRotation({ currentRotation: 10, targetIndex: i, count: 20, rotations: 2, pointerAngle: 90 })
      expect(segmentAtPointer(t, 20, 90)).toBe(i)
    }
  })

  it('does not accumulate error across 1,000 consecutive spins', () => {
    let rotation = 0
    const N = 1000
    for (let k = 0; k < 1000; k++) {
      const index = secureRandomInt(N)
      rotation = computeTargetRotation({ currentRotation: rotation, targetIndex: index, count: N, rotations: 10, offsetFraction: 0.25 })
      expect(segmentAtPointer(rotation, N)).toBe(index)
      rotation = normalizeAngle(rotation) // what WheelCanvas does after each landing
    }
  })

  it('rejects invalid indices', () => {
    expect(() => computeTargetRotation({ currentRotation: 0, targetIndex: 5, count: 5, rotations: 1 })).toThrow()
    expect(() => computeTargetRotation({ currentRotation: 0, targetIndex: -1, count: 5, rotations: 1 })).toThrow()
  })
})
