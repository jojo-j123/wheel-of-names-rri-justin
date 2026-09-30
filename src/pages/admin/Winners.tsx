import { Download, Trash2, Trophy, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card, PageHeader } from '../../components/admin/PageHeader'
import { Button } from '../../components/common/Button'
import { confirm } from '../../components/common/ConfirmDialog'
import { ParticipantSearch } from '../../components/participants/ParticipantSearch'
import { useDebounced } from '../../hooks/useDebounced'
import { clearWinnerHistory, deleteWinnerRecord, undoLastDraw } from '../../lib/event/operations'
import { downloadText, safeFileName, winnersToCsv } from '../../lib/export/exporters'
import { formatDateTime, plural } from '../../lib/format'
import { useActiveEvent, useApp } from '../../store/appStore'
import { isSpinning, useDraw } from '../../store/drawStore'
import { toast } from '../../store/toastStore'

export function WinnersPage() {
  const event = useActiveEvent()!
  const mutate = useApp((s) => s.mutateEvent)
  const spinning = useDraw((s) => isSpinning(s.phase))
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim().toLowerCase(), 150)
  const [prizeFilter, setPrizeFilter] = useState('')
  const sorted = useMemo(() => [...event.winnerHistory].sort((a, b) => b.drawNumber - a.drawNumber), [event.winnerHistory])
  const prizeNames = useMemo(() => [...new Set(sorted.map((w) => w.prizeName))], [sorted])
  const rows = sorted.filter((w) => (!q || w.participantName.toLowerCase().includes(q) || w.prizeName.toLowerCase().includes(q)) && (!prizeFilter || w.prizeName === prizeFilter))
  const last = sorted[0]

  return (
    <div>
      <PageHeader
        title="Winner history"
        description={`${plural(event.winnerHistory.length, 'winner')} drawn at this event.`}
        actions={
          <>
            <Button icon={<Download size={18} />} disabled={!sorted.length} onClick={() => downloadText(`${safeFileName(event.eventName)}-winners.csv`, winnersToCsv(event.winnerHistory), 'text/csv')}>
              Export winners
            </Button>
            <Button
              icon={<Undo2 size={18} />}
              disabled={!last || spinning}
              onClick={async () => {
                if (!last) return
                if (await confirm({ title: 'Undo the last draw?', message: `${last.participantName} will lose “${last.prizeName}” and go back into the draw.`, confirmLabel: 'Undo last draw', danger: true })) {
                  mutate(event.id, (e) => undoLastDraw(e).event, { immediate: true })
                  useDraw.getState().set({ phase: 'IDLE', current: null, wheelList: null, batch: null })
                  toast.success(`Undone. ${last.participantName} is back in the draw.`)
                }
              }}
            >
              Undo last draw
            </Button>
            <Button
              icon={<Trash2 size={18} />}
              disabled={!sorted.length || spinning}
              className="hover:!text-danger"
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Clear winner history?',
                    message: `This will remove all ${plural(sorted.length, 'winner')} from the history. Everyone becomes eligible again and all prizes are available again.\n\nThis action cannot be undone.`,
                    confirmLabel: 'Clear history',
                    danger: true,
                  })
                ) {
                  mutate(event.id, clearWinnerHistory, { immediate: true })
                  toast.success('Winner history cleared.')
                }
              }}
            >
              Clear history
            </Button>
          </>
        }
      />
      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:p-5">
          <ParticipantSearch value={query} onChange={setQuery} placeholder="Search winners or prizes" />
          <select
            value={prizeFilter}
            onChange={(e) => setPrizeFilter(e.target.value)}
            aria-label="Filter by prize"
            className="h-11 rounded-xl border border-line bg-white px-3 text-[15px] font-semibold outline-none focus:border-brand"
          >
            <option value="">All prizes</option>
            {prizeNames.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Trophy className="mx-auto text-muted" />
            <p className="mt-3 font-semibold">{sorted.length ? 'No winners match your search.' : 'No winners yet.'}</p>
            {!sorted.length && <p className="mt-1 text-sm text-muted">Winners appear here as soon as the wheel stops.</p>}
          </div>
        ) : (
          <ol className="divide-y divide-line">
            {rows.map((w) => (
              <li key={w.id} className="flex items-center gap-4 px-4 py-4 sm:px-5">
                <span className="tabular grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/10 font-display font-semibold text-brand">#{w.drawNumber}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold">{w.participantName}</p>
                  <p className="flex items-center gap-1.5 truncate text-sm text-ink-soft">
                    <Trophy size={14} className="shrink-0 text-brand" /> {w.prizeName}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(w.timestamp)}
                    {!w.removedFromPool && ' · stayed in the draw'}
                  </p>
                </div>
                <button
                  className="rounded-lg p-2.5 text-muted transition hover:bg-danger/10 hover:text-danger"
                  aria-label={`Delete winner record ${w.drawNumber}`}
                  onClick={async () => {
                    if (await confirm({ title: `Delete draw #${w.drawNumber}?`, message: `${w.participantName} will be removed from the winner history and becomes eligible again.`, confirmLabel: 'Delete record', danger: true })) {
                      mutate(event.id, (e) => deleteWinnerRecord(e, w.id), { immediate: true })
                      toast.success('Winner record deleted.')
                    }
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
