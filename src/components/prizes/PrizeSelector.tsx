import { Gift, Trophy } from 'lucide-react'
import type { EventData } from '../../types'
import { getActivePrize, prizeRemaining, setActivePrize } from '../../lib/event/operations'
import { useApp } from '../../store/appStore'
import { isRevealing, isSpinning, useDraw } from '../../store/drawStore'

/** "Choose the prize" — which prize the next draw is for. */
export function PrizeSelector({ event }: { event: EventData }) {
  const mutate = useApp((s) => s.mutateEvent)
  const phase = useDraw((s) => s.phase)
  const busy = isSpinning(phase) || isRevealing(phase)
  const prize = getActivePrize(event)
  const enabled = event.prizes.filter((p) => p.enabled)
  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-line bg-card p-5 shadow-card sm:flex-row sm:items-center sm:p-6">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand/10 text-brand">
          {prize?.image ? <img src={prize.image} alt="" className="h-full w-full object-cover" /> : <Gift size={28} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted">Next draw will be for:</p>
          <p className="flex items-center gap-2 truncate font-display text-xl font-semibold">
            <Trophy size={20} className="shrink-0 text-brand" />
            <span className="truncate">{prize ? prize.name : 'No prize selected'}</span>
          </p>
          {prize && <p className="text-sm text-muted">{prizeRemaining(event, prize)} of {prize.quantity} left</p>}
        </div>
      </div>
      <label className="block sm:w-72">
        <span className="mb-1.5 block text-sm font-semibold">Choose the prize</span>
        <select
          value={event.activePrizeId ?? ''}
          disabled={busy}
          onChange={(e) => mutate(event.id, (ev) => setActivePrize(ev, e.target.value || null))}
          className="h-12 w-full rounded-xl border border-line bg-white px-3 text-[15px] font-semibold outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
        >
          <option value="">No prize</option>
          {enabled.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {prizeRemaining(event, p)} left
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
