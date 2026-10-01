/**
 * Pure event operations. Every function returns a NEW event object and never mutates input,
 * which keeps the store simple and makes all of this directly unit-testable.
 */
import type { AnimationMode, EventData, EventTemplate, Participant, Prize, WinnerRecord } from '../../types'
import { createId, secureShuffle } from '../random/secureRandom'
import { createEmptyEvent } from './defaults'

export interface ParticipantInput {
  name: string
  email?: string
  phone?: string
  metadata?: Record<string, string>
}

export const MAX_PARTICIPANTS = 5000
export const MAX_NAME_LENGTH = 80

export function cleanName(name: string): string {
  // Invisible characters (zero-width space, BOM, soft hyphen) sneak in when copying from chats, web pages or Excel.
  // Zero-width joiners stay: emoji and some scripts need them — but a name made only of them is blank.
  const s = String(name ?? '').replace(/[\u200B\u2060\uFEFF\u00AD]/g, '').replace(/\s+/g, ' ').trim()
  return /^[\u200C\u200D]*$/.test(s) ? '' : s.slice(0, MAX_NAME_LENGTH)
}

/** Key used for duplicate detection: case/space/accent-insensitive. */
export function duplicateKey(name: string): string {
  return cleanName(name).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function touch(e: EventData): EventData {
  return { ...e, updatedAt: Date.now() }
}

export function makeParticipant(input: ParticipantInput): Participant {
  const p: Participant = { id: createId('p'), name: cleanName(input.name), createdAt: Date.now() }
  const email = input.email?.trim()
  const phone = input.phone?.trim()
  if (email) p.email = email
  if (phone) p.phone = phone
  if (input.metadata && Object.keys(input.metadata).length) p.metadata = input.metadata
  return p
}

export interface AddResult {
  event: EventData
  added: number
  skippedDuplicates: number
  skippedInvalid: number
  skippedOverLimit: number
}

export function addParticipants(
  event: EventData,
  inputs: ParticipantInput[],
  opts: { preventDuplicates: boolean },
): AddResult {
  const seen = new Set(event.participants.map((p) => duplicateKey(p.name)))
  const next: Participant[] = []
  let skippedDuplicates = 0
  let skippedInvalid = 0
  let skippedOverLimit = 0
  for (const input of inputs) {
    const name = cleanName(input?.name ?? '')
    if (!name) {
      skippedInvalid++
      continue
    }
    const key = duplicateKey(name)
    if (opts.preventDuplicates && seen.has(key)) {
      skippedDuplicates++
      continue
    }
    if (event.participants.length + next.length >= MAX_PARTICIPANTS) {
      skippedOverLimit++
      continue
    }
    seen.add(key)
    next.push(makeParticipant({ ...input, name }))
  }
  return {
    event: next.length ? touch({ ...event, participants: [...event.participants, ...next] }) : event,
    added: next.length,
    skippedDuplicates,
    skippedInvalid,
    skippedOverLimit,
  }
}

export class FriendlyError extends Error {}

export function updateParticipant(
  event: EventData,
  id: string,
  patch: ParticipantInput,
  opts: { preventDuplicates: boolean },
): EventData {
  const name = cleanName(patch.name)
  if (!name) throw new FriendlyError('Please enter a name.')
  if (opts.preventDuplicates) {
    const key = duplicateKey(name)
    if (event.participants.some((p) => p.id !== id && duplicateKey(p.name) === key)) {
      throw new FriendlyError(`“${name}” is already on the list.`)
    }
  }
  return touch({
    ...event,
    participants: event.participants.map((p) => {
      if (p.id !== id) return p
      const u: Participant = { ...p, name }
      u.email = patch.email?.trim() || undefined
      u.phone = patch.phone?.trim() || undefined
      return u
    }),
  })
}

export function removeParticipants(event: EventData, ids: Iterable<string>): EventData {
  const set = new Set(ids)
  return touch({ ...event, participants: event.participants.filter((p) => !set.has(p.id)) })
}

export function clearParticipants(event: EventData): EventData {
  return touch({ ...event, participants: [] })
}

export function shuffleParticipants(event: EventData): EventData {
  return touch({ ...event, participants: secureShuffle(event.participants) })
}

/** IDs of every participant whose name appears more than once (including the first). */
export function findDuplicateIds(participants: Participant[]): Set<string> {
  const groups = new Map<string, string[]>()
  for (const p of participants) {
    const k = duplicateKey(p.name)
    const g = groups.get(k)
    if (g) g.push(p.id)
    else groups.set(k, [p.id])
  }
  const out = new Set<string>()
  for (const g of groups.values()) if (g.length > 1) g.forEach((id) => out.add(id))
  return out
}

/** Keep the first occurrence of each name, drop the rest. */
export function removeDuplicates(event: EventData): { event: EventData; removed: number } {
  const seen = new Set<string>()
  const kept = event.participants.filter((p) => {
    const k = duplicateKey(p.name)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const removed = event.participants.length - kept.length
  return { event: removed ? touch({ ...event, participants: kept }) : event, removed }
}

/* ------------------------------------------------------------------ eligibility */

/** Participants taken out of the pool by past draws. Derived from history, so undo "just works". */
export function removedParticipantIds(event: EventData): Set<string> {
  const s = new Set<string>()
  for (const w of event.winnerHistory) if (w.removedFromPool) s.add(w.participantId)
  return s
}

export function winnerParticipantIds(event: EventData): Set<string> {
  return new Set(event.winnerHistory.map((w) => w.participantId))
}

/**
 * Participants who can win the next draw, in stable list order.
 * That order is also the wheel's segment order (segment i = eligible[i]).
 */
export function getEligibleParticipants(event: EventData, alsoExclude?: Set<string>): Participant[] {
  const removed = removedParticipantIds(event)
  return event.participants.filter((p) => !removed.has(p.id) && !(alsoExclude && alsoExclude.has(p.id)))
}

/* ------------------------------------------------------------------ prizes */

export interface PrizeInput {
  name: string
  description?: string
  image?: string
  quantity: number
  value?: string
  sponsor?: string
  enabled?: boolean
}

function cleanPrize(input: PrizeInput): Omit<Prize, 'id' | 'createdAt'> {
  const name = cleanName(input.name)
  if (!name) throw new FriendlyError('Please give the prize a name.')
  const q = Math.floor(Number(input.quantity))
  return {
    name,
    description: input.description?.trim() || undefined,
    image: input.image || undefined,
    quantity: Number.isFinite(q) && q >= 1 ? Math.min(q, 10000) : 1,
    value: input.value?.trim() || undefined,
    sponsor: input.sponsor?.trim() || undefined,
    enabled: input.enabled ?? true,
  }
}

export function addPrize(event: EventData, input: PrizeInput): { event: EventData; prize: Prize } {
  const prize: Prize = { id: createId('prz'), createdAt: Date.now(), ...cleanPrize(input) }
  const next = touch({ ...event, prizes: [...event.prizes, prize] })
  if (!next.activePrizeId && prize.enabled) next.activePrizeId = prize.id
  return { event: next, prize }
}

export function updatePrize(event: EventData, id: string, input: PrizeInput): EventData {
  const cleaned = cleanPrize(input)
  const next = touch({ ...event, prizes: event.prizes.map((p) => (p.id === id ? { ...p, ...cleaned } : p)) })
  return ensureActivePrize(next)
}

export function setPrizeEnabled(event: EventData, id: string, enabled: boolean): EventData {
  return ensureActivePrize(touch({ ...event, prizes: event.prizes.map((p) => (p.id === id ? { ...p, enabled } : p)) }))
}

export function removePrize(event: EventData, id: string): EventData {
  return ensureActivePrize(touch({ ...event, prizes: event.prizes.filter((p) => p.id !== id) }))
}

export function prizeAwardedCount(event: EventData, prizeId: string): number {
  let n = 0
  for (const w of event.winnerHistory) if (w.prizeId === prizeId) n++
  return n
}

export function prizeRemaining(event: EventData, prize: Prize): number {
  return Math.max(0, prize.quantity - prizeAwardedCount(event, prize.id))
}

export function setActivePrize(event: EventData, prizeId: string | null): EventData {
  if (prizeId && !event.prizes.some((p) => p.id === prizeId)) return event
  return touch({ ...event, activePrizeId: prizeId })
}

export function getActivePrize(event: EventData): Prize | null {
  const p = event.prizes.find((x) => x.id === event.activePrizeId)
  return p && p.enabled ? p : null
}

/** If the active prize disappeared or was disabled, fall back to the first available one. */
export function ensureActivePrize(event: EventData): EventData {
  const current = event.prizes.find((p) => p.id === event.activePrizeId)
  if (current && current.enabled) return event
  const fallback = event.prizes.find((p) => p.enabled && prizeRemaining(event, p) > 0) ?? event.prizes.find((p) => p.enabled)
  const nextId = fallback ? fallback.id : null
  return nextId === event.activePrizeId ? event : { ...event, activePrizeId: nextId }
}

/** First enabled prize after `currentId` (in list order) that still has stock. */
export function nextPrizeWithStock(event: EventData, currentId: string | null): Prize | null {
  const list = event.prizes.filter((p) => p.enabled && prizeRemaining(event, p) > 0)
  if (!list.length) return null
  const idx = event.prizes.findIndex((p) => p.id === currentId)
  return list.find((p) => event.prizes.indexOf(p) > idx) ?? list[0]
}

/* ------------------------------------------------------------------ draws */

export interface RecordWinnerInput {
  participant: Participant
  prize: Prize | null
  mode: AnimationMode
  removeFromPool: boolean
}

export function recordWinner(event: EventData, input: RecordWinnerInput): { event: EventData; record: WinnerRecord } {
  const lastNumber = event.winnerHistory.reduce((m, w) => Math.max(m, w.drawNumber), 0)
  const record: WinnerRecord = {
    id: createId('win'),
    participantId: input.participant.id,
    participantName: input.participant.name,
    prizeId: input.prize?.id ?? null,
    prizeName: input.prize?.name ?? 'No prize selected',
    eventId: event.id,
    drawNumber: lastNumber + 1,
    timestamp: Date.now(),
    removedFromPool: input.removeFromPool,
    mode: input.mode,
  }
  return { event: touch({ ...event, winnerHistory: [...event.winnerHistory, record] }), record }
}

/** Removes the most recent draw. If that winner had been removed from the pool, they become eligible again. */
export function undoLastDraw(event: EventData): { event: EventData; undone: WinnerRecord | null } {
  if (!event.winnerHistory.length) return { event, undone: null }
  const last = event.winnerHistory.reduce((a, b) => (b.drawNumber > a.drawNumber ? b : a))
  return {
    event: appendAudit(
      touch({ ...event, winnerHistory: event.winnerHistory.filter((w) => w.id !== last.id) }),
      `Draw #${last.drawNumber} (${last.participantName} — ${last.prizeName}) was undone.`,
    ),
    undone: last,
  }
}

export function deleteWinnerRecord(event: EventData, id: string): EventData {
  const rec = event.winnerHistory.find((w) => w.id === id)
  if (!rec) return event
  return appendAudit(
    touch({ ...event, winnerHistory: event.winnerHistory.filter((w) => w.id !== id) }),
    `Winner record #${rec.drawNumber} (${rec.participantName}) was deleted.`,
  )
}

export function clearWinnerHistory(event: EventData): EventData {
  return appendAudit(touch({ ...event, winnerHistory: [] }), 'Winner history was cleared.')
}

/** Everyone becomes eligible again, all prize stock is restored. Participants and prizes are kept. */
export function resetEvent(event: EventData): EventData {
  return appendAudit(touch({ ...event, winnerHistory: [] }), 'Event was reset.')
}

export function appendAudit(event: EventData, message: string): EventData {
  const entry = { id: createId('log'), timestamp: Date.now(), message }
  return { ...event, auditLog: [...event.auditLog, entry].slice(-500) }
}

/* ------------------------------------------------------------------ events & templates */

export function duplicateEvent(event: EventData): EventData {
  const now = Date.now()
  const idMap = new Map<string, string>()
  const prizes = event.prizes.map((p) => {
    const id = createId('prz')
    idMap.set(p.id, id)
    return { ...p, id }
  })
  return {
    ...structuredClone(event),
    id: createId('evt'),
    eventName: `${event.eventName} (copy)`,
    participants: event.participants.map((p) => ({ ...p, id: createId('p') })),
    prizes,
    activePrizeId: event.activePrizeId ? idMap.get(event.activePrizeId) ?? null : null,
    winnerHistory: [],
    auditLog: [],
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function eventToTemplate(event: EventData, name: string, description = ''): EventTemplate {
  return {
    id: createId('tpl'),
    name: cleanName(name) || event.eventName,
    description,
    builtIn: false,
    branding: { ...event.branding },
    wheelSettings: { ...event.wheelSettings },
    animationSettings: { ...event.animationSettings },
    prizes: event.prizes.map(({ id: _id, createdAt: _c, ...rest }) => rest),
    createdAt: Date.now(),
  }
}

/** New event from a template: branding, settings and prizes are copied; participants and winners start empty. */
export function eventFromTemplate(template: EventTemplate, eventName: string): EventData {
  const base = createEmptyEvent(cleanName(eventName) || template.name)
  const prizes: Prize[] = template.prizes.map((p) => ({ ...p, id: createId('prz'), createdAt: Date.now() }))
  return {
    ...base,
    branding: { ...template.branding },
    wheelSettings: { ...template.wheelSettings },
    animationSettings: { ...template.animationSettings },
    prizes,
    activePrizeId: prizes.find((p) => p.enabled)?.id ?? null,
  }
}
