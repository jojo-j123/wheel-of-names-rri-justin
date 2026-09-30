import { CheckCircle2, FileUp, TriangleAlert } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import {
  buildParticipantsFromTable, parseCsvText, parseNameLines, readTextFile, type ColumnMapping, type ParsedTable,
} from '../../lib/csv/participantsCsv'
import type { ParticipantInput } from '../../lib/event/operations'
import { plural } from '../../lib/format'
import { Button } from '../common/Button'
import { Modal } from '../common/Modal'

interface Props {
  open: boolean
  onClose(): void
  onImport(people: ParticipantInput[]): void
}

type Loaded = { kind: 'lines'; fileName: string; names: string[] } | { kind: 'table'; fileName: string; table: ParsedTable }

export function ParticipantImporter({ open, onClose, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const reset = () => {
    setLoaded(null)
    setMapping(null)
    setError(null)
  }
  const close = () => {
    reset()
    onClose()
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    reset()
    try {
      const lower = file.name.toLowerCase()
      if (!/\.(csv|txt|tsv)$/.test(lower) && !/text|csv/.test(file.type)) {
        throw new Error('Please choose a CSV or TXT file. In Excel, use “Save As → CSV”.')
      }
      const text = await readTextFile(file)
      if (!text.trim()) throw new Error('This file is empty.')
      const firstLine = text.split(/\r?\n/, 1)[0]
      const looksDelimited = /[,;\t]/.test(firstLine)
      if (lower.endsWith('.txt') && !looksDelimited) {
        const names = parseNameLines(text)
        if (!names.length) throw new Error('We couldn’t find any names in this file.')
        setLoaded({ kind: 'lines', fileName: file.name, names })
        return
      }
      const table = parseCsvText(text)
      if (!table.rows.length) throw new Error('We couldn’t find any rows in this file.')
      setLoaded({ kind: 'table', fileName: file.name, table })
      setMapping(table.mapping)
      if (table.mapping.name === null) setError('We couldn’t find a column containing participant names. Please choose it below.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This file couldn’t be read.')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const people = useMemo<ParticipantInput[]>(() => {
    if (!loaded) return []
    if (loaded.kind === 'lines') return loaded.names.map((name) => ({ name }))
    if (!mapping || mapping.name === null) return []
    return buildParticipantsFromTable(loaded.table, mapping)
  }, [loaded, mapping])

  const table = loaded?.kind === 'table' ? loaded.table : null
  const hasFirstLast = table && mapping && mapping.firstName !== null && mapping.lastName !== null

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import participants"
      description="Upload a CSV (from Excel or Google Sheets) or a TXT file with one name per line."
      size="lg"
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!people.length}
            onClick={() => {
              onImport(people)
              close()
            }}
          >
            Import {plural(people.length, 'participant')}
          </Button>
        </>
      }
    >
      <input ref={inputRef} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
      {!loaded && (
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void handleFile(e.dataTransfer.files?.[0])
          }}
          className={`flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-6 py-14 text-center transition ${dragging ? 'border-brand bg-brand/5' : 'border-line hover:border-brand/40 hover:bg-paper'}`}
        >
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
            <FileUp size={26} />
          </div>
          <p className="font-display text-lg font-semibold">Choose a file or drag it here</p>
          <p className="text-sm text-muted">CSV or TXT · up to 5 MB · example columns: name, email, phone</p>
        </button>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-danger/8 px-4 py-3 text-sm font-medium text-danger">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {loaded && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              File: <span className="font-semibold text-ink">{loaded.fileName}</span>
            </p>
            <Button size="sm" onClick={() => inputRef.current?.click()}>Choose another file</Button>
          </div>
          <ul className="space-y-2">
            {people.length > 0 && (
              <li className="flex items-center gap-2 font-semibold text-success">
                <CheckCircle2 size={18} /> Names found
              </li>
            )}
            <li className={`flex items-center gap-2 font-semibold ${people.length ? 'text-success' : 'text-muted'}`}>
              <CheckCircle2 size={18} /> {plural(people.length, 'participant')} found
            </li>
            {table && mapping?.email !== null && mapping?.email !== undefined && (
              <li className="flex items-center gap-2 text-sm text-muted">
                <CheckCircle2 size={16} /> Email column detected (kept private)
              </li>
            )}
            {table && mapping?.phone !== null && mapping?.phone !== undefined && (
              <li className="flex items-center gap-2 text-sm text-muted">
                <CheckCircle2 size={16} /> Phone column detected (kept private)
              </li>
            )}
          </ul>

          {table && mapping && (
            <label className="block max-w-sm">
              <span className="mb-1.5 block text-sm font-semibold">Which column has the names?</span>
              <select
                value={mapping.name === null ? '' : String(mapping.name)}
                onChange={(e) => {
                  const v = e.target.value
                  setError(null)
                  setMapping({ ...mapping, name: v === '' ? null : v === 'first_last' ? 'first_last' : Number(v) })
                }}
                className="h-12 w-full rounded-xl border border-line bg-white px-3 font-semibold outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
              >
                <option value="">Choose a column…</option>
                {hasFirstLast && <option value="first_last">First name + Last name</option>}
                {table.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                    {table.rows[0]?.[i] ? ` (e.g. ${table.rows[0][i].slice(0, 24)})` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {people.length > 0 && (
            <div className="rounded-2xl border border-line bg-paper p-4">
              <p className="text-sm font-semibold">Preview</p>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm text-ink-soft sm:grid-cols-2">
                {people.slice(0, 12).map((p, i) => (
                  <li key={i} className="truncate">{p.name}</li>
                ))}
              </ul>
              {people.length > 12 && <p className="mt-2 text-sm text-muted">…and {(people.length - 12).toLocaleString()} more</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
