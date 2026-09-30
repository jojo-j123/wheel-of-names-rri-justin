import Papa from 'papaparse'
import type { EventData, WinnerRecord } from '../../types'
import { sanitizeEvent } from '../event/sanitize'
import { formatDateTime } from '../format'

export const EXPORT_APP = 'rri-event-wheel'
export const EXPORT_VERSION = 1

export function eventToJson(event: EventData): string {
  return JSON.stringify({ app: EXPORT_APP, version: EXPORT_VERSION, exportedAt: new Date().toISOString(), event }, null, 2)
}

export function eventFromJson(text: string): EventData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This file isn’t a valid event file. Please choose a file exported from RRI Event Wheel.')
  }
  const e = sanitizeEvent(raw)
  if (!e) throw new Error('We couldn’t read an event from this file. It may be damaged or from another app.')
  return e
}

export function winnersToCsv(winners: WinnerRecord[]): string {
  const rows = [...winners]
    .sort((a, b) => a.drawNumber - b.drawNumber)
    .map((w) => ({
      'Draw #': w.drawNumber,
      Winner: w.participantName,
      Prize: w.prizeName,
      'Date & time': formatDateTime(w.timestamp),
      'Removed from later draws': w.removedFromPool ? 'Yes' : 'No',
      'Animation style': w.mode,
    }))
  return '﻿' + Papa.unparse(rows)
}

export function participantsToCsv(event: EventData): string {
  return '﻿' + Papa.unparse(event.participants.map((p) => ({ name: p.name, email: p.email ?? '', phone: p.phone ?? '' })))
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'event'
}

export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
