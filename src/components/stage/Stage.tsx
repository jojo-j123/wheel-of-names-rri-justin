import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import type { EventData } from '../../types'
import { useDrawController } from '../../hooks/useDrawController'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useFullscreen } from '../../hooks/useFullscreen'
import { sound } from '../../lib/audio/soundEngine'
import { brandCssVars, mix, rgba } from '../../lib/branding'
import { getActivePrize, getEligibleParticipants, nextPrizeWithStock, prizeRemaining, setActivePrize } from '../../lib/event/operations'
import { n } from '../../lib/format'
import { useApp } from '../../store/appStore'
import { isRevealing, isSpinning, useDraw } from '../../store/drawStore'
import { BrandLogo } from '../branding/BrandLogo'
import { PrizeShowcase } from '../prizes/PrizeShowcase'
import { SpinButton } from '../wheel/SpinButton'
import { Wheel } from '../wheel/Wheel'
import type { WheelHandle } from '../wheel/WheelCanvas'
import { WinnerReveal } from '../winner/WinnerReveal'
import { OperatorBar } from './OperatorBar'
import { PresenterControls } from './PresenterControls'

interface Props {
  event: EventData
  mode: 'operator' | 'presentation'
  onPresent?(): void
  onExitPresentation?(): void
}

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  // Reveal buttons (Done / Next winner) map to the same Space action, so they never block it.
  if (el.tagName === 'BUTTON' && el.closest('[data-reveal]')) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName)
}

export function Stage({ event, mode, onPresent, onExitPresentation }: Props) {
  const presentation = mode === 'presentation'
  const wheelRef = useRef<WheelHandle>(null)
  const liveNameRef = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion(event.animationSettings.reducedMotion)
  const ctrl = useDrawController(event.id, wheelRef, reduced)
  const fs = useFullscreen()
  const { phase, current, wheelList, batch, locked } = useDraw()
  const b = event.branding

  useEffect(() => {
    sound.enabled = event.wheelSettings.sound
    if (!event.wheelSettings.sound) sound.stopAll()
  }, [event.wheelSettings.sound])

  const batchKey = batch?.winners.map((w) => w.participantId).join('|') ?? ''
  const eligible = useMemo(
    () => getEligibleParticipants(event, batchKey ? new Set(batchKey.split('|')) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event.participants, event.winnerHistory, batchKey],
  )
  const list = wheelList ?? eligible
  const names = useMemo(() => list.map((p) => p.name), [list])
  const namesRef = useRef(names)
  namesRef.current = names
  const colors = useMemo(() => ({ primary: b.primaryColor, secondary: b.secondaryColor, accent: b.accentColor }), [b.primaryColor, b.secondaryColor, b.accentColor])

  const prize = getActivePrize(event)
  const remaining = prize ? prizeRemaining(event, prize) : 0
  const spinning = isSpinning(phase)
  const revealing = isRevealing(phase) && !!current
  const grand = (current?.mode ?? event.animationSettings.mode) === 'grand'

  const nextPrize = prize && remaining <= 0 ? nextPrizeWithStock(event, prize.id) : null
  const goToNextPrize = useCallback(() => {
    const d = useDraw.getState()
    if (d.locked || d.phase !== 'IDLE') return
    const ev = useApp.getState().events[event.id]
    const np = ev ? nextPrizeWithStock(ev, ev.activePrizeId) : null
    if (!np) return
    useApp.getState().mutateEvent(event.id, (e) => setActivePrize(e, np.id))
    useDraw.getState().set({ batch: null })
  }, [event.id])

  const blocker = !event.participants.length
    ? 'Add participants in Admin to start.'
    : !eligible.length
      ? 'Everyone has won — undo a draw or reset the event.'
      : prize && remaining <= 0
        ? `All “${prize.name}” prizes have been given away.`
        : null
  const pendingBatch = batch && batch.winners.length < batch.total
  const spinLabel = pendingBatch ? `Spin for winner ${batch!.winners.length + 1} of ${batch!.total}` : event.wheelSettings.winnersPerDraw > 1 ? `Spin · ${event.wheelSettings.winnersPerDraw} winners` : 'Spin'

  const onPointerIndex = useCallback((i: number) => {
    if (liveNameRef.current) liveNameRef.current.textContent = namesRef.current[i] ?? ''
  }, [])
  const onTick = useCallback((speed: number) => sound.play('wheel_tick', speed), [])
  const onSpeed = useCallback((s: number) => sound.setSpeed(s), [])

  const closeReveal = useCallback(() => {
    const bt = useDraw.getState().batch
    if (bt && bt.winners.length < bt.total) ctrl.resetCurrentDraw()
    else ctrl.dismiss()
  }, [ctrl])

  // Keyboard: Space/Enter spin or continue · F fullscreen · S emergency stop · L lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if ([...document.querySelectorAll('[role="dialog"]')].some((d) => !d.hasAttribute('data-reveal'))) return
      const d = useDraw.getState()
      const key = e.key.toLowerCase()
      if (key === ' ' || key === 'enter') {
        e.preventDefault()
        if (d.phase === 'CELEBRATION' || d.phase === 'COMPLETE') {
          const more = d.batch && d.batch.winners.length < d.batch.total
          if (more) ctrl.continueBatch()
          else ctrl.dismiss()
        } else if (d.phase === 'IDLE') ctrl.spin()
      } else if (key === 'f') void fs.toggle()
      else if (key === 's' && isSpinning(d.phase)) ctrl.emergencyStop()
      else if (key === 'l') ctrl.toggleLock()
      else if (key === 'n') goToNextPrize()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctrl, fs, goToNextPrize])

  // Wheel size: as large as the viewport allows.
  const wheelSize = presentation ? 'w-[min(92vw,calc(100dvh-380px))] wide:w-[min(52vw,calc(100dvh-350px))]' : 'w-[min(92vw,56dvh)] wide:w-[min(50vw,calc(100dvh-330px))]'

  return (
    <div
      className={`stage-grain relative flex flex-col text-white ${presentation ? 'h-dvh overflow-hidden' : 'min-h-dvh overflow-x-hidden wide:h-dvh wide:overflow-hidden'}`}
      style={{
        ...(brandCssVars(b) as React.CSSProperties),
        color: b.textColor,
        background: `radial-gradient(ellipse 70% 60% at 70% 55%, ${rgba(b.primaryColor, 0.16)} 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 10% 0%, ${rgba(b.accentColor, 0.08)} 0%, transparent 60%), linear-gradient(180deg, ${mix(b.backgroundColor, '#ffffff', 0.03)} 0%, ${b.backgroundColor} 100%)`,
      }}
    >
      {/* Header */}
      <header className={`relative z-20 flex items-center gap-4 px-[clamp(16px,3vw,48px)] pt-[clamp(12px,2.2vh,32px)] ${presentation ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex min-w-0 items-center gap-[clamp(10px,1.2vw,20px)] ${presentation ? 'flex-col wide:flex-row' : ''}`}>
          <BrandLogo logo={b.logo} companyName={b.companyName} variant="badge" className={`shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] ${presentation ? 'h-[clamp(48px,7vh,96px)] w-[clamp(48px,7vh,96px)]' : 'h-12 w-12'}`} />
          <div className={`min-w-0 ${presentation ? 'text-center wide:text-left' : ''}`}>
            <p className="stage-kicker truncate text-[clamp(0.65rem,1.1vh,0.9rem)] text-white/55">{b.companyName} presents</p>
            <h1 className={`truncate font-display font-semibold tracking-tight ${presentation ? 'text-[clamp(1.4rem,3.6vh,3.2rem)]' : 'text-xl sm:text-2xl'}`}>{event.eventName}</h1>
          </div>
        </div>
        {!presentation && (
          <div className="flex items-center gap-2">
            {event.isDemo && <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70 ring-1 ring-white/10 sm:inline">Demo data</span>}
            <Link
              to="/admin"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/6 px-4 text-sm font-semibold tracking-wide text-white/70 ring-1 ring-white/10 transition hover:bg-white/12 hover:text-white"
            >
              <Settings2 size={16} /> ADMIN
            </Link>
          </div>
        )}
      </header>

      {/* Main: prize beside the wheel on landscape screens, stacked on portrait/mobile. */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-[2vh] px-[clamp(16px,3vw,56px)] py-[1.5vh] wide:flex-row wide:gap-[6vw]">
        <div className="w-full max-w-[640px] wide:w-[min(30vw,560px)] wide:flex-none">
          <PrizeShowcase prize={prize} remaining={remaining} branding={b} big={presentation} emptyText={presentation ? event.description || 'Good luck, everyone!' : 'No prize selected — pick one below or in Admin.'} />
        </div>
        <div className="flex min-h-0 flex-col items-center justify-center gap-[1.8vh]">
          <div className={`relative ${wheelSize} max-w-[1400px]`}>
            <Wheel
              ref={wheelRef}
              names={names}
              colors={colors}
              branding={b}
              phase={phase}
              grand={grand}
              highlightIndex={revealing ? current!.segmentIndex : null}
              celebrate={phase === 'CELEBRATION' || phase === 'COMPLETE'}
              reducedMotion={reduced}
              onTick={onTick}
              onPointerIndex={onPointerIndex}
              onSpeed={onSpeed}
            />
          </div>
          {/* Live name under the pointer (the only way to read 1,000-name wheels). */}
          <div className="h-[clamp(28px,4vh,48px)]" aria-hidden={!spinning}>
            <motion.div
              animate={{ opacity: spinning ? 1 : 0, y: spinning ? 0 : 6 }}
              className="rounded-full bg-white/8 px-5 py-1.5 font-display text-[clamp(1rem,2.4vh,1.8rem)] font-semibold ring-1 ring-white/12"
            >
              <span ref={liveNameRef} />
            </motion.div>
          </div>
          <SpinButton phase={phase} locked={locked} disabled={!!blocker && !pendingBatch} label={spinLabel} color={b.primaryColor} size={presentation ? 'lg' : 'md'} onSpin={ctrl.spin} />
          <p className="tabular text-center text-[clamp(0.8rem,1.5vh,1.15rem)] text-white/55">
            {blocker && phase === 'IDLE' && !pendingBatch ? (
              <span className="flex flex-col items-center gap-3">
                <span className="text-white/80">{blocker}</span>
                {prize && remaining <= 0 && nextPrize && !locked && (
                  <button
                    onClick={(e) => {
                      goToNextPrize()
                      e.currentTarget.blur()
                    }}
                    className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/16"
                  >
                    Next prize: {nextPrize.name} →
                  </button>
                )}
              </span>
            ) : (
              <>
                <span className="font-semibold text-white/85">{n(event.participants.length)}</span> participants
                {eligible.length !== event.participants.length && (
                  <>
                    {' · '}
                    <span className="font-semibold text-white/85">{n(eligible.length)}</span> in the draw
                  </>
                )}
              </>
            )}
          </p>
        </div>
      </main>

      {!presentation && onPresent && <OperatorBar event={event} ctrl={ctrl} onPresent={onPresent} />}
      {presentation && onExitPresentation && <PresenterControls ctrl={ctrl} fs={fs} onExit={onExitPresentation} />}

      <AnimatePresence>
        {revealing && current && (
          <WinnerReveal
            key={current.record?.id ?? current.participant.id}
            phase={phase}
            current={current}
            batch={batch}
            branding={b}
            reduced={reduced}
            onNameRevealed={ctrl.onNameRevealed}
            onCelebrate={ctrl.onCelebrate}
            onContinue={ctrl.continueBatch}
            onClose={closeReveal}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
