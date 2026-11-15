import { motion } from 'framer-motion'
import { Lock, Play } from 'lucide-react'
import type { DrawPhase } from '../../types'
import { isRevealing, isSpinning } from '../../store/drawStore'
import { rgba } from '../../lib/branding'

interface Props {
  phase: DrawPhase
  locked: boolean
  disabled: boolean
  label: string
  color: string
  /** Showtime: a gold rim and poster type. */
  rim?: string
  size: 'md' | 'lg'
  onSpin(): void
}

export function SpinButton({ phase, locked, disabled, label, color, rim, size, onSpin }: Props) {
  const spinning = isSpinning(phase) || isRevealing(phase)
  const text = locked ? 'Locked' : spinning ? 'Drawing…' : label
  return (
    <motion.button
      type="button"
      onClick={onSpin}
      disabled={disabled || spinning || locked}
      aria-label={locked ? 'Controls locked' : spinning ? 'Drawing in progress' : `${label} (Space)`}
      whileHover={!spinning && !locked && !disabled ? { scale: 1.03 } : undefined}
      whileTap={{ scale: 0.95 }}
      animate={phase === 'PRE_SPIN' ? { scale: [1, 0.94, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.45 }}
      className={`relative inline-flex items-center justify-center gap-3 rounded-full uppercase text-white transition-[opacity,filter] disabled:cursor-not-allowed ${rim ? 'font-show tracking-[0.22em]' : 'font-display font-bold tracking-[0.18em]'} ${
        size === 'lg'
          ? `h-[clamp(56px,8vh,92px)] px-[clamp(40px,5vw,84px)] ${rim ? 'text-[clamp(1.4rem,3vh,2.6rem)]' : 'text-[clamp(1.1rem,2vh,1.8rem)]'}`
          : `h-16 px-12 ${rim ? 'text-2xl' : 'text-lg'}`
      } ${spinning ? 'opacity-60' : ''} ${disabled && !spinning ? 'opacity-40' : ''}`}
      style={{
        background: `linear-gradient(180deg, ${color} 0%, ${rgba(color, 0.82)} 100%)`,
        boxShadow: rim
          ? `0 0 0 4px ${rim}, 0 0 50px ${rgba(color, 0.75)}, inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -6px 0 rgba(0,0,0,0.22)`
          : `0 18px 40px -12px ${rgba(color, 0.8)}, inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -3px 0 rgba(0,0,0,0.18)`,
      }}
    >
      {!spinning && !disabled && !locked && (
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full opacity-20 [animation-duration:2.4s]" style={{ background: color }} />
      )}
      {locked ? <Lock className="h-[0.9em] w-[0.9em]" /> : !spinning && <Play className="h-[0.9em] w-[0.9em] fill-current" />}
      <span className="relative">{text}</span>
    </motion.button>
  )
}
