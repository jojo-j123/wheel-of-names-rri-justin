import { describe, expect, it } from 'vitest'
import type { DrawPhase } from '../../types'
import { runSelfCheck } from '../draw/selfCheck'
import { secureRandomInt } from '../random/secureRandom'
import { buildSpinPlan } from './spinPlan'
import { DEFAULT_ANIMATION_SETTINGS } from '../event/defaults'
import { MODE_TIMINGS, resolveTimings, spinLength } from './timings'
import { computeTargetRotation, normalizeAngle, segmentAngle, segmentAtPointer } from './wheelMath'

const FPS = 60

function simulate(N: number, index: number, mode: keyof typeof MODE_TIMINGS, start = 0, offset = 0) {
  const timings = MODE_TIMINGS[mode]
  const target = computeTargetRotation({ currentRotation: start, targetIndex: index, count: N, rotations: timings.rotations, offsetFraction: offset })
  const overshoot = Math.min(segmentAngle(N) * 0.15, 2.5)
  const plan = buildSpinPlan({ start, target, timings, overshoot })
  const frames: { t: number; pos: number; phase: DrawPhase }[] = []
  for (let f = 0; f <= Math.ceil(plan.duration * FPS); f++) {
    const t = Math.min(plan.duration, f / FPS)
    frames.push({ t, pos: plan.positionAt(t), phase: plan.phaseAt(t) })
  }
  return { plan, frames, timings, target }
}

describe('spin plan — exact landing (the critical guarantee)', () => {
  const cases: [number, number][] = [
    [1, 0], [2, 0], [2, 1], [10, 0], [10, 5], [10, 9], [30, 29], [31, 15], [100, 0], [100, 50], [100, 99],
    [101, 100], [500, 0], [500, 250], [500, 499], [1000, 0], [1000, 500], [1000, 999], [7, 3], [999, 998],
  ]
  for (const mode of ['standard', 'dramatic', 'grand'] as const) {
    it(`${mode}: ${cases.length} simulated draws (beginning / middle / end) land on the selected winner`, () => {
      let rotation = 37.5
      for (const [N, index] of cases) {
        const offset = (secureRandomInt(53) - 26) / 100
        const { plan, frames } = simulate(N, index, mode, rotation, offset)
        const last = frames[frames.length - 1]
        expect(last.pos).toBe(plan.target)
        expect(segmentAtPointer(last.pos, N)).toBe(index)
        rotation = normalizeAngle(plan.target)
      }
    })
  }

  it('100 random draws with random sizes and positions', () => {
    let rotation = 0
    for (let k = 0; k < 100; k++) {
      const N = 1 + secureRandomInt(1000)
      const index = secureRandomInt(N)
      const mode = (['standard', 'dramatic', 'grand'] as const)[k % 3]
      const { plan } = simulate(N, index, mode, rotation, (secureRandomInt(53) - 26) / 100)
      expect(segmentAtPointer(plan.positionAt(plan.duration), N)).toBe(index)
      rotation = normalizeAngle(plan.target)
    }
  })

  it('the settle overshoot never crosses into a neighbouring segment', () => {
    for (const N of [2, 10, 30, 100, 1000]) {
      for (const offset of [-0.3, 0, 0.3]) {
        const index = Math.floor(N / 2)
        const { plan, timings } = simulate(N, index, 'dramatic', 0, offset)
        const coastEnd = timings.anticipation + timings.accel + timings.fullSpeed + timings.coast
        for (let t = coastEnd - 0.3; t <= plan.duration; t += 0.005) {
          expect(segmentAtPointer(plan.positionAt(t), N)).toBe(index)
        }
      }
    }
  })
})

describe('spin plan — motion quality', () => {
  it('phases run in order: PRE_SPIN → ACCELERATING → FULL_SPEED → DECELERATING → FINAL_SLOWDOWN → LANDING', () => {
    const { frames } = simulate(30, 7, 'dramatic')
    const order: DrawPhase[] = []
    for (const f of frames) if (order[order.length - 1] !== f.phase) order.push(f.phase)
    expect(order).toEqual(['PRE_SPIN', 'ACCELERATING', 'FULL_SPEED', 'DECELERATING', 'FINAL_SLOWDOWN', 'LANDING'])
  })

  it('anticipation moves backwards a little, then the wheel only moves forward until the settle', () => {
    const { frames, timings } = simulate(30, 7, 'dramatic', 100)
    const coastEnd = timings.anticipation + timings.accel + timings.fullSpeed + timings.coast
    const pre = frames.filter((f) => f.t <= timings.anticipation)
    expect(Math.min(...pre.map((f) => f.pos))).toBeCloseTo(100 - timings.anticipationAngle, 5)
    const main = frames.filter((f) => f.t >= timings.anticipation && f.t <= coastEnd)
    for (let i = 1; i < main.length; i++) expect(main[i].pos).toBeGreaterThanOrEqual(main[i - 1].pos - 1e-9)
  })

  it('velocity is continuous (no jumps between stages) and decreases through the coast', () => {
    for (const mode of ['standard', 'dramatic', 'grand'] as const) {
      const { frames, timings, plan } = simulate(100, 42, mode)
      const v = frames.slice(1).map((f, i) => (f.pos - frames[i].pos) * FPS)
      let maxDv = 0
      for (let i = 1; i < v.length; i++) maxDv = Math.max(maxDv, Math.abs(v[i] - v[i - 1]))
      // Max change of speed between consecutive frames stays small relative to top speed.
      expect(maxDv).toBeLessThan(plan.vmax * 0.06)
      const coastStart = timings.anticipation + timings.accel + timings.fullSpeed
      const coastEnd = coastStart + timings.coast
      const coastV = frames
        .slice(1)
        .map((f, i) => ({ t: f.t, v: (f.pos - frames[i].pos) * FPS }))
        .filter((x) => x.t > coastStart + 1 / FPS && x.t < coastEnd)
      for (let i = 1; i < coastV.length; i++) expect(coastV[i].v).toBeLessThanOrEqual(coastV[i - 1].v + 1e-6)
      // Final slowdown is genuinely slow: last 15% of the coast covers < 1.5% of the distance.
      const d = (t: number) => plan.positionAt(t)
      const total = d(coastEnd) - d(coastStart)
      expect((d(coastEnd) - d(coastEnd - timings.coast * 0.15)) / total).toBeLessThan(0.015)
    }
  })

  it('mode durations match the brief (~5 s / 8–10 s / 12–15 s incl. suspense)', () => {
    const total = (m: keyof typeof MODE_TIMINGS) => spinLength(MODE_TIMINGS[m]) + MODE_TIMINGS[m].suspense
    expect(total('standard')).toBeGreaterThanOrEqual(4.5)
    expect(total('standard')).toBeLessThanOrEqual(6)
    expect(total('dramatic')).toBeGreaterThanOrEqual(8)
    expect(total('dramatic')).toBeLessThanOrEqual(10.5)
    expect(total('grand') + MODE_TIMINGS.grand.preReveal).toBeGreaterThanOrEqual(12)
    expect(total('grand') + MODE_TIMINGS.grand.preReveal).toBeLessThanOrEqual(16)
  })

  it('custom duration / rotations / reduced motion are applied', () => {
    const t = resolveTimings({ ...DEFAULT_ANIMATION_SETTINGS, spinDuration: 20, rotations: 25 }, { reducedMotion: false })
    expect(spinLength(t)).toBeCloseTo(20, 5)
    expect(t.rotations).toBe(25)
    const r = resolveTimings(DEFAULT_ANIMATION_SETTINGS, { reducedMotion: true })
    expect(r.rotations).toBeLessThanOrEqual(2)
    expect(spinLength(r)).toBeLessThan(3)
  })

  it('is deterministic: same inputs → identical frames', () => {
    const a = simulate(500, 123, 'grand', 12)
    const b = simulate(500, 123, 'grand', 12)
    expect(a.frames).toEqual(b.frames)
  })

  it('built-in self-check reports zero mismatches', () => {
    const r = runSelfCheck(300)
    expect(r.mismatches).toBe(0)
    expect(r.backwardFrames).toBe(0)
    expect(r.distribution.pass).toBe(true)
  })
})
