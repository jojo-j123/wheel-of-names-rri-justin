/**
 * Wheel geometry.
 *
 * Conventions (all angles in DEGREES, measured CLOCKWISE from 12 o'clock):
 *  - Segment i occupies wheel-local angles [i * seg, (i + 1) * seg), seg = 360 / N.
 *  - The wheel is drawn rotated clockwise by `rotation` degrees, so a wheel-local
 *    angle `a` appears on screen at `(a + rotation) mod 360`.
 *  - The pointer sits at screen angle `pointerAngle` (0 = top).
 *
 * A segment is under the pointer when  (localAngle + rotation) ≡ pointerAngle (mod 360),
 * i.e. the local angle under the pointer is  normalize(pointerAngle - rotation).
 */

export const DEFAULT_POINTER_ANGLE = 0

export function normalizeAngle(deg: number): number {
  const r = deg % 360
  return r < 0 ? r + 360 : r
}

export function segmentAngle(count: number): number {
  if (count <= 0) throw new RangeError('count must be > 0')
  return 360 / count
}

/** Wheel-local angle of the center of segment `index`. */
export function segmentCenter(index: number, count: number): number {
  return (index + 0.5) * segmentAngle(count)
}

/** Which segment sits under the pointer for a given wheel rotation. */
export function segmentAtPointer(rotation: number, count: number, pointerAngle = DEFAULT_POINTER_ANGLE): number {
  const local = normalizeAngle(pointerAngle - rotation)
  // Guard against floating-point rounding producing `count` at the 360° seam.
  return Math.min(count - 1, Math.floor(local / segmentAngle(count)))
}

export interface TargetRotationInput {
  /** Current (absolute) wheel rotation in degrees. Any real number. */
  currentRotation: number
  targetIndex: number
  count: number
  /** Whole extra turns before landing. */
  rotations: number
  /**
   * Where inside the segment to stop, as a fraction of the segment width from its
   * center, in [-0.5, 0.5]. 0 = dead center. Purely cosmetic; clamped to keep a safe margin.
   */
  offsetFraction?: number
  pointerAngle?: number
}

/** Max fraction of half-segment we allow the cosmetic offset to use (keeps a visible margin). */
export const MAX_OFFSET_FRACTION = 0.3

/**
 * Absolute rotation the wheel must end at so `targetIndex` is under the pointer.
 * Always strictly ahead of `currentRotation` (clockwise), by `rotations` full turns
 * plus the alignment remainder in [0, 360).
 */
export function computeTargetRotation(input: TargetRotationInput): number {
  const { currentRotation, targetIndex, count, rotations, pointerAngle = DEFAULT_POINTER_ANGLE } = input
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= count) {
    throw new RangeError(`targetIndex ${targetIndex} out of range for ${count} segments`)
  }
  const seg = segmentAngle(count)
  const offset = clamp(input.offsetFraction ?? 0, -MAX_OFFSET_FRACTION, MAX_OFFSET_FRACTION) * seg
  const landingLocal = segmentCenter(targetIndex, count) + offset
  // Required final rotation modulo 360: pointer - landingLocal.
  const desiredMod = normalizeAngle(pointerAngle - landingLocal)
  const currentMod = normalizeAngle(currentRotation)
  const alignDelta = normalizeAngle(desiredMod - currentMod)
  return currentRotation + alignDelta + Math.max(0, Math.round(rotations)) * 360
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
