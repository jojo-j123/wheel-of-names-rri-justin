import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, FileUp, Gift, MonitorPlay, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { EventData } from '../../types'
import { Card } from '../../components/admin/PageHeader'
import { BrandPreview } from '../../components/branding/BrandPreview'
import { BrandingEditor } from '../../components/branding/BrandingEditor'
import { Button } from '../../components/common/Button'
import { TextArea, TextInput } from '../../components/common/Form'
import { ParticipantImporter } from '../../components/participants/ParticipantImporter'
import { PrizeEditor } from '../../components/prizes/PrizeEditor'
import { usePresent } from '../../hooks/usePresent'
import { parsePastedNames } from '../../lib/csv/participantsCsv'
import { createEmptyEvent } from '../../lib/event/defaults'
import { sanitizeEvent } from '../../lib/event/sanitize'
import { BUILT_IN_TEMPLATES } from '../../lib/event/demo'
import { addParticipants, addPrize, cleanName, eventFromTemplate, FriendlyError, removePrize } from '../../lib/event/operations'
import { plural } from '../../lib/format'
import { useApp } from '../../store/appStore'
import { toast } from '../../store/toastStore'

const STEPS = ['Event name', 'Participants', 'Prizes', 'Branding', 'Ready']

const WIZARD_KEY = 'rri-setup-wizard'

interface WizardDraft {
  step: number
  templateId: string
  draft: EventData
}

function loadWizardDraft(templateParam: string | null): WizardDraft | null {
  try {
    const raw = sessionStorage.getItem(WIZARD_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { step?: unknown; templateId?: unknown; draft?: { eventName?: unknown } }
    if (templateParam && data.templateId !== templateParam) return null
    const draft = sanitizeEvent(data.draft)
    if (!draft) return null
    draft.eventName = typeof data.draft?.eventName === 'string' ? data.draft.eventName : ''
    const step = typeof data.step === 'number' ? Math.max(0, Math.min(3, Math.floor(data.step))) : 0
    return { step, templateId: typeof data.templateId === 'string' ? data.templateId : '', draft }
  } catch {
    return null
  }
}

function saveWizardDraft(d: WizardDraft) {
  try {
    sessionStorage.setItem(WIZARD_KEY, JSON.stringify(d))
  } catch {
    /* storage full or blocked — the wizard still works, it just won't survive a refresh */
  }
}

function clearWizardDraft() {
  try {
    sessionStorage.removeItem(WIZARD_KEY)
  } catch {
    /* ignore */
  }
}

export function SetupWizardPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const present = usePresent()
  const { templates, addEvent } = useApp()
  const allTemplates = useMemo(() => [...templates, ...BUILT_IN_TEMPLATES], [templates])
  // Wizard progress survives a page refresh (kept in this tab's session storage until the event is created).
  const [saved] = useState(() => loadWizardDraft(params.get('template')))
  const [templateId, setTemplateId] = useState<string>(saved?.templateId ?? params.get('template') ?? '')
  const [step, setStep] = useState(saved?.step ?? 0)
  const [draft, setDraft] = useState<EventData>(() => {
    if (saved) return saved.draft
    const t = allTemplates.find((x) => x.id === params.get('template'))
    return t ? eventFromTemplate(t, '') : createEmptyEvent('')
  })
  useEffect(() => {
    if (step < 4) saveWizardDraft({ step, templateId, draft })
  }, [step, templateId, draft])
  const [paste, setPaste] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [prizeOpen, setPrizeOpen] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const chooseTemplate = (id: string) => {
    setTemplateId(id)
    const t = allTemplates.find((x) => x.id === id)
    const base = t ? eventFromTemplate(t, draft.eventName) : createEmptyEvent(draft.eventName)
    setDraft({ ...base, eventName: draft.eventName, eventDate: draft.eventDate, participants: draft.participants })
  }

  const addPasted = () => {
    const names = parsePastedNames(paste)
    if (!names.length) return
    const r = addParticipants(draft, names.map((name) => ({ name })), { preventDuplicates: draft.wheelSettings.preventDuplicates })
    setDraft(r.event)
    setPaste('')
    toast.success(`${plural(r.added, 'participant')} added.`)
  }

  const finish = () => {
    const ev: EventData = { ...draft, eventName: cleanName(draft.eventName) || 'My Event', updatedAt: Date.now() }
    addEvent(ev, true)
    clearWizardDraft()
    setCreatedId(ev.id)
    setStep(4)
  }

  const next = () => {
    if (step === 0 && !cleanName(draft.eventName)) return toast.error('Please enter an event name.')
    if (step === 3) return finish()
    setStep((s) => Math.min(4, s + 1))
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        <Link to="/admin" onClick={clearWizardDraft} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <X size={16} /> {createdId ? 'Close' : 'Skip setup'}
        </Link>
        <p className="text-sm font-semibold text-muted">Quick setup</p>
      </div>

      {/* Progress: 1 ─── 2 ─── 3 ─── 4 ─── 5 */}
      <ol className="mb-10 flex items-center" aria-label="Setup progress">
        {STEPS.map((label, i) => (
          <li key={label} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                aria-current={i === step ? 'step' : undefined}
                className={`grid h-10 w-10 place-items-center rounded-full font-display font-semibold transition ${i < step ? 'bg-brand text-on-brand' : i === step ? 'bg-inverse text-white ring-4 ring-ink/10' : 'bg-ink/8 text-muted'}`}
              >
                {i < step ? <Check size={18} /> : i + 1}
              </span>
              <span className={`hidden text-xs font-semibold sm:block ${i === step ? 'text-ink' : 'text-muted'}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <span className={`mx-2 mb-0 h-0.5 flex-1 rounded sm:mb-6 ${i < step ? 'bg-brand' : 'bg-line'}`} />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {step === 0 && (
            <Card>
              <h1 className="font-display text-2xl font-semibold">What’s your event called?</h1>
              <div className="mt-6 space-y-5">
                <TextInput label="Event name" required value={draft.eventName} onChange={(e) => setDraft({ ...draft, eventName: e.target.value })} placeholder="e.g. RRI Annual Gala 2026" maxLength={80} autoFocus />
                <TextInput label="Event date" type="date" value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} />
                <div>
                  <p className="mb-2 text-sm font-semibold">Start from</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[{ id: '', name: 'Blank event (RRI branding)' }, ...allTemplates].map((t) => (
                      <button
                        key={t.id || 'blank'}
                        onClick={() => chooseTemplate(t.id)}
                        className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${templateId === t.id ? 'border-brand bg-brand/[0.05] ring-4 ring-brand/12' : 'border-line bg-field hover:border-ink/25'}`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <h1 className="font-display text-2xl font-semibold">Who’s in the draw?</h1>
              <p className="mt-1 text-muted">
                <span className="font-semibold text-ink">{plural(draft.participants.length, 'participant')}</span> added so far.
              </p>
              <div className="mt-6 space-y-4">
                <TextArea label="Paste names (one per line)" rows={8} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'John Doe\nJane Smith\nAhmed Ali'} />
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" icon={<Plus size={18} />} disabled={!parsePastedNames(paste).length} onClick={addPasted}>
                    Add {plural(parsePastedNames(paste).length, 'name')}
                  </Button>
                  <Button icon={<FileUp size={18} />} onClick={() => setImportOpen(true)}>
                    Import Excel / Word / CSV
                  </Button>
                  {draft.participants.length > 0 && (
                    <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setDraft({ ...draft, participants: [] })}>
                      Start over
                    </Button>
                  )}
                </div>
                {draft.participants.length > 0 && (
                  <p className="rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">
                    {draft.participants.slice(0, 8).map((p) => p.name).join(', ')}
                    {draft.participants.length > 8 && ` and ${draft.participants.length - 8} more`}
                  </p>
                )}
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <h1 className="font-display text-2xl font-semibold">What can people win?</h1>
              <p className="mt-1 text-muted">Add prizes with photos. You can skip this and spin just for names.</p>
              <div className="mt-6 space-y-2">
                {draft.prizes.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-field p-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand/10 text-brand">
                      {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <Gift size={20} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-sm text-muted">Quantity {p.quantity}</p>
                    </div>
                    <button className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Remove ${p.name}`} onClick={() => setDraft(removePrize(draft, p.id))}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
                <Button variant="primary" className="mt-2" icon={<Plus size={18} />} onClick={() => setPrizeOpen(true)}>
                  Add prize
                </Button>
              </div>
            </Card>
          )}

          {step === 3 && (
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <Card>
                <h1 className="font-display text-2xl font-semibold">Choose your look</h1>
                <p className="mb-6 mt-1 text-muted">RRI branding is already set. Change it only if this event needs a different look.</p>
                <BrandingEditor value={draft.branding} onChange={(branding) => setDraft({ ...draft, branding })} />
              </Card>
              <div className="lg:sticky lg:top-28 lg:self-start">
                <BrandPreview branding={draft.branding} eventName={draft.eventName || 'My Event'} />
              </div>
            </div>
          )}

          {step === 4 && (
            <Card className="text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand text-on-brand">
                <Check size={30} />
              </div>
              <h1 className="mt-5 font-display text-3xl font-semibold">Your event is ready!</h1>
              <p className="mt-2 text-muted">{draft.eventName}</p>
              <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
                <div className="rounded-2xl bg-paper p-4">
                  <p className="text-sm text-muted">Participants</p>
                  <p className="font-display text-3xl font-semibold">{draft.participants.length.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl bg-paper p-4">
                  <p className="text-sm text-muted">Prizes</p>
                  <p className="font-display text-3xl font-semibold">{draft.prizes.length}</p>
                </div>
              </div>
              <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
                <Button variant="primary" size="xl" icon={<MonitorPlay size={22} />} onClick={() => createdId && present(createdId)}>
                  START PRESENTATION
                </Button>
                <Button onClick={() => navigate('/admin')}>Go to admin</Button>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {step < 4 && (
        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" icon={<ChevronLeft size={18} />} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          <div className="flex gap-2">
            {step > 0 && step < 3 && (
              <Button variant="ghost" onClick={() => setStep((s) => s + 1)}>
                Skip
              </Button>
            )}
            <Button variant="primary" size="lg" onClick={next}>
              {step === 3 ? 'Create event' : 'Next'} <ChevronRight size={18} />
            </Button>
          </div>
        </div>
      )}

      <ParticipantImporter
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(people) => {
          const r = addParticipants(draft, people, { preventDuplicates: draft.wheelSettings.preventDuplicates })
          setDraft(r.event)
          toast.success(`${plural(r.added, 'participant')} added.`)
        }}
      />
      <PrizeEditor
        open={prizeOpen}
        prize={null}
        onClose={() => setPrizeOpen(false)}
        onSave={(input) => {
          try {
            setDraft((d) => addPrize(d, input).event)
            return null
          } catch (e) {
            return e instanceof FriendlyError ? e.message : 'The prize couldn’t be saved.'
          }
        }}
      />
    </div>
  )
}
