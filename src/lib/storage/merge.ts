import type { EventData } from '../../types'

function unionById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const seen = new Map<string, T>()
  for (const x of a) seen.set(x.id, x)
  for (const x of b) if (!seen.has(x.id)) seen.set(x.id, x)
  return [...seen.values()]
}

/**
 * Resolve a conflict where two devices changed the same event.
 * The newer version wins for everything EXCEPT winner history and the activity log,
 * which are merged — a winner recorded on stage is never lost because someone edited
 * names on another device at the same moment. Given the last common version (`base`),
 * names and prizes the older side added since then are kept too.
 */
/** Items the older side *added* since the last common version (so they can't be in the newer side yet). */
function addedSince<T extends { id: string; createdAt?: number }>(newer: T[], older: T[], base: number): T[] {
  const have = new Set(newer.map((x) => x.id))
  return older.filter((x) => !have.has(x.id) && (x.createdAt ?? 0) > base)
}

export function mergeConflict(newer: EventData, older: EventData, now = Date.now(), base?: number): EventData {
  const winners = unionById(newer.winnerHistory, older.winnerHistory).sort((x, y) => x.drawNumber - y.drawNumber || x.timestamp - y.timestamp)
  // Two devices may have both issued the same draw number; renumber by time so history stays clean.
  const renumbered = [...winners].sort((x, y) => x.timestamp - y.timestamp).map((w, i) => (w.drawNumber === i + 1 ? w : { ...w, drawNumber: i + 1 }))
  const auditLog = unionById(newer.auditLog, older.auditLog).sort((x, y) => x.timestamp - y.timestamp).slice(-500)
  // Names and prizes added on both devices at the same time are all kept (deletions still follow the newer side).
  const participants = base === undefined ? newer.participants : [...newer.participants, ...addedSince(newer.participants, older.participants, base)]
  const prizes = base === undefined ? newer.prizes : [...newer.prizes, ...addedSince(newer.prizes, older.prizes, base)]
  return { ...newer, participants, prizes, winnerHistory: renumbered, auditLog, updatedAt: Math.max(now, newer.updatedAt + 1, older.updatedAt + 1) }
}
