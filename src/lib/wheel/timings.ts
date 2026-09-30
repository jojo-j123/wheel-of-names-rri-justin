import type { AnimationMode, AnimationSettings } from '../../types'

/** Seconds for every stage of the cinematic sequence. */
export interface ModeTimings {
  /** PRE_SPIN: small backwards wind-up. */
  anticipation: number
  /** ACCELERATING: smooth ramp to full speed. */
  accel: number
  /** FULL_SPEED: constant top speed. */
  fullSpeed: number
  /** DECELERATING → FINAL_SLOWDOWN → LANDING: one continuous physical coast. */
  coast: number
  /** Tiny spring-back onto the final resting angle. */
  settle: number
  /** Silent hold after the wheel stops, before the reveal. */
  suspense: number
  /** "AND THE WINNER IS…" beat (grand prize only). */
  preReveal: number
  /** Exponent of the coast velocity curve; higher = longer agonising crawl at the end. */
  coastPower: number
  /** Default full turns. */
  rotations: number
  /** Wind-up size in degrees. */
  anticipationAngle: number
}

export const MODE_TIMINGS: Record<AnimationMode, ModeTimings> = {
  // ≈ 5 s — quick, frequent draws.
  standard: {
    anticipation: 0.3, accel: 0.6, fullSpeed: 1.0, coast: 2.5, settle: 0.35,
    suspense: 0.35, preReveal: 0, coastPower: 2.2, rotations: 6, anticipationAngle: 5,
  },
  // ≈ 10 s — the default event experience.
  dramatic: {
    anticipation: 0.5, accel: 1.0, fullSpeed: 3.0, coast: 4.0, settle: 0.5,
    suspense: 1.0, preReveal: 0, coastPower: 2.7, rotations: 10, anticipationAngle: 8,
  },
  // ≈ 13 s spin + silent beat + tease — major prizes: long wind-up, agonising crawl, stage-style reveal.
  grand: {
    anticipation: 1.2, accel: 1.3, fullSpeed: 2.8, coast: 5.2, settle: 0.7,
    suspense: 1.8, preReveal: 2.0, coastPower: 3.1, rotations: 12, anticipationAngle: 12,
  },
}

export const MODE_LABELS: Record<AnimationMode, { title: string; blurb: string }> = {
  standard: { title: 'Standard', blurb: 'About 5 seconds. Good for many quick draws.' },
  dramatic: { title: 'Dramatic', blurb: 'About 10 seconds. The classic live-event spin.' },
  grand: { title: 'Grand Prize', blurb: 'About 15 seconds. Big build-up and a stage-style reveal.' },
}

export function spinLength(t: ModeTimings): number {
  return t.anticipation + t.accel + t.fullSpeed + t.coast + t.settle
}

export interface ResolveOptions {
  reducedMotion: boolean
}

/** Apply operator overrides (duration / rotations) and reduced motion to a mode's timings. */
export function resolveTimings(settings: AnimationSettings, opts: ResolveOptions): ModeTimings {
  const base = MODE_TIMINGS[settings.mode]
  const t: ModeTimings = { ...base }
  if (settings.spinDuration && settings.spinDuration > 0) {
    const k = clampNum(settings.spinDuration, 2, 30) / spinLength(base)
    t.anticipation *= k
    t.accel *= k
    t.fullSpeed *= k
    t.coast *= k
    t.settle *= k
  }
  if (settings.rotations && settings.rotations > 0) t.rotations = Math.round(clampNum(settings.rotations, 1, 40))
  if (opts.reducedMotion) {
    // Keep the result readable, remove most of the motion.
    t.anticipation = 0.1
    t.accel = 0.3
    t.fullSpeed = 0.2
    t.coast = Math.min(t.coast, 1.6)
    t.settle = 0.2
    t.rotations = Math.min(t.rotations, 2)
    t.anticipationAngle = 0
    t.coastPower = 2
    t.preReveal = Math.min(t.preReveal, 1)
  }
  return t
}

function clampNum(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
