/**
 * Cryptographically secure randomness. Math.random() is never used for draws.
 */

function getCrypto(): Crypto {
  const c = globalThis.crypto
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('Secure random source unavailable in this browser.')
  }
  return c
}

const UINT32_RANGE = 0x1_0000_0000

/**
 * Uniform integer in [0, max). Uses rejection sampling so every value is exactly
 * equally likely (no modulo bias), even for max values that don't divide 2^32.
 */
export function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) throw new RangeError(`max must be a positive integer, got ${max}`)
  if (max > UINT32_RANGE) throw new RangeError('max too large')
  if (max === 1) return 0
  const limit = UINT32_RANGE - (UINT32_RANGE % max)
  const buf = new Uint32Array(1)
  const crypto = getCrypto()
  for (;;) {
    crypto.getRandomValues(buf)
    const v = buf[0]
    if (v < limit) return v % max
  }
}

/** Uniform float in [0, 1) with 32 bits of entropy. Used for cosmetic landing offset only. */
export function secureRandomFloat(): number {
  const buf = new Uint32Array(1)
  getCrypto().getRandomValues(buf)
  return buf[0] / UINT32_RANGE
}

/** Unbiased Fisher–Yates shuffle using the secure source. Returns a new array. */
export function secureShuffle<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function createId(prefix = ''): string {
  const c = globalThis.crypto
  const uuid =
    c && typeof c.randomUUID === 'function'
      ? c.randomUUID()
      : Array.from({ length: 4 }, () => secureRandomInt(0xffffffff).toString(16).padStart(8, '0')).join('')
  return prefix ? `${prefix}_${uuid}` : uuid
}
