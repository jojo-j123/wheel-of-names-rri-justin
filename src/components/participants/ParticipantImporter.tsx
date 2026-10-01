import { CheckCircle2, FileSpreadsheet, FileText, FileUp, Loader2, TriangleAlert } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { buildParticipantsFromTable, type ColumnMapping } from '../../lib/csv/participantsCsv'
import { IMPORT_ACCEPT, readParticipantFile, type LoadedFile } from '../../lib/import/fileImport'
import type { ParticipantInput } from '../../lib/event/operations'
import { plural } from '../../lib/format'
import { Button } from '../common/Button'
import { Modal } from '../common/Modal'

interface Props {
  open: boolean
  onClose(): void
  onImport(people: ParticipantInput[]): void
}

const selectCls = 'h-12 w-full rounded-xl border border-line bg-field px-3 font-semibold outline-none focus:border-brand focus:ring-4 focus:ring-brand/15'

export function ParticipantImporter({ open, onClose, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<LoadedFile | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const reset = () => {
    setLoaded(null)
    setMapping(null)
    setSheetIndex(0)
    setError(null)
  }
  const close = () => {
    reset()
    onClose()
  }

  const selectSheet = (file: LoadedFile, i: number) => {
    setSheetIndex(i)
    if (file.kind !== 'table') return
    const t = file.sheets[i].table
    setMapping(t.mapping)
    setError(t.mapping.name === null ? 'We couldn’t find a column containing participant names. Please choose it below.' : null)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    reset()
    setBusy(true)
    try {
      const result = await readParticipantFile(file)
      if (result.kind === 'lines' && !result.names.length) throw new Error('We couldn’t find any names in this file.')
      setLoaded(result)
      if (result.kind === 'table') selectSheet(result, 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This file couldn’t be read.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const table = loaded?.kind === 'table' ? loaded.sheets[sheetIndex]?.table ?? null : null

  const people = useMemo<ParticipantInput[]>(() => {
    if (!loaded) return []
    if (loaded.kind === 'lines') return loaded.names.map((name) => ({ name }))
    if (!table || !mapping || mapping.name === null) return []
    return buildParticipantsFromTable(table, mapping)
  }, [loaded, table, mapping])

  const hasFirstLast = table && mapping && mapping.firstName !== null && mapping.lastName !== null

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import participants"
      description="Upload an Excel sheet, a Word document, a CSV or a text file. We’ll find the names for you."
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
      <input ref={inputRef} type="file" accept={IMPORT_ACCEPT} className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
      {!loaded && (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
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
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">{busy ? <Loader2 size={26} className="animate-spin" /> : <FileUp size={26} />}</div>
          <p className="font-display text-lg font-semibold">{busy ? 'Reading your file…' : 'Choose a file or drag it here'}</p>
          <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold text-muted">
            {['Excel (.xlsx)', 'Word (.docx)', 'CSV', 'TXT', 'JSON'].map((f) => (
              <span key={f} className="rounded-full bg-ink/5 px-2.5 py-1">{f}</span>
            ))}
          </div>
          <p className="text-sm text-muted">Everything stays on this computer — nothing is uploaded.</p>
        </button>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-danger/8 px-4 py-3 text-sm font-medium text-danger">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {loaded && (
        <div className="mt-1 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-muted">
              {loaded.source.startsWith('Excel') ? <FileSpreadsheet size={18} className="text-success" /> : <FileText size={18} className="text-brand" />}
              <span className="font-semibold text-ink">{loaded.fileName}</span> · {loaded.source}
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
            {table && mapping?.email != null && (
              <li className="flex items-center gap-2 text-sm text-muted">
                <CheckCircle2 size={16} /> Email column detected (kept private)
              </li>
            )}
            {table && mapping?.phone != null && (
              <li className="flex items-center gap-2 text-sm text-muted">
                <CheckCircle2 size={16} /> Phone column detected (kept private)
              </li>
            )}
          </ul>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {loaded.kind === 'table' && loaded.sheets.length > 1 && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">{loaded.source === 'Word table' ? 'Which table?' : 'Which sheet?'}</span>
                <select value={sheetIndex} onChange={(e) => selectSheet(loaded, Number(e.target.value))} className={selectCls}>
                  {loaded.sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name} ({s.table.rows.length.toLocaleString()} rows)
                    </option>
                  ))}
                </select>
              </label>
            )}
            {table && mapping && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Which column has the names?</span>
                <select
                  value={mapping.name === null ? '' : String(mapping.name)}
                  onChange={(e) => {
                    const v = e.target.value
                    setError(null)
                    setMapping({ ...mapping, name: v === '' ? null : v === 'first_last' ? 'first_last' : Number(v) })
                  }}
                  className={selectCls}
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
          </div>

          {people.length > 0 && (
            <div className="rounded-2xl border border-line bg-paper p-4">
              <p className="text-sm font-semibold">Preview</p>
              <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-ink-soft sm:grid-cols-2">
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
