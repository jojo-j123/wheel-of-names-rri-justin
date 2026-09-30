import { Download, FlaskConical, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AnimationSettings, ReducedMotionSetting } from '../../types'
import { Card, PageHeader } from '../../components/admin/PageHeader'
import { Button } from '../../components/common/Button'
import { Segmented, Toggle } from '../../components/common/Form'
import { runSelfCheck, type SelfCheckResult } from '../../lib/draw/selfCheck'
import { downloadText, eventFromJson, eventToJson, safeFileName } from '../../lib/export/exporters'
import { readTextFile } from '../../lib/csv/participantsCsv'
import { formatBytes, formatDateTime } from '../../lib/format'
import { storageEstimate } from '../../lib/storage/storage'
import { MODE_LABELS, MODE_TIMINGS, spinLength } from '../../lib/wheel/timings'
import { useActiveEvent, useApp } from '../../store/appStore'
import { toast } from '../../store/toastStore'
import { createId } from '../../lib/random/secureRandom'

function Slider({ label, value, min, max, step, unit, onChange, defaultLabel, isDefault, onDefault }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange(v: number): void; defaultLabel: string; isDefault: boolean; onDefault(): void }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <label className="font-semibold">{label}</label>
        <span className="tabular font-display text-lg font-semibold">
          {value}
          {unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-[var(--brand-primary)]" aria-label={label} />
      <div className="mt-2 flex items-center justify-between text-sm text-muted">
        <span>{isDefault ? `Using the style default (${defaultLabel})` : 'Custom value'}</span>
        {!isDefault && (
          <button className="font-semibold text-brand" onClick={onDefault}>
            Use default
          </button>
        )}
      </div>
    </div>
  )
}

export function AdvancedSettingsPage() {
  const event = useActiveEvent()!
  const mutate = useApp((s) => s.mutateEvent)
  const addEvent = useApp((s) => s.addEvent)
  const persistent = useApp((s) => s.persistent)
  const eventCount = useApp((s) => Object.keys(s.events).length)
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  const [check, setCheck] = useState<SelfCheckResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    void storageEstimate().then(setStorage)
  }, [])
  const a = event.animationSettings
  const base = MODE_TIMINGS[a.mode]
  const setA = (patch: Partial<AnimationSettings>) => mutate(event.id, (e) => ({ ...e, animationSettings: { ...e.animationSettings, ...patch } }))

  return (
    <div className="max-w-3xl">
      <PageHeader title="Advanced settings" description="Optional fine-tuning. The defaults work well for most events." />
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Wheel behaviour</h2>
          <Slider
            label={`Spin length (${MODE_LABELS[a.mode].title})`}
            value={a.spinDuration ?? Math.round(spinLength(base))}
            min={2}
            max={30}
            step={1}
            unit=" s"
            isDefault={a.spinDuration === null}
            defaultLabel={`${Math.round(spinLength(base))} s`}
            onChange={(v) => setA({ spinDuration: v })}
            onDefault={() => setA({ spinDuration: null })}
          />
          <Slider
            label="Full turns before stopping"
            value={a.rotations ?? base.rotations}
            min={1}
            max={40}
            step={1}
            unit=""
            isDefault={a.rotations === null}
            defaultLabel={`${base.rotations}`}
            onChange={(v) => setA({ rotations: v })}
            onDefault={() => setA({ rotations: null })}
          />
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white px-5 py-4">
            <div>
              <p className="font-semibold">Reduced motion</p>
              <p className="text-sm text-muted">Shorter spin, fewer effects. “Automatic” follows the computer’s accessibility setting.</p>
            </div>
            <Segmented<ReducedMotionSetting>
              label="Reduced motion"
              value={a.reducedMotion}
              onChange={(v) => setA({ reducedMotion: v })}
              options={[
                { value: 'system', label: 'Automatic' },
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
            />
          </div>
          <Toggle label="Block duplicate names" description="When adding or importing, skip names that are already on the list." checked={event.wheelSettings.preventDuplicates} onChange={(v) => mutate(event.id, (e) => ({ ...e, wheelSettings: { ...e.wheelSettings, preventDuplicates: v } }))} />
          <Toggle label="Go full screen when the presentation starts" description="Press Esc at any time to leave full screen." checked={a.autoFullscreen} onChange={(v) => setA({ autoFullscreen: v })} />
        </section>

        <Card>
          <h2 className="font-display text-lg font-semibold">Backup & move events</h2>
          <p className="mt-1 text-sm text-muted">Save this whole event (names, prizes, winners, branding, settings) to a file, or load one on another computer.</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const imported = eventFromJson(await readTextFile(f))
                const exists = useApp.getState().events[imported.id]
                if (exists) imported.id = createId('evt')
                addEvent({ ...imported, updatedAt: Date.now() })
                toast.success(`“${imported.eventName}” imported and opened.`)
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'That file couldn’t be imported.')
              }
            }}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button icon={<Download size={18} />} onClick={() => downloadText(`${safeFileName(event.eventName)}.event.json`, eventToJson(event), 'application/json')}>
              Export event file
            </Button>
            <Button icon={<Upload size={18} />} onClick={() => fileRef.current?.click()}>
              Import event file
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Fairness self-check</h2>
          <p className="mt-1 text-sm text-muted">Simulates 500 complete spins across wheel sizes from 1 to 1,000 names and confirms the wheel always stops on the winner that was picked securely before spinning.</p>
          <Button className="mt-4" icon={<FlaskConical size={18} />} onClick={() => setCheck(runSelfCheck(500))}>
            Run self-check
          </Button>
          {check && (
            <ul className="mt-4 space-y-1.5 text-sm">
              <li className={check.mismatches === 0 ? 'font-semibold text-success' : 'font-semibold text-danger'}>
                {check.mismatches === 0 ? '✓' : '✗'} {check.draws} simulated draws · {check.mismatches} wrong landings
              </li>
              <li className={check.backwardFrames === 0 ? 'text-success' : 'text-danger'}>
                {check.backwardFrames === 0 ? '✓' : '✗'} Smooth motion: no reverse movement during the spin
              </li>
              <li className={check.distribution.pass ? 'text-success' : 'text-danger'}>
                {check.distribution.pass ? '✓' : '✗'} Random source is uniform (χ² = {check.distribution.chiSquare.toFixed(1)} over {check.distribution.samples.toLocaleString()} samples)
              </li>
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Storage & information</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted">Saved on this device</dt>
            <dd className="font-semibold">{persistent ? 'Yes (browser storage)' : 'No — storage is blocked in this browser'}</dd>
            <dt className="text-muted">Events</dt>
            <dd className="font-semibold">{eventCount}</dd>
            {storage && (
              <>
                <dt className="text-muted">Space used</dt>
                <dd className="font-semibold">
                  {formatBytes(storage.usage)} of {formatBytes(storage.quota)}
                </dd>
              </>
            )}
            <dt className="text-muted">Random source</dt>
            <dd className="font-semibold">crypto.getRandomValues (cryptographically secure)</dd>
            <dt className="text-muted">Privacy</dt>
            <dd className="font-semibold">Data stays in this browser. Nothing is sent anywhere.</dd>
          </dl>
          {event.auditLog.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold">Activity log ({event.auditLog.length})</summary>
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm text-ink-soft">
                {[...event.auditLog].reverse().map((l) => (
                  <li key={l.id}>
                    <span className="text-muted">{formatDateTime(l.timestamp)}</span> — {l.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      </div>
    </div>
  )
}
