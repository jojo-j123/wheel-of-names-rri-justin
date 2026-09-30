/**
 * Reads participant lists from whatever file the operator has:
 * Excel (.xlsx/.xlsm), Word (.docx), CSV/TSV, TXT and JSON.
 * Everything runs in the browser — files are never uploaded anywhere.
 * Heavy parsers (Excel, Word) are loaded on demand.
 */
import { parseCsvText, parseNameLines, readTextFile, tableFromRows, type ParsedTable } from '../csv/participantsCsv'

export const MAX_BINARY_IMPORT_BYTES = 20 * 1024 * 1024

export const IMPORT_ACCEPT = [
  '.xlsx', '.xlsm', '.xls', '.ods', '.docx', '.doc', '.csv', '.tsv', '.txt', '.json',
  'text/csv', 'text/plain', 'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',')

export interface ImportSheet {
  name: string
  table: ParsedTable
}

export type LoadedFile =
  | { kind: 'lines'; fileName: string; source: string; names: string[] }
  | { kind: 'table'; fileName: string; source: string; sheets: ImportSheet[] }

export class ImportError extends Error {}

function ext(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name)
  return m ? m[1].toLowerCase() : ''
}

export async function readParticipantFile(file: File): Promise<LoadedFile> {
  const e = ext(file.name)
  const fileName = file.name
  if (!file.size) throw new ImportError('This file is empty.')

  switch (e) {
    case 'xlsx':
    case 'xlsm':
      return readExcel(file)
    case 'docx':
      return readWord(file)
    case 'xls':
    case 'ods':
      throw new ImportError(
        `This is an older spreadsheet format (.${e}). Open it in Excel or Google Sheets and choose “Save As → Excel Workbook (.xlsx)” or CSV, then import that file.`,
      )
    case 'doc':
      throw new ImportError('This is an older Word format (.doc). Open it in Word and choose “Save As → Word Document (.docx)”, then import that file.')
    case 'pdf':
      throw new ImportError('PDF files can’t be read reliably. Please export your list to Excel, Word or CSV instead.')
    case 'json':
      return readJson(file)
  }

  // Text-based: CSV, TSV, TXT (or unknown text files).
  const text = await readTextFile(file)
  if (!text.trim()) throw new ImportError('This file is empty.')
  const firstLine = text.split(/\r?\n/, 1)[0]
  if (e === 'txt' && !/[,;\t]/.test(firstLine)) {
    return { kind: 'lines', fileName, source: 'Text file', names: parseNameLines(text) }
  }
  return { kind: 'table', fileName, source: e === 'tsv' ? 'TSV file' : 'CSV file', sheets: [{ name: 'Data', table: parseCsvText(text) }] }
}

async function readExcel(file: File): Promise<LoadedFile> {
  if (file.size > MAX_BINARY_IMPORT_BYTES) throw new ImportError('This file is too large. Please use a file under 20 MB.')
  const { default: readXlsxFile } = await import('read-excel-file/browser')
  let sheets: { sheet: string; data: unknown[][] }[]
  try {
    sheets = (await readXlsxFile(file)) as unknown as { sheet: string; data: unknown[][] }[]
  } catch {
    throw new ImportError('We couldn’t open this Excel file. It may be damaged or password-protected. Try saving it again as .xlsx or CSV.')
  }
  const parsed = sheets
    .map((s) => ({ name: s.sheet, table: tableFromRows(s.data ?? []) }))
    .filter((s) => s.table.rows.length > 0)
  if (!parsed.length) throw new ImportError('This Excel file has no rows with data.')
  // Put the most useful sheet first: one with a detected name column and the most rows.
  parsed.sort((a, b) => Number(b.table.mapping.name !== null) - Number(a.table.mapping.name !== null) || b.table.rows.length - a.table.rows.length)
  return { kind: 'table', fileName: file.name, source: 'Excel file', sheets: parsed }
}

async function readWord(file: File): Promise<LoadedFile> {
  if (file.size > MAX_BINARY_IMPORT_BYTES) throw new ImportError('This file is too large. Please use a file under 20 MB.')
  const mammoth = (await import('mammoth')).default
  let html: string
  try {
    html = (await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })).value
  } catch {
    throw new ImportError('We couldn’t open this Word file. It may be damaged or password-protected. Try saving it again as .docx.')
  }
  return wordHtmlToImport(html, file.name)
}

/** Word content → tables (preferred) or one name per paragraph / list item. Exported for tests. */
export function wordHtmlToImport(html: string, fileName: string): LoadedFile {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const tables = [...doc.querySelectorAll('table')]
    .map((t, i) => ({
      name: `Table ${i + 1}`,
      table: tableFromRows([...t.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((td) => td.textContent ?? ''))),
    }))
    .filter((t) => t.table.rows.length > 0)
    .sort((a, b) => b.table.rows.length - a.table.rows.length)
  if (tables.length && tables[0].table.rows.length >= 2) {
    return { kind: 'table', fileName, source: 'Word table', sheets: tables }
  }
  doc.querySelectorAll('table').forEach((t) => t.remove())
  // Paragraphs and list items only — headings like "Guest list" are titles, not people.
  const lines = [...doc.querySelectorAll('p, li')].map((el) => el.textContent ?? '')
  const names = parseNameLines(lines.join('\n'))
  if (!names.length) throw new ImportError('We couldn’t find any names in this Word document. Put one name per line, or use a table.')
  return { kind: 'lines', fileName, source: 'Word document', names }
}

async function readJson(file: File): Promise<LoadedFile> {
  const text = await readTextFile(file)
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('This JSON file isn’t valid.')
  }
  return jsonToImport(data, file.name)
}

/** Accepts ["Name", …], [{name, email}, …] or {participants: [...]}. Exported for tests. */
export function jsonToImport(data: unknown, fileName: string): LoadedFile {
  const obj = data as Record<string, unknown> | null
  const list: unknown =
    Array.isArray(data) ? data : obj && typeof obj === 'object' ? obj.participants ?? obj.people ?? obj.names ?? obj.data : null
  if (!Array.isArray(list) || !list.length) throw new ImportError('We couldn’t find a list of people in this JSON file.')
  if (list.every((x) => typeof x === 'string')) {
    return { kind: 'lines', fileName, source: 'JSON file', names: parseNameLines((list as string[]).join('\n')) }
  }
  const objs = list.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x))
  if (!objs.length) throw new ImportError('We couldn’t find a list of people in this JSON file.')
  const keys = [...new Set(objs.flatMap((o) => Object.keys(o)))]
  const rows: unknown[][] = [keys, ...objs.map((o) => keys.map((k) => o[k]))]
  return { kind: 'table', fileName, source: 'JSON file', sheets: [{ name: 'Data', table: tableFromRows(rows) }] }
}
