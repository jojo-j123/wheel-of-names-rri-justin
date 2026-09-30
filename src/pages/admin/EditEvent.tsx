import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, PageHeader } from '../../components/admin/PageHeader'
import { Button } from '../../components/common/Button'
import { TextArea, TextInput } from '../../components/common/Form'
import { cleanName } from '../../lib/event/operations'
import { useActiveEvent, useApp } from '../../store/appStore'
import { toast } from '../../store/toastStore'

export function EditEventPage() {
  const event = useActiveEvent()!
  const mutate = useApp((s) => s.mutateEvent)
  const [v, setV] = useState({ name: event.eventName, date: event.eventDate, description: event.description, company: event.branding.companyName })
  useEffect(() => setV({ name: event.eventName, date: event.eventDate, description: event.description, company: event.branding.companyName }), [event.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cleanName(v.name)) return toast.error('Please enter an event name.')
    mutate(
      event.id,
      (ev) => ({
        ...ev,
        eventName: cleanName(v.name),
        eventDate: v.date,
        description: v.description.trim().slice(0, 500),
        branding: { ...ev.branding, companyName: cleanName(v.company) || ev.branding.companyName },
        isDemo: false,
        updatedAt: Date.now(),
      }),
      { immediate: true },
    )
    toast.success('Changes saved.')
  }
  return (
    <div className="max-w-2xl">
      <PageHeader title="Edit event" description="The event name is shown on the big screen." />
      <Card>
        <form onSubmit={submit} className="space-y-5">
          <TextInput label="Event name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={80} />
          <TextInput label="Event date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
          <TextArea label="Event description" rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} hint="Optional. Shown on the big screen when no prize is selected." maxLength={500} />
          <TextInput label="Company name" value={v.company} onChange={(e) => setV({ ...v, company: e.target.value })} maxLength={60} />
          <Button type="submit" variant="primary" size="lg" icon={<Save size={20} />}>
            Save changes
          </Button>
        </form>
      </Card>
    </div>
  )
}
