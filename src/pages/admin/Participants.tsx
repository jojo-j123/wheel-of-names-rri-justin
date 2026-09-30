import { ClipboardPaste, Copy, Download, FileUp, Plus, Shuffle, Trash2, UserPlus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { Participant } from '../../types'
import { Card, PageHeader, Stat } from '../../components/admin/PageHeader'
import { Button } from '../../components/common/Button'
import { confirm } from '../../components/common/ConfirmDialog'
import { Segmented } from '../../components/common/Form'
import { ParticipantEditor } from '../../components/participants/ParticipantEditor'
import { ParticipantImporter } from '../../components/participants/ParticipantImporter'
import { ParticipantSearch } from '../../components/participants/ParticipantSearch'
import { ParticipantTable } from '../../components/participants/ParticipantTable'
import { PasteNames } from '../../components/participants/PasteNames'
import { useDebounced } from '../../hooks/useDebounced'
import {
  addParticipants, clearParticipants, findDuplicateIds, FriendlyError, makeParticipant, removeDuplicates, removedParticipantIds,
  removeParticipants, shuffleParticipants, updateParticipant, winnerParticipantIds, type ParticipantInput, type AddResult,
} from '../../lib/event/operations'
import { downloadText, participantsToCsv, safeFileName } from '../../lib/export/exporters'
import { plural } from '../../lib/format'
import { useActiveEvent, useApp } from '../../store/appStore'
import { isSpinning, useDraw } from '../../store/drawStore'
import { toast } from '../../store/toastStore'

type Filter = 'all' | 'eligible' | 'winners' | 'duplicates'

function reportAdd(r: AddResult) {
  const parts = [`${plural(r.added, 'participant')} added.`]
  if (r.skippedDuplicates) parts.push(`${plural(r.skippedDuplicates, 'duplicate')} skipped.`)
  if (r.skippedInvalid) parts.push(`${plural(r.skippedInvalid, 'empty row')} skipped.`)
  if (r.skippedOverLimit) parts.push(`${r.skippedOverLimit} not added — the list limit was reached.`)
  if (r.added) toast.success(parts.join(' '))
  else toast.error(parts.slice(1).join(' ') || 'No participants were added.')
}

export function ParticipantsPage() {
  const event = useActiveEvent()!
  const mutate = useApp((s) => s.mutateEvent)
  const spinning = useDraw((s) => isSpinning(s.phase))
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim().toLowerCase(), 150)
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Participant | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const prevent = event.wheelSettings.preventDuplicates

  const removed = useMemo(() => removedParticipantIds(event), [event])
  const winners = useMemo(() => winnerParticipantIds(event), [event])
  const duplicates = useMemo(() => findDuplicateIds(event.participants), [event.participants])
  const eligibleCount = event.participants.length - event.participants.filter((p) => removed.has(p.id)).length

  const rows = useMemo(() => {
    let list = event.participants
    if (filter === 'eligible') list = list.filter((p) => !removed.has(p.id))
    else if (filter === 'winners') list = list.filter((p) => winners.has(p.id))
    else if (filter === 'duplicates') list = list.filter((p) => duplicates.has(p.id))
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.phone?.includes(q))
    return list
  }, [event.participants, filter, q, removed, winners, duplicates])

  const guard = () => {
    if (spinning) toast.info('Please wait until the wheel stops.')
    return spinning
  }

  const add = (inputs: ParticipantInput[]) => {
    if (guard()) return
    let result: AddResult | null = null
    mutate(event.id, (e) => {
      result = addParticipants(e, inputs, { preventDuplicates: prevent })
      return result.event
    })
    if (result) reportAdd(result)
  }

  const onSave = (v: { name: string; email: string; phone: string }): string | null => {
    if (guard()) return 'Please wait until the wheel stops.'
    try {
      if (editing) {
        mutate(event.id, (e) => updateParticipant(e, editing.id, v, { preventDuplicates: prevent }))
        toast.success('Participant updated.')
      } else {
        let r: AddResult | null = null
        mutate(event.id, (e) => {
          r = addParticipants(e, [v], { preventDuplicates: prevent })
          return r.event
        })
        const res = r as AddResult | null
        if (!res?.added) return res?.skippedDuplicates ? `“${makeParticipant(v).name}” is already on the list.` : 'This participant couldn’t be added.'
        toast.success('Participant added successfully.')
      }
      return null
    } catch (e) {
      return e instanceof FriendlyError ? e.message : 'Something went wrong. Please try again.'
    }
  }

  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])
  const onEdit = useCallback((p: Participant) => {
    setEditing(p)
    setEditorOpen(true)
  }, [])
  const onDelete = useCallback(
    async (p: Participant) => {
      if (spinning) return toast.info('Please wait until the wheel stops.')
      if (await confirm({ title: `Delete ${p.name}?`, message: 'They will be removed from this event’s participant list.', confirmLabel: 'Delete', danger: true })) {
        mutate(event.id, (e) => removeParticipants(e, [p.id]))
        setSelected((s) => {
          const n = new Set(s)
          n.delete(p.id)
          return n
        })
        toast.success(`${p.name} was removed.`)
      }
    },
    [event.id, mutate, spinning],
  )

  const allShownSelected = rows.length > 0 && rows.every((p) => selected.has(p.id))

  return (
    <div>
      <PageHeader title="Participants" description={`${plural(event.participants.length, 'participant')} · ${eligibleCount.toLocaleString()} eligible for the next draw`} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={event.participants.length} />
        <Stat label="Eligible" value={eligibleCount} tone="brand" />
        <Stat label="Winners" value={winners.size} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 lg:grid-cols-4">
        <Button variant="primary" size="lg" icon={<UserPlus size={20} />} onClick={() => { setEditing(null); setEditorOpen(true) }}>
          Add participant
        </Button>
        <Button size="lg" icon={<FileUp size={20} />} onClick={() => setImportOpen(true)}>
          Import Excel / Word / CSV
        </Button>
        <Button size="lg" icon={<ClipboardPaste size={20} />} onClick={() => setPasteOpen(true)}>
          Paste names
        </Button>
        <Button
          size="lg"
          icon={<Trash2 size={20} />}
          disabled={!event.participants.length}
          className="hover:!border-danger/40 hover:!text-danger"
          onClick={async () => {
            if (guard()) return
            if (
              await confirm({
                title: 'Clear all participants?',
                message: `This will remove ${plural(event.participants.length, 'participant')} from this event.\n\nThis action cannot be undone. Winner history is kept.`,
                confirmLabel: 'Clear participants',
                danger: true,
              })
            ) {
              mutate(event.id, clearParticipants)
              setSelected(new Set())
              toast.success('All participants were removed.')
            }
          }}
        >
          Clear all
        </Button>
      </div>

      <Card className="mt-6 !p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5 lg:flex-row lg:items-center">
          <ParticipantSearch value={query} onChange={setQuery} />
          <div className="overflow-x-auto">
            <Segmented<Filter>
              label="Filter participants"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'eligible', label: 'Eligible' },
                { value: 'winners', label: 'Winners' },
                { value: 'duplicates', label: `Duplicates${duplicates.size ? ` (${duplicates.size})` : ''}` },
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <Button
              size="sm"
              variant="ghost"
              icon={<Shuffle size={16} />}
              disabled={event.participants.length < 2}
              onClick={() => {
                if (guard()) return
                mutate(event.id, shuffleParticipants)
                toast.success('List order shuffled.')
              }}
            >
              Shuffle
            </Button>
            {duplicates.size > 0 && (
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy size={16} />}
                onClick={async () => {
                  if (guard()) return
                  if (await confirm({ title: 'Remove duplicate names?', message: 'The first copy of each name is kept; extra copies are removed.', confirmLabel: 'Remove duplicates' })) {
                    let removedN = 0
                    mutate(event.id, (e) => {
                      const r = removeDuplicates(e)
                      removedN = r.removed
                      return r.event
                    })
                    toast.success(`${plural(removedN, 'duplicate')} removed.`)
                  }
                }}
              >
                Remove duplicates
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={<Download size={16} />} disabled={!event.participants.length} onClick={() => downloadText(`${safeFileName(event.eventName)}-participants.csv`, participantsToCsv(event), 'text/csv')}>
              Export
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 border-b border-line bg-paper/60 px-4 py-2.5 text-sm sm:px-5">
          <input
            type="checkbox"
            className="h-5 w-5 cursor-pointer accent-[var(--brand-primary)]"
            checked={allShownSelected}
            onChange={() => setSelected(allShownSelected ? new Set() : new Set(rows.map((p) => p.id)))}
            aria-label="Select all shown"
          />
          <span className="font-semibold text-muted">
            {selected.size ? `${selected.size.toLocaleString()} selected` : `Showing ${rows.length.toLocaleString()}`}
          </span>
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={15} />}
              className="ml-auto"
              onClick={async () => {
                if (guard()) return
                if (await confirm({ title: `Delete ${plural(selected.size, 'participant')}?`, message: 'They will be removed from this event.', confirmLabel: 'Delete selected', danger: true })) {
                  mutate(event.id, (e) => removeParticipants(e, selected))
                  toast.success(`${plural(selected.size, 'participant')} removed.`)
                  setSelected(new Set())
                }
              }}
            >
              Delete selected
            </Button>
          )}
        </div>

        {event.participants.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
              <Plus size={26} />
            </div>
            <p className="mt-4 font-display text-lg font-semibold">No participants yet</p>
            <p className="mt-1 max-w-sm text-muted">Add people one by one, paste a list of names, or import a CSV file.</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-muted">No participants match your search.</p>
        ) : (
          <ParticipantTable rows={rows} selected={selected} winners={winners} removed={removed} duplicates={duplicates} onToggle={toggle} onEdit={onEdit} onDelete={onDelete} />
        )}
      </Card>

      <ParticipantEditor open={editorOpen} participant={editing} onClose={() => setEditorOpen(false)} onSave={onSave} />
      <ParticipantImporter open={importOpen} onClose={() => setImportOpen(false)} onImport={add} />
      <PasteNames open={pasteOpen} onClose={() => setPasteOpen(false)} existingNames={event.participants.map((p) => p.name)} preventDuplicates={prevent} onAdd={(names) => add(names.map((name) => ({ name })))} />
    </div>
  )
}
