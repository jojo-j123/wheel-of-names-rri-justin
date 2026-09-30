import { useVirtualizer } from '@tanstack/react-virtual'
import { Pencil, Trash2, Trophy } from 'lucide-react'
import { memo, useRef } from 'react'
import type { Participant } from '../../types'

interface Props {
  rows: Participant[]
  selected: Set<string>
  winners: Set<string>
  removed: Set<string>
  duplicates: Set<string>
  onToggle(id: string): void
  onEdit(p: Participant): void
  onDelete(p: Participant): void
}

const ROW_H = 64

/** Virtualised: only the ~15 visible rows are in the DOM, even with thousands of participants. */
export const ParticipantTable = memo(function ParticipantTable({ rows, selected, winners, removed, duplicates, onToggle, onEdit, onDelete }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => ROW_H, overscan: 8 })
  return (
    <div ref={parentRef} className="h-[min(620px,65dvh)] overflow-y-auto" role="list" aria-label="Participants">
      <div style={{ height: v.getTotalSize(), position: 'relative' }}>
        {v.getVirtualItems().map((item) => {
          const p = rows[item.index]
          const isSel = selected.has(p.id)
          const won = winners.has(p.id)
          return (
            <div
              key={p.id}
              role="listitem"
              className={`absolute inset-x-0 flex items-center gap-3 border-b border-line/70 px-4 sm:px-5 ${isSel ? 'bg-brand/[0.05]' : 'hover:bg-paper'}`}
              style={{ height: ROW_H, transform: `translateY(${item.start}px)` }}
            >
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => onToggle(p.id)}
                aria-label={`Select ${p.name}`}
                className="h-5 w-5 shrink-0 cursor-pointer rounded accent-[var(--brand-primary)]"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-[15px] font-semibold">
                  <span className="truncate">{p.name}</span>
                  {won && (
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${removed.has(p.id) ? 'bg-brand/10 text-brand' : 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300'}`}>
                      <Trophy size={11} /> {removed.has(p.id) ? 'Won' : 'Won · still in'}
                    </span>
                  )}
                  {duplicates.has(p.id) && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Duplicate</span>}
                </p>
                {(p.email || p.phone) && <p className="truncate text-sm text-muted">{[p.email, p.phone].filter(Boolean).join(' · ')}</p>}
              </div>
              <button onClick={() => onEdit(p)} className="rounded-lg p-2.5 text-muted transition hover:bg-ink/5 hover:text-ink" aria-label={`Edit ${p.name}`}>
                <Pencil size={17} />
              </button>
              <button onClick={() => onDelete(p)} className="rounded-lg p-2.5 text-muted transition hover:bg-danger/10 hover:text-danger" aria-label={`Delete ${p.name}`}>
                <Trash2 size={17} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
})
