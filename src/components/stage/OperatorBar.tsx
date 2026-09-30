import { Lock, OctagonX, RotateCcw, Undo2, Unlock, Volume2, VolumeX, MonitorPlay } from 'lucide-react'
import type { AnimationMode, EventData, WinnersPerDraw } from '../../types'
import type { DrawController } from '../../hooks/useDrawController'
import { prizeRemaining, setActivePrize } from '../../lib/event/operations'
import { useApp } from '../../store/appStore'
import { isRevealing, isSpinning, useDraw } from '../../store/drawStore'
import { confirm } from '../common/ConfirmDialog'
import { Segmented } from '../common/Form'

interface Props {
  event: EventData
  ctrl: DrawController
  onPresent(): void
}

function IconBtn({ label, onClick, children, active, danger, disabled }: { label: string; onClick(): void; children: React.ReactNode; active?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      // Mouse clicks release focus so Space keeps meaning "spin" for the operator.
      onMouseUp={(e) => e.currentTarget.blur()}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition disabled:opacity-35 ${
        danger ? 'bg-[#c62f2f] text-white hover:brightness-110' : active ? 'bg-white text-ink' : 'bg-white/8 text-white/80 ring-1 ring-white/10 hover:bg-white/14 hover:text-white'
      }`}
    >
      {children}
      <span className={danger ? 'inline' : 'hidden min-[2300px]:inline'}>{label}</span>
    </button>
  )
}

/** Live draw controls for the operator screen. Hidden entirely in presentation mode. */
export function OperatorBar({ event, ctrl, onPresent }: Props) {
  const mutate = useApp((s) => s.mutateEvent)
  const { phase, locked } = useDraw()
  const busy = isSpinning(phase)
  const inDraw = busy || isRevealing(phase)
  const disabledSetup = inDraw || locked
  const setMode = (mode: AnimationMode) => mutate(event.id, (e) => ({ ...e, animationSettings: { ...e.animationSettings, mode } }))
  const setWinners = (winnersPerDraw: WinnersPerDraw) => mutate(event.id, (e) => ({ ...e, wheelSettings: { ...e.wheelSettings, winnersPerDraw } }))
  const toggleSound = () => mutate(event.id, (e) => ({ ...e, wheelSettings: { ...e.wheelSettings, sound: !e.wheelSettings.sound } }))

  return (
    <div className="relative z-30 border-t border-white/8 bg-black/35 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-white/60">
          <span className="font-semibold">Prize</span>
          <select
            value={event.activePrizeId ?? ''}
            disabled={disabledSetup}
            onChange={(e) => {
              mutate(event.id, (ev) => setActivePrize(ev, e.target.value || null))
              e.currentTarget.blur()
            }}
            className="h-10 max-w-[220px] rounded-xl bg-white/8 px-3 font-semibold text-white ring-1 ring-white/10 outline-none disabled:opacity-40 [&>option]:text-ink"
          >
            <option value="">No prize</option>
            {event.prizes
              .filter((p) => p.enabled)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({prizeRemaining(event, p)} left)
                </option>
              ))}
          </select>
        </label>
        <div className={`flex items-center gap-2 ${disabledSetup ? 'pointer-events-none opacity-40' : ''}`}>
          <span className="text-sm font-semibold text-white/60">Style</span>
          <Segmented<AnimationMode>
            dark
            label="Animation style"
            value={event.animationSettings.mode}
            onChange={setMode}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'dramatic', label: 'Dramatic' },
              { value: 'grand', label: 'Grand Prize' },
            ]}
          />
        </div>
        <div className={`flex items-center gap-2 ${disabledSetup ? 'pointer-events-none opacity-40' : ''}`}>
          <span className="text-sm font-semibold text-white/60">Winners</span>
          <Segmented<WinnersPerDraw>
            dark
            label="Winners per draw"
            value={event.wheelSettings.winnersPerDraw}
            onChange={setWinners}
            options={[1, 3, 5, 10].map((v) => ({ value: v as WinnersPerDraw, label: String(v) }))}
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <IconBtn label={event.wheelSettings.sound ? 'Sound on' : 'Sound off'} onClick={toggleSound}>
            {event.wheelSettings.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </IconBtn>
          <IconBtn
            label="Undo last draw"
            disabled={busy || locked || !event.winnerHistory.length}
            onClick={async () => {
              const last = [...event.winnerHistory].sort((a, b) => b.drawNumber - a.drawNumber)[0]
              if (
                last &&
                (await confirm({
                  title: 'Undo the last draw?',
                  message: `${last.participantName} will lose “${last.prizeName}” and go back into the draw.`,
                  confirmLabel: 'Undo draw',
                  danger: true,
                }))
              )
                ctrl.undoLast()
            }}
          >
            <Undo2 size={18} />
          </IconBtn>
          <IconBtn label="Reset current draw" disabled={!inDraw || busy} onClick={ctrl.resetCurrentDraw}>
            <RotateCcw size={18} />
          </IconBtn>
          <IconBtn label={locked ? 'Unlock controls' : 'Lock controls'} active={locked} onClick={ctrl.toggleLock}>
            {locked ? <Lock size={18} /> : <Unlock size={18} />}
          </IconBtn>
          <IconBtn label="Emergency stop" danger={busy} disabled={!busy} onClick={ctrl.emergencyStop}>
            <OctagonX size={18} />
          </IconBtn>
          <button
            onClick={onPresent}
            disabled={inDraw}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand shadow-lg transition hover:brightness-110 disabled:opacity-40"
          >
            <MonitorPlay size={18} /> Start presentation
          </button>
        </div>
      </div>
    </div>
  )
}
