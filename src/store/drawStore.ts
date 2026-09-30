import { create } from 'zustand'
import type { AnimationMode, DrawPhase, Participant, Prize, WinnerRecord } from '../types'
import type { ModeTimings } from '../lib/wheel/timings'

export interface CurrentDraw {
  eventId: string
  participant: Participant
  prize: Prize | null
  segmentIndex: number
  segmentCount: number
  mode: AnimationMode
  timings: ModeTimings
  record: WinnerRecord | null
  /** 1-based position inside a multi-winner batch. */
  batchPosition: number
  batchTotal: number
}

export interface BatchState {
  eventId: string
  total: number
  prizeId: string | null
  winners: { participantId: string; name: string; drawNumber: number }[]
}

interface DrawState {
  phase: DrawPhase
  locked: boolean
  current: CurrentDraw | null
  /** Frozen wheel list while a draw is in progress, so segments can't shift mid-spin. */
  wheelList: Participant[] | null
  batch: BatchState | null
  set(p: Partial<Omit<DrawState, 'set'>>): void
}

export const useDraw = create<DrawState>((set) => ({
  phase: 'IDLE',
  locked: false,
  current: null,
  wheelList: null,
  batch: null,
  set: (p) => set(p),
}))

export const SPINNING_PHASES: DrawPhase[] = ['PRE_SPIN', 'ACCELERATING', 'FULL_SPEED', 'DECELERATING', 'FINAL_SLOWDOWN', 'LANDING']
export const REVEAL_PHASES: DrawPhase[] = ['SUSPENSE', 'WINNER_REVEAL', 'CELEBRATION', 'COMPLETE']
export const isSpinning = (p: DrawPhase) => SPINNING_PHASES.includes(p)
export const isRevealing = (p: DrawPhase) => REVEAL_PHASES.includes(p)

// Dev-only hook for end-to-end tests / debugging.
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __draw: typeof useDraw }).__draw = useDraw
