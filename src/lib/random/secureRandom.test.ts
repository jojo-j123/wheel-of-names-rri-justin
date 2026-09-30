import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId, secureRandomInt, secureShuffle } from './secureRandom'

afterEach(() => vi.restoreAllMocks())

describe('secureRandomInt', () => {
  it('returns integers within [0, max)', () => {
    for (const max of [1, 2, 3, 10, 100, 1000, 999_999]) {
      for (let i = 0; i < 500; i++) {
        const v = secureRandomInt(max)
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(max)
      }
    }
  })

  it('uses crypto.getRandomValues and never Math.random', () => {
    const cryptoSpy = vi.spyOn(globalThis.crypto, 'getRandomValues')
    const mathSpy = vi.spyOn(Math, 'random')
    secureRandomInt(1000)
    expect(cryptoSpy).toHaveBeenCalled()
    expect(mathSpy).not.toHaveBeenCalled()
  })

  it('rejects biased values (rejection sampling)', () => {
    // max = 3: limit = 2^32 - (2^32 % 3) = 4294967295. A value at/above limit must be re-drawn.
    const seq = [0xffffffff, 7]
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((arr: Uint32Array) => {
      arr[0] = seq.shift()!
      return arr
    }) as typeof crypto.getRandomValues)
    expect(secureRandomInt(3)).toBe(7 % 3)
  })

  it('is statistically uniform (chi-square, 10 buckets, 50k samples)', () => {
    const buckets = 10
    const samples = 50_000
    const hist = new Array(buckets).fill(0)
    for (let i = 0; i < samples; i++) hist[secureRandomInt(buckets)]++
    const expected = samples / buckets
    const chi = hist.reduce((s, o) => s + (o - expected) ** 2 / expected, 0)
    expect(chi).toBeLessThan(33.7) // df=9, p=0.0001
  })

  it('throws on invalid input', () => {
    expect(() => secureRandomInt(0)).toThrow()
    expect(() => secureRandomInt(-1)).toThrow()
    expect(() => secureRandomInt(1.5)).toThrow()
  })
})

describe('secureShuffle / createId', () => {
  it('shuffle keeps every element exactly once', () => {
    const src = Array.from({ length: 1000 }, (_, i) => i)
    const out = secureShuffle(src)
    expect(out).toHaveLength(1000)
    expect(new Set(out).size).toBe(1000)
    expect(src[0]).toBe(0) // input untouched
  })
  it('ids are unique', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => createId('p')))
    expect(ids.size).toBe(2000)
  })
})
