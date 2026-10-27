import type { AnimationSettings, EventData, WheelSettings } from '../../types'
import { DEFAULT_BRANDING } from '../branding'
import { createId } from '../random/secureRandom'

export const DEFAULT_WHEEL_SETTINGS: WheelSettings = {
  removeWinners: true,
  preventDuplicates: false,
  winnersPerDraw: 1,
  sound: true,
  confetti: true,
  showPrize: true,
}

export const DEFAULT_ANIMATION_SETTINGS: AnimationSettings = {
  mode: 'dramatic',
  spinDuration: null,
  rotations: null,
  reducedMotion: 'system',
  autoFullscreen: true,
}

export function createEmptyEvent(name = 'New Event'): EventData {
  const now = Date.now()
  return {
    id: createId('evt'),
    eventName: name,
    eventDate: new Date(now).toISOString().slice(0, 10),
    description: '',
    participants: [],
    prizes: [],
    winnerHistory: [],
    activePrizeId: null,
    branding: { ...DEFAULT_BRANDING },
    wheelSettings: { ...DEFAULT_WHEEL_SETTINGS },
    animationSettings: { ...DEFAULT_ANIMATION_SETTINGS },
    auditLog: [],
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  }
}

/** Blank event shown when there are no events yet (or the last one was deleted). */
export function createStarterEvent(): EventData {
  return createEmptyEvent('My Event')
}

/** A blank event nobody has touched yet: no names, prizes or winners, and unchanged since it was created. */
export function isPristineStarter(e: EventData): boolean {
  return !e.participants.length && !e.prizes.length && !e.winnerHistory.length && e.updatedAt - e.createdAt < 5000
}
