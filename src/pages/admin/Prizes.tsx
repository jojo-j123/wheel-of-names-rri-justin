import { Gift, Plus } from 'lucide-react'
import { useState } from 'react'
import type { Prize } from '../../types'
import { PageHeader } from '../../components/admin/PageHeader'
import { Button } from '../../components/common/Button'
import { confirm } from '../../components/common/ConfirmDialog'
import { PrizeCard } from '../../components/prizes/PrizeCard'
import { PrizeEditor } from '../../components/prizes/PrizeEditor'
import { PrizeSelector } from '../../components/prizes/PrizeSelector'
import { addPrize, FriendlyError, prizeAwardedCount, prizeRemaining, removePrize, setActivePrize, setPrizeEnabled, updatePrize } from '../../lib/event/operations'
import { useActiveEvent, useApp } from '../../store/appStore'
import { toast } from '../../store/toastStore'

export function PrizesPage() {
  const event = useActiveEvent()!
  const mutate = useApp((s) => s.mutateEvent)
  const [editing, setEditing] = useState<Prize | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <div>
      <PageHeader
        title="Prizes"
        description="Add each prize with a photo. Choose which prize the next draw is for."
        actions={
          <Button variant="primary" size="lg" icon={<Plus size={20} />} onClick={() => { setEditing(null); setOpen(true) }}>
            Add prize
          </Button>
        }
      />
      {event.prizes.length > 0 && (
        <div className="mb-8">
          <PrizeSelector event={event} />
        </div>
      )}
      {event.prizes.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-card px-6 py-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Gift size={26} />
          </div>
          <p className="mt-4 font-display text-lg font-semibold">No prizes yet</p>
          <p className="mt-1 max-w-sm text-muted">Add your first prize. You can still spin without a prize if you just need a random name.</p>
          <Button variant="primary" className="mt-6" icon={<Plus size={18} />} onClick={() => { setEditing(null); setOpen(true) }}>
            Add prize
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {event.prizes.map((p) => (
            <PrizeCard
              key={p.id}
              prize={p}
              remaining={prizeRemaining(event, p)}
              active={event.activePrizeId === p.id}
              onChoose={() => {
                mutate(event.id, (e) => setActivePrize(e, p.id))
                toast.success(`Next draw is for “${p.name}”.`)
              }}
              onToggle={() => mutate(event.id, (e) => setPrizeEnabled(e, p.id, !p.enabled))}
              onEdit={() => {
                setEditing(p)
                setOpen(true)
              }}
              onDelete={async () => {
                const awarded = prizeAwardedCount(event, p.id)
                if (
                  await confirm({
                    title: `Delete “${p.name}”?`,
                    message: awarded ? `This prize has already been won ${awarded} time(s). Those winners stay in the history.` : 'This prize will be removed from the event.',
                    confirmLabel: 'Delete prize',
                    danger: true,
                  })
                ) {
                  mutate(event.id, (e) => removePrize(e, p.id))
                  toast.success('Prize deleted.')
                }
              }}
            />
          ))}
        </div>
      )}
      <PrizeEditor
        open={open}
        prize={editing}
        onClose={() => setOpen(false)}
        onSave={(input) => {
          try {
            if (editing) mutate(event.id, (e) => updatePrize(e, editing.id, input))
            else mutate(event.id, (e) => addPrize(e, input).event)
            toast.success(editing ? 'Prize updated.' : 'Prize added.')
            return null
          } catch (e) {
            return e instanceof FriendlyError ? e.message : 'The prize couldn’t be saved.'
          }
        }}
      />
    </div>
  )
}
