import { CheckCircle2, Copy, Download, LayoutTemplate, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import type { EventData } from '../../types'
import { formatDate, plural } from '../../lib/format'
import { BrandLogo } from '../branding/BrandLogo'
import { Button } from '../common/Button'

interface Props {
  event: EventData
  active: boolean
  onOpen(): void
  onRename(): void
  onDuplicate(): void
  onReset(): void
  onDelete(): void
  onTemplate(): void
  onExport(): void
}

export function EventCard({ event, active, onOpen, onRename, onDuplicate, onReset, onDelete, onTemplate, onExport }: Props) {
  const act = 'rounded-lg p-2.5 text-muted transition hover:bg-ink/5 hover:text-ink'
  return (
    <div className={`flex flex-col rounded-3xl border bg-card p-5 shadow-card ${active ? 'border-brand ring-4 ring-brand/12' : 'border-line'}`}>
      <div className="flex items-start gap-4">
        <BrandLogo logo={event.branding.logo} companyName={event.branding.companyName} variant="badge" className="h-12 w-12 shrink-0 ring-1 ring-line" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold">{event.eventName}</p>
          <p className="text-sm text-muted">
            {event.eventDate ? formatDate(event.eventDate) : 'No date'}
            {event.isDemo && ' · Demo'}
          </p>
        </div>
        {active && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-on-brand">
            <CheckCircle2 size={13} /> Open
          </span>
        )}
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        {plural(event.participants.length, 'participant')} · {plural(event.prizes.length, 'prize')} · {plural(event.winnerHistory.length, 'winner')}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-line pt-3">
        {!active && (
          <Button size="sm" variant="primary" onClick={onOpen} className="mr-auto">
            Open event
          </Button>
        )}
        <div className={`flex flex-wrap ${active ? 'mr-auto' : ''}`}>
          <button className={act} onClick={onRename} aria-label="Rename" title="Rename"><Pencil size={17} /></button>
          <button className={act} onClick={onDuplicate} aria-label="Duplicate" title="Duplicate"><Copy size={17} /></button>
          <button className={act} onClick={onTemplate} aria-label="Save as template" title="Save as template"><LayoutTemplate size={17} /></button>
          <button className={act} onClick={onExport} aria-label="Export event file" title="Export event file"><Download size={17} /></button>
          <button className={act} onClick={onReset} aria-label="Reset event" title="Reset event (clear winners)"><RotateCcw size={17} /></button>
          <button className={`${act} hover:!bg-danger/10 hover:!text-danger`} onClick={onDelete} aria-label="Delete event" title="Delete event"><Trash2 size={17} /></button>
        </div>
      </div>
    </div>
  )
}
