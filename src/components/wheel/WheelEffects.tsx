import { motion } from 'framer-motion'
import type { DrawPhase } from '../../types'
import { rgba } from '../../lib/branding'

const GLOW: Partial<Record<DrawPhase, number>> = {
  IDLE: 0.35,
  PRE_SPIN: 0.6,
  ACCELERATING: 0.75,
  FULL_SPEED: 0.9,
  DECELERATING: 0.8,
  FINAL_SLOWDOWN: 0.95,
  LANDING: 1,
  SUSPENSE: 0.55,
}

/** Ambient light behind the wheel that breathes with the draw phases. */
export function WheelEffects({ phase, color, grand }: { phase: DrawPhase; color: string; grand: boolean }) {
  const g = GLOW[phase] ?? 0.5
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-[18%] rounded-full"
        style={{ background: `radial-gradient(circle, ${rgba(color, 0.55)} 0%, ${rgba(color, 0.18)} 38%, transparent 68%)` }}
        animate={{ opacity: g * (grand ? 1 : 0.85), scale: 0.92 + g * 0.1 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-[2%] rounded-full shadow-[0_40px_90px_-10px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.04)]" />
    </>
  )
}
