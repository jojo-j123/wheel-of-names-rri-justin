import { secureRandomFloat, secureRandomInt } from '../random/secureRandom'
import { buildSpinPlan } from '../wheel/spinPlan'
import { MODE_TIMINGS } from '../wheel/timings'
import { computeTargetRotation, segmentAngle, segmentAtPointer } from '../wheel/wheelMath'

export interface SelfCheckResult {
  draws: number
  mismatches: number
  /** Sampled frames where the wheel ran backwards after the wind-up (should be 0). */
  backwardFrames: number
  /** Largest per-frame jump in degrees at 60 FPS. */
  maxFrameStep: number
  distribution: { buckets: number; samples: number; chiSquare: number; pass: boolean }
}

/**
 * Simulates full spins (secure pick → target → analytic motion → final frame) and checks
 * the pointer lands on the picked segment every time. Also sanity-checks RNG uniformity.
 */
export function runSelfCheck(draws = 500): SelfCheckResult {
  const counts = [1, 2, 3, 7, 10, 30, 31, 100, 101, 500, 999, 1000]
  const modes = Object.values(MODE_TIMINGS)
  let mismatches = 0
  let backwardFrames = 0
  let maxFrameStep = 0
  let rotation = secureRandomFloat() * 360
  for (let d = 0; d < draws; d++) {
    const N = counts[d % counts.length]
    const index = d % 3 === 0 ? 0 : d % 3 === 1 ? N - 1 : secureRandomInt(N)
    const timings = modes[d % modes.length]
    const target = computeTargetRotation({ currentRotation: rotation, targetIndex: index, count: N, rotations: timings.rotations, offsetFraction: secureRandomFloat() * 0.52 - 0.26 })
    const plan = buildSpinPlan({ start: rotation, target, timings, overshoot: Math.min(segmentAngle(N) * 0.15, 2.5) })
    let prev = plan.positionAt(timings.anticipation)
    for (let t = timings.anticipation; t <= timings.anticipation + timings.accel + timings.fullSpeed + timings.coast; t += 1 / 60) {
      const p = plan.positionAt(t)
      if (p < prev - 1e-9) backwardFrames++
      maxFrameStep = Math.max(maxFrameStep, Math.abs(p - prev))
      prev = p
    }
    const end = plan.positionAt(plan.duration + 0.001)
    if (segmentAtPointer(end, N) !== index) mismatches++
    rotation = end % 360
  }
  const buckets = 10
  const samples = 20000
  const hist = new Array(buckets).fill(0)
  for (let i = 0; i < samples; i++) hist[secureRandomInt(buckets)]++
  const expected = samples / buckets
  const chiSquare = hist.reduce((s, o) => s + ((o - expected) ** 2) / expected, 0)
  // 9 degrees of freedom, p = 0.001 critical value ≈ 27.88
  return { draws, mismatches, backwardFrames, maxFrameStep, distribution: { buckets, samples, chiSquare, pass: chiSquare < 27.88 } }
}
