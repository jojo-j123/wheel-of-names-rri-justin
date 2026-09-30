import type { DrawPhase } from '../../types'
import type { ModeTimings } from './timings'

/**
 * Deterministic motion plan for one spin.
 *
 * The winner is chosen BEFORE this is built; `target` is the exact resting rotation
 * for that winner (see computeTargetRotation). This module only decides HOW the wheel
 * travels there — position(t) is an analytic function of time, so the landing is exact
 * regardless of frame rate, dropped frames or tab throttling.
 *
 * Velocity profile (continuous, no jumps between stages):
 *   PRE_SPIN      : small backwards wind-up, starts & ends at rest
 *   ACCELERATING  : v = vmax · (1 − cos πu) / 2          (strong ease-in, smooth into top speed)
 *   FULL_SPEED    : v = vmax
 *   coast         : v = vmax · (1 − u)^p                  (long physical ease-out; last part crawls)
 *                   split into DECELERATING / FINAL_SLOWDOWN / LANDING
 *   settle        : tiny cosine spring-back from target+overshoot to target
 */
export interface SpinPlan {
  start: number
  target: number
  duration: number
  vmax: number
  positionAt(t: number): number
  phaseAt(t: number): DrawPhase
}

export interface SpinPlanInput {
  start: number
  target: number
  timings: ModeTimings
  /** Forward overshoot in degrees, recovered during settle. Must be < remaining half-segment margin. */
  overshoot: number
}

const DECEL_END = 0.5
const FINAL_END = 0.86

export function buildSpinPlan({ start, target, timings, overshoot }: SpinPlanInput): SpinPlan {
  const { anticipation: tA, accel: ta, fullSpeed: tf, coast: tc, settle: ts, coastPower: p } = timings
  const antic = tA > 0 ? timings.anticipationAngle : 0
  const s0 = start - antic
  const peak = target + overshoot
  const D = peak - s0
  const denom = ta / 2 + tf + tc / (p + 1)
  const vmax = denom > 0 ? D / denom : 0

  const t1 = tA
  const t2 = t1 + ta
  const t3 = t2 + tf
  const t4 = t3 + tc
  const t5 = t4 + ts

  const accelDist = (vmax * ta) / 2
  const fullDist = vmax * tf

  function positionAt(t: number): number {
    if (t <= 0) return start
    if (t < t1) {
      const u = t / tA
      return start - (antic * (1 - Math.cos(Math.PI * u))) / 2
    }
    if (t < t2) {
      const u = (t - t1) / ta
      return s0 + (vmax * ta * (u - Math.sin(Math.PI * u) / Math.PI)) / 2
    }
    if (t < t3) return s0 + accelDist + vmax * (t - t2)
    if (t < t4) {
      const u = (t - t3) / tc
      return s0 + accelDist + fullDist + (vmax * tc * (1 - Math.pow(1 - u, p + 1))) / (p + 1)
    }
    if (t < t5 && ts > 0) {
      const u = (t - t4) / ts
      return target + (overshoot * (1 + Math.cos(Math.PI * u))) / 2
    }
    return target
  }

  function phaseAt(t: number): DrawPhase {
    if (t < t1) return 'PRE_SPIN'
    if (t < t2) return 'ACCELERATING'
    if (t < t3) return 'FULL_SPEED'
    if (t < t4) {
      const u = (t - t3) / tc
      if (u < DECEL_END) return 'DECELERATING'
      if (u < FINAL_END) return 'FINAL_SLOWDOWN'
      return 'LANDING'
    }
    return 'LANDING'
  }

  return { start, target, duration: t5, vmax, positionAt, phaseAt }
}
