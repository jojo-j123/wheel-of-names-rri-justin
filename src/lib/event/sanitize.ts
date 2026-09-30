/**
 * Defensive parsing for anything that comes from storage or an imported file.
 * Bad fields fall back to defaults; unusable data returns null instead of crashing the app.
 */
import type {
  AnimationSettings, AuditEntry, Branding, EventData, EventTemplate, Participant, Prize, WheelSettings, WinnerRecord,
} from '../../types'
import { DEFAULT_BRANDING, isHexColor } from '../branding'
import { createId } from '../random/secureRandom'
import { DEFAULT_ANIMATION_SETTINGS, DEFAULT_WHEEL_SETTINGS } from './defaults'
import { cleanName } from './operations'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, fb = ''): string => (typeof v === 'string' ? v : fb)
const optStr = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)
const num = (v: unknown, fb: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fb)
const bool = (v: unknown, fb: boolean): boolean => (typeof v === 'boolean' ? v : fb)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function sanitizeParticipant(v: unknown): Participant | null {
  if (!isObj(v)) return null
  const name = cleanName(str(v.name))
  if (!name) return null
  const p: Participant = { id: str(v.id) || createId('p'), name, createdAt: num(v.createdAt, Date.now()) }
  if (optStr(v.email)) p.email = str(v.email)
  if (optStr(v.phone)) p.phone = str(v.phone)
  if (isObj(v.metadata)) {
    const m: Record<string, string> = {}
    for (const [k, val] of Object.entries(v.metadata)) if (typeof val === 'string') m[k] = val
    if (Object.keys(m).length) p.metadata = m
  }
  return p
}

function sanitizeImage(v: unknown): string | undefined {
  const s = optStr(v)
  if (!s) return undefined
  if (s.startsWith('data:image/') || s.startsWith('/') || /^https?:\/\//.test(s)) return s
  return undefined
}

function sanitizePrize(v: unknown): Prize | null {
  if (!isObj(v)) return null
  const name = cleanName(str(v.name))
  if (!name) return null
  return {
    id: str(v.id) || createId('prz'),
    name,
    description: optStr(v.description),
    image: sanitizeImage(v.image),
    quantity: Math.max(1, Math.floor(num(v.quantity, 1))),
    value: optStr(v.value),
    sponsor: optStr(v.sponsor),
    enabled: bool(v.enabled, true),
    createdAt: num(v.createdAt, Date.now()),
  }
}

function sanitizeWinner(v: unknown, eventId: string): WinnerRecord | null {
  if (!isObj(v)) return null
  const participantName = cleanName(str(v.participantName))
  if (!participantName) return null
  const mode = v.mode === 'standard' || v.mode === 'grand' ? v.mode : 'dramatic'
  return {
    id: str(v.id) || createId('win'),
    participantId: str(v.participantId),
    participantName,
    prizeId: typeof v.prizeId === 'string' ? v.prizeId : null,
    prizeName: str(v.prizeName, 'Prize'),
    eventId,
    drawNumber: Math.max(1, Math.floor(num(v.drawNumber, 1))),
    timestamp: num(v.timestamp, Date.now()),
    removedFromPool: bool(v.removedFromPool, true),
    mode,
  }
}

export function sanitizeBranding(v: unknown): Branding {
  const b = isObj(v) ? v : {}
  const color = (key: keyof Branding) => (isHexColor(b[key]) ? (b[key] as string) : DEFAULT_BRANDING[key])
  return {
    companyName: cleanName(str(b.companyName)) || DEFAULT_BRANDING.companyName,
    logo: sanitizeImage(b.logo) ?? DEFAULT_BRANDING.logo,
    primaryColor: color('primaryColor'),
    secondaryColor: color('secondaryColor'),
    accentColor: color('accentColor'),
    backgroundColor: color('backgroundColor'),
    textColor: color('textColor'),
    stageTheme: b.stageTheme === 'light' ? 'light' : 'dark',
  }
}

export function sanitizeWheelSettings(v: unknown): WheelSettings {
  const s = isObj(v) ? v : {}
  const wpd = num(s.winnersPerDraw, 1)
  return {
    removeWinners: bool(s.removeWinners, DEFAULT_WHEEL_SETTINGS.removeWinners),
    preventDuplicates: bool(s.preventDuplicates, DEFAULT_WHEEL_SETTINGS.preventDuplicates),
    winnersPerDraw: wpd === 3 || wpd === 5 || wpd === 10 ? wpd : 1,
    sound: bool(s.sound, DEFAULT_WHEEL_SETTINGS.sound),
    confetti: bool(s.confetti, DEFAULT_WHEEL_SETTINGS.confetti),
    showPrize: bool(s.showPrize, DEFAULT_WHEEL_SETTINGS.showPrize),
  }
}

export function sanitizeAnimationSettings(v: unknown): AnimationSettings {
  const s = isObj(v) ? v : {}
  const mode = s.mode === 'standard' || s.mode === 'grand' || s.mode === 'dramatic' ? s.mode : DEFAULT_ANIMATION_SETTINGS.mode
  const rm = s.reducedMotion === 'on' || s.reducedMotion === 'off' ? s.reducedMotion : 'system'
  const dur = typeof s.spinDuration === 'number' && s.spinDuration >= 2 && s.spinDuration <= 30 ? s.spinDuration : null
  const rot = typeof s.rotations === 'number' && s.rotations >= 1 && s.rotations <= 40 ? Math.round(s.rotations) : null
  return { mode, spinDuration: dur, rotations: rot, reducedMotion: rm, autoFullscreen: bool(s.autoFullscreen, true) }
}

export function sanitizeEvent(raw: unknown): EventData | null {
  if (!isObj(raw)) return null
  // Accept the export envelope { app, version, event } as well as a bare event.
  const v = isObj(raw.event) ? raw.event : raw
  if (!isObj(v)) return null
  const eventName = cleanName(str(v.eventName))
  if (!eventName && !Array.isArray(v.participants)) return null
  const id = str(v.id) || createId('evt')
  const participants = arr(v.participants).map(sanitizeParticipant).filter((p): p is Participant => !!p)
  // Guarantee unique participant ids (corrupt files may repeat them).
  const seen = new Set<string>()
  for (const p of participants) {
    if (seen.has(p.id)) p.id = createId('p')
    seen.add(p.id)
  }
  const prizes = arr(v.prizes).map(sanitizePrize).filter((p): p is Prize => !!p)
  const winnerHistory = arr(v.winnerHistory).map((w) => sanitizeWinner(w, id)).filter((w): w is WinnerRecord => !!w)
  const auditLog: AuditEntry[] = arr(v.auditLog)
    .filter(isObj)
    .map((a) => ({ id: str(a.id) || createId('log'), timestamp: num(a.timestamp, Date.now()), message: str(a.message) }))
    .filter((a) => a.message)
  const activePrizeId = typeof v.activePrizeId === 'string' && prizes.some((p) => p.id === v.activePrizeId) ? v.activePrizeId : prizes.find((p) => p.enabled)?.id ?? null
  const now = Date.now()
  return {
    id,
    eventName: eventName || 'Imported Event',
    eventDate: str(v.eventDate),
    description: str(v.description),
    participants,
    prizes,
    winnerHistory,
    activePrizeId,
    branding: sanitizeBranding(v.branding),
    wheelSettings: sanitizeWheelSettings(v.wheelSettings),
    animationSettings: sanitizeAnimationSettings(v.animationSettings),
    auditLog,
    isDemo: bool(v.isDemo, false),
    createdAt: num(v.createdAt, now),
    updatedAt: num(v.updatedAt, now),
  }
}

export function sanitizeTemplate(raw: unknown): EventTemplate | null {
  if (!isObj(raw)) return null
  const name = cleanName(str(raw.name))
  if (!name) return null
  return {
    id: str(raw.id) || createId('tpl'),
    name,
    description: str(raw.description),
    builtIn: false,
    branding: sanitizeBranding(raw.branding),
    wheelSettings: sanitizeWheelSettings(raw.wheelSettings),
    animationSettings: sanitizeAnimationSettings(raw.animationSettings),
    prizes: arr(raw.prizes)
      .map(sanitizePrize)
      .filter((p): p is Prize => !!p)
      .map(({ id: _i, createdAt: _c, ...rest }) => rest),
    createdAt: num(raw.createdAt, Date.now()),
  }
}
