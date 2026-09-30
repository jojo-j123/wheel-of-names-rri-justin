import { useCallback, useEffect, useRef } from 'react'
import type { DrawPhase } from '../types'
import type { WheelHandle } from '../components/wheel/WheelCanvas'
import { celebrate, stopCelebration } from '../components/winner/Celebration'
import { sound } from '../lib/audio/soundEngine'
import { planDraw } from '../lib/draw/selectWinner'
import { appendAudit, prizeRemaining, recordWinner, undoLastDraw } from '../lib/event/operations'
import { secureRandomFloat } from '../lib/random/secureRandom'
import { resolveTimings } from '../lib/wheel/timings'
import { segmentAtPointer } from '../lib/wheel/wheelMath'
import { mix } from '../lib/branding'
import { useApp } from '../store/appStore'
import { isRevealing, isSpinning, useDraw, type BatchState } from '../store/drawStore'
import { toast } from '../store/toastStore'

/**
 * Orchestrates one fair draw:
 *   secure pick → target segment → target rotation → cinematic spin → exact landing → record → reveal.
 * The winner is fixed before the wheel moves; the animation only visualises it.
 */
export function useDrawController(eventId: string, wheelRef: React.RefObject<WheelHandle | null>, reducedMotion: boolean) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms))
  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  const setPhase = (phase: DrawPhase) => useDraw.getState().set({ phase })
  const getEvent = () => useApp.getState().events[eventId]

  const dismiss = useCallback(() => {
    clearTimers()
    stopCelebration()
    const { batch } = useDraw.getState()
    const more = batch && batch.winners.length < batch.total
    useDraw.getState().set({ phase: 'IDLE', current: null, wheelList: null, batch: more ? batch : null })
  }, [])

  const spin = useCallback(() => {
    const d = useDraw.getState()
    if (d.locked) {
      toast.info('Controls are locked. Unlock them to spin.')
      return
    }
    if (isSpinning(d.phase) || (isRevealing(d.phase) && d.phase !== 'COMPLETE' && d.phase !== 'CELEBRATION')) return
    if (isRevealing(d.phase)) dismiss()
    const wheel = wheelRef.current
    const ev = getEvent()
    if (!wheel || !ev) return

    sound.enabled = ev.wheelSettings.sound
    sound.unlock()

    // Continue an unfinished multi-winner batch for the same prize, otherwise start a new one.
    let batch: BatchState | null = useDraw.getState().batch
    if (batch && (batch.eventId !== ev.id || batch.prizeId !== ev.activePrizeId || batch.winners.length >= batch.total)) batch = null
    const exclude = new Set(batch?.winners.map((w) => w.participantId))

    // 1–3. Validate + secure random selection (crypto.getRandomValues).
    const plan = planDraw(ev, exclude)
    if (!plan.ok) {
      toast.error(plan.reason)
      useDraw.getState().set({ batch: null })
      return
    }
    if (!batch) {
      const stock = plan.prize ? prizeRemaining(ev, plan.prize) : Number.POSITIVE_INFINITY
      const total = Math.max(1, Math.min(ev.wheelSettings.winnersPerDraw, plan.eligible.length, stock))
      batch = { eventId: ev.id, total, prizeId: plan.prize?.id ?? null, winners: [] }
    }
    const timings = resolveTimings(ev.animationSettings, { reducedMotion })
    const count = plan.eligible.length
    // 4. Store the selected winner before anything moves.
    useDraw.getState().set({
      phase: 'PRE_SPIN',
      wheelList: plan.eligible,
      batch,
      current: {
        eventId: ev.id,
        participant: plan.winner,
        prize: plan.prize,
        segmentIndex: plan.index,
        segmentCount: count,
        mode: ev.animationSettings.mode,
        timings,
        record: null,
        batchPosition: batch.winners.length + 1,
        batchTotal: batch.total,
      },
    })
    sound.play('spin_start')

    // 5–8. Target segment → target rotation → animation (inside WheelCanvas.spin).
    // Wait one frame so the wheel face reflects the frozen snapshot.
    requestAnimationFrame(() => {
      const started = wheel.spin({
        targetIndex: plan.index,
        count,
        timings,
        offsetFraction: (secureRandomFloat() * 2 - 1) * 0.26,
        onPhase(p) {
          setPhase(p)
          if (p === 'ACCELERATING') sound.play('spin_loop')
          if (p === 'FINAL_SLOWDOWN') sound.play('slowdown')
        },
        onLanded() {
          sound.stopAll()
          sound.play('final_tick')
          const landed = segmentAtPointer(wheel.getRotation(), count)
          if (landed !== plan.index) {
            // Should be impossible (covered by tests). The pre-selected winner stays authoritative.
            console.error(`[RRI Event Wheel] Landing mismatch: expected ${plan.index}, got ${landed}`)
          }
          const latest = getEvent()
          if (!latest) return
          const removeFromPool = latest.wheelSettings.removeWinners
          let recordRef = null as ReturnType<typeof recordWinner>['record'] | null
          useApp.getState().mutateEvent(
            eventId,
            (e) => {
              const r = recordWinner(e, { participant: plan.winner, prize: plan.prize, mode: latest.animationSettings.mode, removeFromPool })
              recordRef = r.record
              return r.event
            },
            { immediate: true },
          )
          const st = useDraw.getState()
          const b = st.batch
          const nextBatch = b && recordRef ? { ...b, winners: [...b.winners, { participantId: plan.winner.id, name: plan.winner.name, drawNumber: recordRef.drawNumber }] } : b
          st.set({ phase: 'SUSPENSE', batch: nextBatch, current: st.current ? { ...st.current, record: recordRef } : null })
          later(timings.suspense * 1000, () => setPhase('WINNER_REVEAL'))
        },
      })
      if (!started) {
        useDraw.getState().set({ phase: 'IDLE', current: null, wheelList: null })
        toast.error('The wheel isn’t ready yet. Please try again.')
      }
    })
  }, [eventId, reducedMotion, wheelRef, dismiss])

  const onNameRevealed = useCallback(() => {
    const cur = useDraw.getState().current
    sound.play('winner_reveal', cur?.mode === 'grand' ? 1.5 : 1)
  }, [])

  const onCelebrate = useCallback(() => {
    const d = useDraw.getState()
    const ev = getEvent()
    if (!ev || d.phase !== 'WINNER_REVEAL') return
    setPhase('CELEBRATION')
    const grand = d.current?.mode === 'grand'
    if (ev.wheelSettings.confetti) {
      const b = ev.branding
      celebrate({ colors: [b.primaryColor, b.accentColor, '#ffffff', mix(b.accentColor, '#ffffff', 0.5)], grand, reduced: reducedMotion })
    }
    sound.play('celebration', grand ? 1.5 : 1)
    later(grand ? 4000 : 2600, () => {
      if (useDraw.getState().phase === 'CELEBRATION') setPhase('COMPLETE')
    })
  }, [reducedMotion])

  /** Stops the wheel immediately. A draw stopped before landing records no winner. */
  const emergencyStop = useCallback(() => {
    const d = useDraw.getState()
    wheelRef.current?.stop()
    sound.stopAll()
    clearTimers()
    stopCelebration()
    if (isSpinning(d.phase)) {
      useApp.getState().mutateEvent(eventId, (e) => appendAudit(e, 'A spin was stopped by the operator before it finished. No winner was recorded.'), { immediate: true })
      toast.info('Spin stopped. No winner was recorded.')
    }
    useDraw.getState().set({ phase: 'IDLE', current: null, wheelList: null, batch: null })
  }, [eventId, wheelRef])

  /** Clears whatever is on screen (reveal, pending multi-winner batch). Recorded winners stay recorded. */
  const resetCurrentDraw = useCallback(() => {
    emergencyStop()
  }, [emergencyStop])

  const undoLast = useCallback(() => {
    const d = useDraw.getState()
    if (isSpinning(d.phase)) {
      toast.info('Wait for the wheel to stop first.')
      return
    }
    let undone: string | null = null
    useApp.getState().mutateEvent(
      eventId,
      (e) => {
        const r = undoLastDraw(e)
        undone = r.undone ? `${r.undone.participantName} (draw #${r.undone.drawNumber})` : null
        return r.event
      },
      { immediate: true },
    )
    clearTimers()
    stopCelebration()
    useDraw.getState().set({ phase: 'IDLE', current: null, wheelList: null, batch: null })
    if (undone) toast.success(`Undone: ${undone}. They are back in the draw.`)
    else toast.info('There is no draw to undo.')
  }, [eventId])

  const toggleLock = useCallback(() => {
    const locked = !useDraw.getState().locked
    useDraw.getState().set({ locked })
    toast.info(locked ? 'Controls locked.' : 'Controls unlocked.')
  }, [])

  const continueBatch = useCallback(() => {
    dismiss()
    later(650, () => spin())
  }, [dismiss, spin])

  // Leaving the screen mid-draw must never leave the app stuck.
  useEffect(
    () => () => {
      clearTimers()
      sound.stopAll()
      stopCelebration()
      useDraw.getState().set({ phase: 'IDLE', current: null, wheelList: null, batch: null })
    },
    [eventId],
  )

  return { spin, dismiss, continueBatch, emergencyStop, resetCurrentDraw, undoLast, toggleLock, onNameRevealed, onCelebrate }
}

export type DrawController = ReturnType<typeof useDrawController>
