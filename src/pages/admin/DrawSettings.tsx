import { Check, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AnimationMode, WheelSettings, WinnersPerDraw } from '../../types'
import { Card, PageHeader } from '../../components/admin/PageHeader'
import { Button } from '../../components/common/Button'
import { Toggle } from '../../components/common/Form'
import { MODE_LABELS } from '../../lib/wheel/timings'
import { useActiveEvent, useApp } from '../../store/appStore'
import { useUnsavedWarning } from '../../hooks/useUnsavedWarning'
import { toast } from '../../store/toastStore'

export function DrawSettingsPage() {
  const event = useActiveEvent()!
  const mutate = useApp((s) => s.mutateEvent)
  const [mode, setMode] = useState<AnimationMode>(event.animationSettings.mode)
  const [ws, setWs] = useState<WheelSettings>(event.wheelSettings)
  useEffect(() => {
    setMode(event.animationSettings.mode)
    setWs(event.wheelSettings)
  }, [event.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof WheelSettings>(k: K, v: WheelSettings[K]) => setWs((s) => ({ ...s, [k]: v }))
  const dirty = mode !== event.animationSettings.mode || JSON.stringify(ws) !== JSON.stringify(event.wheelSettings)
  useUnsavedWarning(dirty)

  const save = () => {
    mutate(event.id, (e) => ({ ...e, wheelSettings: ws, animationSettings: { ...e.animationSettings, mode }, updatedAt: Date.now() }), { immediate: true })
    toast.success('Settings saved.')
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Draw settings" description="How the wheel spins and what happens after someone wins." />
      <div className="space-y-6">
        <Card>
          <h2 className="font-display text-lg font-semibold">Animation style</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Animation style">
            {(Object.keys(MODE_LABELS) as AnimationMode[]).map((m) => {
              const active = m === mode
              return (
                <button
                  key={m}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMode(m)}
                  className={`relative rounded-2xl border p-4 text-left transition ${active ? 'border-brand bg-brand/[0.05] ring-4 ring-brand/15' : 'border-line bg-field hover:border-ink/25'}`}
                >
                  {active && (
                    <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-brand text-on-brand">
                      <Check size={14} />
                    </span>
                  )}
                  <p className="font-display font-semibold">{MODE_LABELS[m].title}</p>
                  <p className="mt-1 text-sm text-muted">{MODE_LABELS[m].blurb}</p>
                </button>
              )
            })}
          </div>
        </Card>

        <div className="space-y-3">
          <Toggle label="Sound" description="Wheel clicks, drum-roll and celebration sounds." checked={ws.sound} onChange={(v) => set('sound', v)} />
          <Toggle label="Confetti" description="Celebrate each winner with confetti." checked={ws.confetti} onChange={(v) => set('confetti', v)} />
          <Toggle label="Show the prize next to the wheel" description="Turn off for a much bigger wheel. The prize still appears in the winner reveal." checked={ws.showPrize !== false} onChange={(v) => set('showPrize', v)} />
          <Toggle label="Remove winners after each draw" description="Someone who wins can’t win again. Turn off to keep winners in the draw." checked={ws.removeWinners} onChange={(v) => set('removeWinners', v)} />
        </div>

        <Card>
          <h2 className="font-display text-lg font-semibold">Number of winners per spin</h2>
          <p className="mt-1 text-sm text-muted">With more than one, each winner gets their own spin and reveal, one after another.</p>
          <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Number of winners">
            {([1, 3, 5, 10] as WinnersPerDraw[]).map((nw) => (
              <button
                key={nw}
                role="radio"
                aria-checked={ws.winnersPerDraw === nw}
                onClick={() => set('winnersPerDraw', nw)}
                className={`h-14 w-20 rounded-2xl border font-display text-xl font-semibold transition ${ws.winnersPerDraw === nw ? 'border-brand bg-brand text-on-brand' : 'border-line bg-field hover:border-ink/25'}`}
              >
                {nw}
              </button>
            ))}
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/admin/advanced" className="text-sm font-semibold text-muted hover:text-ink">
            Advanced settings →
          </Link>
          <Button variant="primary" size="lg" icon={<Save size={20} />} disabled={!dirty} onClick={save}>
            Save settings
          </Button>
        </div>
      </div>
    </div>
  )
}
