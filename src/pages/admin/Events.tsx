import { LayoutTemplate, Plus, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EventData } from '../../types'
import { PageHeader } from '../../components/admin/PageHeader'
import { Button } from '../../components/common/Button'
import { confirm } from '../../components/common/ConfirmDialog'
import { PromptDialog } from '../../components/common/PromptDialog'
import { EventCard } from '../../components/event/EventCard'
import { BUILT_IN_TEMPLATES } from '../../lib/event/demo'
import { cleanName, duplicateEvent, eventToTemplate, resetEvent } from '../../lib/event/operations'
import { downloadText, eventFromJson, eventToJson, safeFileName } from '../../lib/export/exporters'
import { readTextFile } from '../../lib/csv/participantsCsv'
import { createId } from '../../lib/random/secureRandom'
import { plural } from '../../lib/format'
import { useApp } from '../../store/appStore'
import { isRevealing, isSpinning, useDraw } from '../../store/drawStore'
import { toast } from '../../store/toastStore'

type PromptState = { kind: 'rename' | 'template'; event: EventData } | null

export function EventsPage() {
  const { events, activeEventId, templates, setActiveEvent, addEvent, deleteEvent, mutateEvent, saveTemplate, deleteTemplate } = useApp()
  const phase = useDraw((s) => s.phase)
  const busy = isSpinning(phase) || isRevealing(phase)
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState<PromptState>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const list = Object.values(events).sort((a, b) => b.updatedAt - a.updatedAt)

  const guard = () => {
    if (busy) toast.info('Finish the current draw first.')
    return busy
  }

  return (
    <div>
      <PageHeader
        title="Events & templates"
        description="Each event keeps its own participants, prizes, winners and branding."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f || guard()) return
                try {
                  const imported = eventFromJson(await readTextFile(f))
                  if (events[imported.id]) imported.id = createId('evt')
                  addEvent({ ...imported, updatedAt: Date.now() })
                  toast.success(`“${imported.eventName}” imported and opened.`)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'That file couldn’t be imported.')
                }
              }}
            />
            <Button icon={<Upload size={18} />} onClick={() => fileRef.current?.click()}>
              Import event file
            </Button>
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => navigate('/admin/setup')}>
              New event
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {list.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            active={e.id === activeEventId}
            onOpen={() => {
              if (guard()) return
              setActiveEvent(e.id)
              toast.success(`Opened “${e.eventName}”.`)
              navigate('/admin')
            }}
            onRename={() => setPrompt({ kind: 'rename', event: e })}
            onTemplate={() => setPrompt({ kind: 'template', event: e })}
            onDuplicate={() => {
              addEvent(duplicateEvent(e), false)
              toast.success('Event duplicated (participants and prizes copied, winners cleared).')
            }}
            onExport={() => downloadText(`${safeFileName(e.eventName)}.event.json`, eventToJson(e), 'application/json')}
            onReset={async () => {
              if (e.id === activeEventId && guard()) return
              if (
                await confirm({
                  title: `Reset “${e.eventName}”?`,
                  message: `All ${plural(e.winnerHistory.length, 'winner')} will be cleared. Everyone becomes eligible again and all prizes are available again. Participants and prizes are kept.\n\nThis action cannot be undone.`,
                  confirmLabel: 'Reset event',
                  danger: true,
                })
              ) {
                mutateEvent(e.id, resetEvent, { immediate: true })
                toast.success('Event reset.')
              }
            }}
            onDelete={async () => {
              if (e.id === activeEventId && guard()) return
              if (
                await confirm({
                  title: `Delete “${e.eventName}”?`,
                  message: `This removes the event with ${plural(e.participants.length, 'participant')}, ${plural(e.prizes.length, 'prize')} and ${plural(e.winnerHistory.length, 'winner')}.\n\nThis action cannot be undone. Tip: export the event file first if you might need it.`,
                  confirmLabel: 'Delete event',
                  danger: true,
                })
              ) {
                deleteEvent(e.id)
                toast.success('Event deleted.')
              }
            }}
          />
        ))}
      </div>

      <h2 className="mt-14 font-display text-2xl font-semibold">Templates</h2>
      <p className="mt-1 text-muted">Start a new event with ready-made branding, settings and prizes. Participants and winners always start empty.</p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...templates, ...BUILT_IN_TEMPLATES].map((t) => (
          <div key={t.id} className="flex flex-col rounded-3xl border border-line bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: t.branding.primaryColor, color: '#fff' }}>
                <LayoutTemplate size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{t.name}</p>
                <p className="text-xs text-muted">{t.builtIn ? 'Built-in' : 'Saved by you'} · {plural(t.prizes.length, 'prize')}</p>
              </div>
              {!t.builtIn && (
                <button
                  className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                  aria-label={`Delete template ${t.name}`}
                  onClick={async () => {
                    if (await confirm({ title: `Delete template “${t.name}”?`, message: 'Events already created from it are not affected.', confirmLabel: 'Delete template', danger: true })) deleteTemplate(t.id)
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {t.description && <p className="mt-3 flex-1 text-sm text-muted">{t.description}</p>}
            <Button size="sm" className="mt-4" onClick={() => navigate(`/admin/setup?template=${encodeURIComponent(t.id)}`)}>
              Use this template
            </Button>
          </div>
        ))}
      </div>

      <PromptDialog
        open={!!prompt}
        title={prompt?.kind === 'rename' ? 'Rename event' : 'Save as template'}
        label={prompt?.kind === 'rename' ? 'Event name' : 'Template name'}
        initial={prompt?.kind === 'rename' ? prompt.event.eventName : `${prompt?.event.eventName ?? ''} template`}
        confirmLabel={prompt?.kind === 'rename' ? 'Rename' : 'Save template'}
        onClose={() => setPrompt(null)}
        onSubmit={(v) => {
          if (!prompt) return
          if (prompt.kind === 'rename') {
            mutateEvent(prompt.event.id, (e) => ({ ...e, eventName: cleanName(v), updatedAt: Date.now() }))
            toast.success('Event renamed.')
          } else {
            saveTemplate(eventToTemplate(prompt.event, v))
            toast.success('Template saved. It keeps branding, settings and prizes.')
          }
          setPrompt(null)
        }}
      />
    </div>
  )
}
