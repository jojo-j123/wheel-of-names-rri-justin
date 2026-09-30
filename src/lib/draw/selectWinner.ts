import type { EventData, Participant, Prize } from '../../types'
import { secureRandomInt } from '../random/secureRandom'
import { getActivePrize, getEligibleParticipants, prizeRemaining } from '../event/operations'

export interface DrawPlanOk {
  ok: true
  /** Snapshot of the wheel: segment i = eligible[i]. */
  eligible: Participant[]
  /** Chosen by crypto.getRandomValues BEFORE any animation. */
  index: number
  winner: Participant
  prize: Prize | null
}
export interface DrawPlanError {
  ok: false
  reason: string
}

/**
 * Step 1–3 of the fair draw: validate, pick securely, return the result.
 * The animation is built from this result afterwards and can never change it.
 */
export function planDraw(event: EventData, exclude?: Set<string>): DrawPlanOk | DrawPlanError {
  const eligible = getEligibleParticipants(event, exclude)
  if (!event.participants.length) return { ok: false, reason: 'Add participants in Admin to start drawing.' }
  if (!eligible.length) return { ok: false, reason: 'Everyone has already won. Undo a draw or reset the event to continue.' }
  const prize = getActivePrize(event)
  if (prize && prizeRemaining(event, prize) <= 0) {
    return { ok: false, reason: `All “${prize.name}” prizes have been given away. Choose another prize.` }
  }
  const index = secureRandomInt(eligible.length)
  return { ok: true, eligible, index, winner: eligible[index], prize }
}

/** Uniform pick from an array using the secure source. */
export function pickSecure<T>(items: readonly T[]): { index: number; item: T } {
  if (!items.length) throw new RangeError('Cannot pick from an empty list')
  const index = secureRandomInt(items.length)
  return { index, item: items[index] }
}
