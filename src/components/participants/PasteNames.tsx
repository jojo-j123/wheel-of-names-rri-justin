import { useMemo, useState } from 'react'
import { parsePastedNames } from '../../lib/csv/participantsCsv'
import { duplicateKey } from '../../lib/event/operations'
import { plural } from '../../lib/format'
import { Button } from '../common/Button'
import { TextArea } from '../common/Form'
import { Modal } from '../common/Modal'

interface Props {
  open: boolean
  onClose(): void
  existingNames: string[]
  preventDuplicates: boolean
  onAdd(names: string[]): void
}

export function PasteNames({ open, onClose, existingNames, preventDuplicates, onAdd }: Props) {
  const [text, setText] = useState('')
  const names = useMemo(() => parsePastedNames(text), [text])
  const existing = useMemo(() => new Set(existingNames.map(duplicateKey)), [existingNames])
  const dupes = names.filter((n) => existing.has(duplicateKey(n))).length
  const willAdd = preventDuplicates ? new Set(names.map(duplicateKey).filter((k) => !existing.has(k))).size : names.length
  const close = () => {
    setText('')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={close}
      title="Paste participant names"
      description="Paste or type one name per line. You can copy straight from Excel, Google Sheets or Word — if you copy several columns, we find the names."
      size="lg"
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!willAdd}
            onClick={() => {
              onAdd(names)
              close()
            }}
          >
            Add {plural(willAdd, 'participant')}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_240px]">
        <TextArea label="Names" rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={'John Doe\nJane Smith\nAhmed Ali\nSarah Hassan'} />
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-sm font-semibold">Preview</p>
          <p className="mt-1 text-2xl font-display font-semibold">{plural(willAdd, 'participant')}</p>
          <p className="text-sm text-muted">will be added</p>
          {dupes > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              {plural(dupes, 'name')} already on the list{preventDuplicates ? ' — they will be skipped.' : '.'}
            </p>
          )}
          <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-sm text-ink-soft">
            {names.slice(0, 50).map((n, i) => (
              <li key={i} className="truncate">{n}</li>
            ))}
            {names.length > 50 && <li className="text-muted">…and {names.length - 50} more</li>}
          </ul>
        </div>
      </div>
    </Modal>
  )
}
