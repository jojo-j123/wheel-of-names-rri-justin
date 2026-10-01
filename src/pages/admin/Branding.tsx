import { RotateCcw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Branding } from '../../types'
import { Card, PageHeader } from '../../components/admin/PageHeader'
import { BrandPreview } from '../../components/branding/BrandPreview'
import { BrandingEditor } from '../../components/branding/BrandingEditor'
import { Button } from '../../components/common/Button'
import { TextInput } from '../../components/common/Form'
import { DEFAULT_BRANDING } from '../../lib/branding'
import { cleanName } from '../../lib/event/operations'
import { useActiveEvent, useApp } from '../../store/appStore'
import { useUnsavedWarning } from '../../hooks/useUnsavedWarning'
import { toast } from '../../store/toastStore'

export function BrandingPage() {
  const event = useActiveEvent()!
  const mutate = useApp((s) => s.mutateEvent)
  const [draft, setDraft] = useState<Branding>(event.branding)
  const [title, setTitle] = useState(event.eventName)
  useEffect(() => {
    setDraft(event.branding)
    setTitle(event.eventName)
  }, [event.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(draft) !== JSON.stringify(event.branding) || title !== event.eventName
  useUnsavedWarning(dirty)

  const save = () => {
    mutate(event.id, (e) => ({ ...e, eventName: cleanName(title) || e.eventName, branding: { ...draft, companyName: cleanName(draft.companyName) || 'RRI' }, updatedAt: Date.now() }), { immediate: true })
    toast.success('Branding saved.')
  }
  return (
    <div>
      <PageHeader
        title="Branding"
        description="Logo and colours used on the big screen. RRI is the default."
        actions={
          <>
            <Button icon={<RotateCcw size={18} />} onClick={() => setDraft({ ...DEFAULT_BRANDING })}>
              Reset to RRI
            </Button>
            <Button variant="primary" icon={<Save size={18} />} disabled={!dirty} onClick={save}>
              Save branding
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <Card>
          <div className="space-y-6">
            <TextInput label="Event title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
            <BrandingEditor value={draft} onChange={setDraft} />
          </div>
        </Card>
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="mb-2 text-sm font-semibold text-muted">Live preview</p>
          <BrandPreview branding={draft} eventName={title || event.eventName} />
          {dirty && <p className="mt-3 text-center text-sm font-medium text-brand">You have unsaved changes.</p>}
        </div>
      </div>
    </div>
  )
}
