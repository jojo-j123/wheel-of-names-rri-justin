/**
 * Core domain types for RRI Event Wheel.
 * Everything that is persisted lives on `EventData`; draw/animation runtime state is separate.
 */

export interface Participant {
  id: string
  name: string
  email?: string
  phone?: string
  /** Extra CSV columns. Admin-only — never shown on stage. */
  metadata?: Record<string, string>
  createdAt: number
}

export interface Prize {
  id: string
  name: string
  description?: string
  /** Data URL (uploaded) or public path. */
  image?: string
  quantity: number
  value?: string
  sponsor?: string
  enabled: boolean
  createdAt: number
}

export interface WinnerRecord {
  id: string
  participantId: string
  participantName: string
  prizeId: string | null
  prizeName: string
  eventId: string
  drawNumber: number
  timestamp: number
  /** True when the winner was removed from future draws by this draw (undo restores them). */
  removedFromPool: boolean
  mode: AnimationMode
}

export interface Branding {
  companyName: string
  /** Data URL or public path. */
  logo: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
}

export type AnimationMode = 'standard' | 'dramatic' | 'grand'

export type WinnersPerDraw = 1 | 3 | 5 | 10

export interface WheelSettings {
  removeWinners: boolean
  preventDuplicates: boolean
  winnersPerDraw: WinnersPerDraw
  sound: boolean
  confetti: boolean
}

export type ReducedMotionSetting = 'system' | 'on' | 'off'

export interface AnimationSettings {
  mode: AnimationMode
  /** Total spin length in seconds. null = use the mode's default. */
  spinDuration: number | null
  /** Full wheel turns. null = use the mode's default. */
  rotations: number | null
  reducedMotion: ReducedMotionSetting
  /** Enter browser fullscreen automatically when the live event starts. */
  autoFullscreen: boolean
}

export interface AuditEntry {
  id: string
  timestamp: number
  message: string
}

export interface EventData {
  id: string
  eventName: string
  eventDate: string
  description: string
  participants: Participant[]
  prizes: Prize[]
  winnerHistory: WinnerRecord[]
  activePrizeId: string | null
  branding: Branding
  wheelSettings: WheelSettings
  animationSettings: AnimationSettings
  auditLog: AuditEntry[]
  isDemo: boolean
  createdAt: number
  updatedAt: number
}

export interface EventTemplate {
  id: string
  name: string
  description: string
  builtIn: boolean
  branding: Branding
  wheelSettings: WheelSettings
  animationSettings: AnimationSettings
  prizes: Omit<Prize, 'id' | 'createdAt'>[]
  createdAt: number
}

/** Full cinematic sequence, in order. */
export type DrawPhase =
  | 'IDLE'
  | 'PRE_SPIN'
  | 'ACCELERATING'
  | 'FULL_SPEED'
  | 'DECELERATING'
  | 'FINAL_SLOWDOWN'
  | 'LANDING'
  | 'SUSPENSE'
  | 'WINNER_REVEAL'
  | 'CELEBRATION'
  | 'COMPLETE'
