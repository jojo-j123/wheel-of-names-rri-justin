import { Gift, Pencil, Trash2, Trophy } from 'lucide-react'
import type { Prize } from '../../types'

interface Props {
  prize: Prize
  remaining: number
  active?: boolean
  preview?: boolean
  onEdit?(): void
  onDelete?(): void
  onChoose?(): void
  onToggle?(): void
}

export function PrizeCard({ prize, remaining, active, preview, onEdit, onDelete, onChoose, onToggle }: Props) {
  const status = !prize.enabled ? 'Hidden' : remaining <= 0 ? 'All given away' : active ? 'Next draw' : 'Available'
  const statusCls = !prize.enabled ? 'bg-ink/8 text-muted' : remaining <= 0 ? 'bg-ink/8 text-muted' : active ? 'bg-brand text-on-brand' : 'bg-success/12 text-success'
  return (
    <div className={`group flex flex-col overflow-hidden rounded-3xl border bg-card shadow-card transition ${active ? 'border-brand ring-4 ring-brand/15' : 'border-line'} ${!prize.enabled ? 'opacity-70' : ''}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-ink">
        {prize.image ? (
          <img src={prize.image} alt={prize.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_20%,var(--brand-primary),#1a1616)]">
            <Gift size={56} strokeWidth={1.3} className="text-white/85" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${statusCls}`}>{status}</span>
        <div className="absolute inset-x-4 bottom-3 text-white">
          <p className="truncate font-display text-xl font-semibold drop-shadow">{prize.name || 'Prize name'}</p>
          {prize.description && <p className="truncate text-sm text-white/75">{prize.description}</p>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Quantity</span>
          <span className="tabular font-semibold">
            {remaining} of {prize.quantity} left
          </span>
        </div>
        {(prize.sponsor || prize.value) && (
          <div className="flex items-center justify-between text-sm">
            <span className="truncate text-muted">{prize.sponsor ? `Sponsor: ${prize.sponsor}` : ''}</span>
            <span className="font-semibold">{prize.value}</span>
          </div>
        )}
        {!preview && (
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            {onChoose && prize.enabled && !active && remaining > 0 && (
              <button onClick={onChoose} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand/10 px-3 text-sm font-semibold text-brand transition hover:bg-brand hover:text-on-brand">
                <Trophy size={16} /> Draw this next
              </button>
            )}
            <button onClick={onEdit} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold transition hover:bg-paper">
              <Pencil size={15} /> Edit
            </button>
            {onToggle && (
              <button onClick={onToggle} className="inline-flex h-10 items-center rounded-xl border border-line px-3 text-sm font-semibold transition hover:bg-paper">
                {prize.enabled ? 'Hide' : 'Show'}
              </button>
            )}
            <button onClick={onDelete} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold text-danger transition hover:border-danger/30 hover:bg-danger/5" aria-label={`Delete ${prize.name}`}>
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
