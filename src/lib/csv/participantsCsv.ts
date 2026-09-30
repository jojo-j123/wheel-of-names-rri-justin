import Papa from 'papaparse'
import type { ParticipantInput } from '../event/operations'
import { cleanName } from '../event/operations'

export interface ColumnMapping {
  /** Column index holding the name, or 'first_last' to combine two columns. */
  name: number | 'first_last' | null
  firstName: number | null
  lastName: number | null
  email: number | null
  phone: number | null
}

export interface ParsedTable {
  headers: string[]
  rows: string[][]
  hasHeader: boolean
  mapping: ColumnMapping
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

const NAME_RE = /^(full\s*name|name|participant|attendee|guest|employee|contestant|display\s*name|نام|الاسم|اسم)$/i
const NAME_LOOSE_RE = /name|participant|attendee|guest/i
const FIRST_RE = /^(first(\s|_)?name|given(\s|_)?name|first)$/i
const LAST_RE = /^(last(\s|_)?name|surname|family(\s|_)?name|last)$/i
const EMAIL_RE = /e-?mail/i
const PHONE_RE = /phone|mobile|tel|cell|whatsapp/i
const looksEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
const looksPhone = (s: string) => /^[+()\d\s-]{6,}$/.test(s.trim()) && /\d{5,}/.test(s.replace(/\D/g, ''))

/** Plain text: one name per line (also used for "Paste names"). */
export function parseNameLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => cleanName(l.replace(/^\s*(\d+[.)]|[-*•])\s+/, '')))
    .filter(Boolean)
}

export function parseCsvText(text: string): ParsedTable {
  const res = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' })
  return tableFromRows((res.data as unknown[]).filter(Array.isArray) as unknown[][])
}

/** Build a table (header detection + column mapping) from raw rows of any source: CSV, Excel, Word, JSON… */
export function tableFromRows(input: unknown[][]): ParsedTable {
  const all = input
    .map((r) => r.map((c) => cellToString(c)))
    .filter((r) => r.some((c) => c !== ''))
  if (!all.length) return { headers: [], rows: [], hasHeader: false, mapping: emptyMapping() }
  // Drop columns that are empty in every row (common in spreadsheets and Word tables).
  const width = Math.max(...all.map((r) => r.length))
  const keep = Array.from({ length: width }, (_, i) => i).filter((i) => all.some((r) => (r[i] ?? '') !== ''))
  const norm = all.map((r) => keep.map((i) => r[i] ?? ''))
  const first = norm[0]
  const hasHeader = first.some((c) => NAME_LOOSE_RE.test(c) || FIRST_RE.test(c) || EMAIL_RE.test(c) || PHONE_RE.test(c)) && !first.some(looksEmail)
  const headers = hasHeader ? first.map((h, i) => h || `Column ${i + 1}`) : first.map((_, i) => `Column ${i + 1}`)
  const rows = hasHeader ? norm.slice(1) : norm
  return { headers, rows, hasHeader, mapping: detectMapping(headers, rows, hasHeader) }
}

export function cellToString(c: unknown): string {
  if (c === null || c === undefined) return ''
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? '' : c.toISOString().slice(0, 10)
  if (typeof c === 'number') return Number.isInteger(c) ? String(c) : String(c)
  if (typeof c === 'object') return ''
  return String(c).replace(/\s+/g, ' ').trim()
}

/**
 * Pasted text: one name per line. If it was copied from Excel/Sheets with several columns
 * (tab-separated), the name column is detected automatically.
 */
export function parsePastedNames(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.some((l) => l.includes('\t'))) {
    const t = tableFromRows(lines.map((l) => l.split('\t')))
    if (t.mapping.name !== null) return buildParticipantsFromTable(t, t.mapping).map((p) => p.name)
  }
  return parseNameLines(text)
}

function emptyMapping(): ColumnMapping {
  return { name: null, firstName: null, lastName: null, email: null, phone: null }
}

function detectMapping(headers: string[], rows: string[][], hasHeader: boolean): ColumnMapping {
  const m = emptyMapping()
  const sample = rows.slice(0, 50)
  const ratio = (col: number, test: (s: string) => boolean) => {
    const vals = sample.map((r) => r[col] ?? '').filter(Boolean)
    return vals.length ? vals.filter(test).length / vals.length : 0
  }
  if (hasHeader) {
    headers.forEach((h, i) => {
      if (m.email === null && EMAIL_RE.test(h)) m.email = i
      else if (m.phone === null && PHONE_RE.test(h)) m.phone = i
      else if (m.firstName === null && FIRST_RE.test(h)) m.firstName = i
      else if (m.lastName === null && LAST_RE.test(h)) m.lastName = i
    })
    const exact = headers.findIndex((h) => NAME_RE.test(h))
    const loose = headers.findIndex((h, i) => NAME_LOOSE_RE.test(h) && i !== m.firstName && i !== m.lastName)
    if (exact >= 0) m.name = exact
    else if (loose >= 0) m.name = loose
    else if (m.firstName !== null && m.lastName !== null) m.name = 'first_last'
    else if (m.firstName !== null) m.name = m.firstName
  }
  // Content-based fallback.
  headers.forEach((_, i) => {
    if (m.email === null && ratio(i, looksEmail) > 0.6) m.email = i
    else if (m.phone === null && i !== m.email && ratio(i, looksPhone) > 0.6) m.phone = i
  })
  if (m.name === null) {
    const candidate = headers.findIndex(
      (_, i) => i !== m.email && i !== m.phone && ratio(i, (s) => /[A-Za-zÀ-ɏ؀-ۿ]/.test(s) && !looksEmail(s)) > 0.6,
    )
    if (candidate >= 0) m.name = candidate
  }
  return m
}

export function nameFromRow(row: string[], m: ColumnMapping): string {
  if (m.name === 'first_last') {
    return cleanName(`${m.firstName !== null ? row[m.firstName] ?? '' : ''} ${m.lastName !== null ? row[m.lastName] ?? '' : ''}`)
  }
  return m.name === null ? '' : cleanName(row[m.name] ?? '')
}

export function buildParticipantsFromTable(t: ParsedTable, m: ColumnMapping): ParticipantInput[] {
  const used = new Set<number>(
    [m.email, m.phone, typeof m.name === 'number' ? m.name : null, m.name === 'first_last' ? m.firstName : null, m.name === 'first_last' ? m.lastName : null].filter(
      (x): x is number => typeof x === 'number',
    ),
  )
  const out: ParticipantInput[] = []
  for (const row of t.rows) {
    const name = nameFromRow(row, m)
    if (!name) continue
    const metadata: Record<string, string> = {}
    t.headers.forEach((h, i) => {
      if (!used.has(i) && row[i]) metadata[h] = row[i]
    })
    out.push({
      name,
      email: m.email !== null ? row[m.email] : undefined,
      phone: m.phone !== null ? row[m.phone] : undefined,
      metadata: t.hasHeader && Object.keys(metadata).length ? metadata : undefined,
    })
  }
  return out
}

/** Reads a user file with friendly errors. */
export async function readTextFile(file: File): Promise<string> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('This file is too large. Please use a file under 5 MB.')
  const text = await file.text()
  if (/\u0000/.test(text.slice(0, 2000))) throw new Error('This doesn’t look like a text or CSV file. Please export your list as CSV and try again.')
  return text
}
