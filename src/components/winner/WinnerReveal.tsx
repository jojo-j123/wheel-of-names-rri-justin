import { AnimatePresence, motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Branding, DrawPhase } from '../../types'
import type { BatchState, CurrentDraw } from '../../store/drawStore'
import { rgba } from '../../lib/branding'
import { BrandLogo } from '../branding/BrandLogo'

interface Props {
  phase: DrawPhase
  current: CurrentDraw
  batch: BatchState | null
  branding: Branding
  reduced: boolean
  onNameRevealed(): void
  onCelebrate(): void
  onContinue(): void
  onClose(): void
}

/** Stage-show timing (seconds from the start of WINNER_REVEAL). */
function choreography(grand: boolean, preReveal: number, reduced: boolean) {
  if (reduced) return { tease: 0, kicker: 0.05, name: 0.25, prize: 0.6, logo: 0.9, celebrate: 0.4 }
  if (grand) {
    const p = Math.max(1.2, preReveal)
    return { tease: p, kicker: p + 0.1, name: p + 0.65, prize: p + 1.6, logo: p + 2.3, celebrate: p + 1.0 }
  }
  return { tease: 0, kicker: 0.05, name: 0.4, prize: 1.0, logo: 1.5, celebrate: 0.7 }
}

export function WinnerReveal({ phase, current, batch, branding, reduced, onNameRevealed, onCelebrate, onContinue, onClose }: Props) {
  const grand = current.mode === 'grand'
  const started = phase !== 'SUSPENSE'
  const t = choreography(grand, current.timings.preReveal, reduced)
  const cbs = useRef({ onNameRevealed, onCelebrate })
  cbs.current = { onNameRevealed, onCelebrate }

  useEffect(() => {
    if (phase !== 'WINNER_REVEAL') return
    const a = setTimeout(() => cbs.current.onNameRevealed(), t.name * 1000)
    const b = setTimeout(() => cbs.current.onCelebrate(), t.celebrate * 1000)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
    // Only when the reveal starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'WINNER_REVEAL'])

  const name = current.participant.name
  const nameVw = Math.max(4.2, Math.min(11, 105 / Math.max(name.length, 6)))
  const more = batch && batch.winners.length < batch.total
  const showActions = phase === 'CELEBRATION' || phase === 'COMPLETE'
  const kicker = current.batchTotal > 1 ? `Winner #${current.batchPosition} of ${current.batchTotal}` : 'Winner!'
  const { primaryColor: primary, accentColor: accent } = branding

  const rise = (delay: number, extra: object = {}) =>
    reduced
      ? { initial: { opacity: 0 }, animate: started ? { opacity: 1 } : { opacity: 0 }, transition: { delay, duration: 0.4 } }
      : {
          initial: { opacity: 0, y: 30, filter: 'blur(10px)', ...extra },
          animate: started ? { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 } : {},
          transition: { delay, type: 'spring' as const, stiffness: 160, damping: 20 },
        }

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      role="dialog"
      aria-modal="true"
      data-reveal
      aria-label={`Winner: ${name}`}
    >
      {/* Dim + vignette. Grand prize goes almost black for the "silence" beat. */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: grand ? 1.2 : 0.6 }}
        style={{ background: `radial-gradient(ellipse at 50% 40%, rgba(0,0,0,${grand ? 0.8 : 0.72}) 0%, rgba(0,0,0,${grand ? 0.97 : 0.92}) 75%)` }}
      />
      {/* Spotlight cone. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[120%] w-[80vw] -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: grand ? 0.9 : 0.7 }}
        transition={{ delay: grand ? 0.6 : 0.2, duration: 1.1 }}
        style={{
          background: `radial-gradient(ellipse 35% 55% at 50% 48%, ${rgba('#ffffff', 0.16)} 0%, ${rgba(primary, 0.12)} 45%, transparent 70%)`,
          clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
          filter: 'blur(24px)',
        }}
      />
      {/* Slow rays behind the name. */}
      {!reduced && started && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[180vmax] w-[180vmax] -translate-x-1/2 -translate-y-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: grand ? 0.5 : 0.32 }}
          transition={{ delay: t.name, duration: 1.4 }}
          style={{ maskImage: 'radial-gradient(circle, black 0%, transparent 38%)', WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 38%)' }}
        >
          <div className="animate-rays h-full w-full" style={{ background: `repeating-conic-gradient(from 0deg, ${rgba(accent, 0.22)} 0deg 5deg, transparent 5deg 15deg)` }} />
        </motion.div>
      )}

      <div className="relative z-10 flex w-full max-w-[92vw] flex-col items-center px-6 text-center text-white">
        {/* Grand prize tease. */}
        <AnimatePresence>
          {grand && started && !reduced && (
            <motion.p
              key="tease"
              className="stage-kicker absolute top-1/2 -translate-y-1/2 font-display text-[clamp(1.4rem,3.4vw,3.2rem)] text-white/90"
              initial={{ opacity: 0, letterSpacing: '0.1em', filter: 'blur(8px)' }}
              animate={{ opacity: [0, 1, 1, 0], letterSpacing: ['0.1em', '0.32em', '0.36em', '0.5em'], filter: ['blur(8px)', 'blur(0px)', 'blur(0px)', 'blur(6px)'] }}
              transition={{ duration: t.tease, times: [0, 0.3, 0.8, 1], ease: 'easeOut' }}
            >
              And the winner is…
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div {...rise(t.kicker, { scale: 0.85 })} className="stage-kicker mb-2 font-display text-[clamp(1rem,2vw,1.9rem)]" style={{ color: accent }}>
          {kicker}
        </motion.div>

        {/* Name — the hero. Mask reveal + blur + scale + spring settle + glow. */}
        <div className="overflow-hidden px-[4vw] py-[1.5vh]">
          <motion.h1
            className="font-display font-bold leading-[1.02] tracking-tight"
            style={{ fontSize: `clamp(2.6rem, min(${nameVw}vw, 17vh), 12rem)` }}
            initial={reduced ? { opacity: 0 } : { y: '105%', opacity: 0, scale: 1.18, filter: 'blur(22px)' }}
            animate={
              started
                ? reduced
                  ? { opacity: 1 }
                  : {
                      y: '0%',
                      opacity: 1,
                      scale: 1,
                      filter: 'blur(0px)',
                      textShadow: [`0 0 0px ${rgba(primary, 0)}`, `0 0 60px ${rgba(primary, 0.9)}`, `0 0 34px ${rgba(primary, 0.55)}`],
                    }
                : {}
            }
            transition={
              reduced
                ? { delay: t.name, duration: 0.4 }
                : {
                    delay: t.name,
                    y: { type: 'spring', stiffness: 110, damping: 15, mass: 1.1, delay: t.name },
                    scale: { type: 'spring', stiffness: 90, damping: 14, delay: t.name },
                    filter: { duration: 0.7, delay: t.name },
                    opacity: { duration: 0.35, delay: t.name },
                    textShadow: { duration: 1.6, delay: t.name },
                  }
            }
          >
            {name}
          </motion.h1>
        </div>

        {/* Prize line + card. */}
        <motion.div {...rise(t.prize)} className="mt-3 flex items-center gap-3 font-display text-[clamp(1.2rem,2.6vw,2.6rem)] font-semibold">
          <Trophy className="shrink-0" style={{ color: accent, width: '1em', height: '1em' }} />
          <span>{current.prize?.name ?? 'Winner'}</span>
        </motion.div>
        {current.prize?.image && (
          <motion.div
            {...rise(t.prize + 0.15, { scale: 0.9 })}
            className="relative mt-[2.5vh] aspect-square w-[clamp(120px,18vh,260px)] overflow-hidden rounded-3xl ring-1 ring-white/20"
            style={{ boxShadow: `0 30px 80px -20px ${rgba(primary, 0.65)}` }}
          >
            <img src={current.prize.image} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
          </motion.div>
        )}

        {batch && batch.total > 1 && batch.winners.length > 1 && (
          <motion.ol {...rise(t.logo)} className="mt-[2.5vh] flex max-w-4xl flex-wrap justify-center gap-2">
            {batch.winners.map((w, i) => (
              <li key={w.participantId} className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white/85 ring-1 ring-white/10">
                <span className="text-white/50">#{i + 1}</span> {w.name}
              </li>
            ))}
          </motion.ol>
        )}

        <motion.div {...rise(t.logo)} className="mt-[3vh] flex items-center gap-3 text-white/70">
          <BrandLogo logo={branding.logo} companyName={branding.companyName} variant="badge" className="h-[clamp(36px,5vh,56px)] w-[clamp(36px,5vh,56px)]" />
          <span className="stage-kicker text-xs">{branding.companyName}</span>
        </motion.div>

        <div className="mt-[3vh] flex h-12 items-center gap-3">
          <AnimatePresence>
            {showActions && (
              <motion.div className="flex gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.4 }}>
                {more ? (
                  <button onClick={onContinue} className="rounded-full px-6 py-3 font-semibold shadow-lg transition hover:brightness-110" style={{ background: primary, color: '#fff' }}>
                    Draw winner {batch!.winners.length + 1} of {batch!.total}
                  </button>
                ) : null}
                <button onClick={onClose} className="rounded-full bg-white/10 px-6 py-3 font-semibold text-white/85 ring-1 ring-white/15 transition hover:bg-white/15">
                  {more ? 'Stop here' : 'Done'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
