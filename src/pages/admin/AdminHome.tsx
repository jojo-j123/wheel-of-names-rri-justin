import { motion } from 'framer-motion'
import { CalendarDays, ChevronRight, Gift, History, MonitorPlay, Palette, SlidersHorizontal, Sparkles, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Stat } from '../../components/admin/PageHeader'
import { Button } from '../../components/common/Button'
import { PrizeSelector } from '../../components/prizes/PrizeSelector'
import { usePresent } from '../../hooks/usePresent'
import { getEligibleParticipants } from '../../lib/event/operations'
import { formatDate, plural } from '../../lib/format'
import { MODE_LABELS } from '../../lib/wheel/timings'
import { useActiveEvent } from '../../store/appStore'

export function AdminHome() {
  const event = useActiveEvent()!
  const present = usePresent()
  const eligible = getEligibleParticipants(event).length
  const cards = [
    { to: '/admin/participants', icon: Users, title: 'Participants', text: `${plural(event.participants.length, 'person', 'people')} on the list`, cta: 'Edit participants' },
    { to: '/admin/prizes', icon: Gift, title: 'Prizes', text: `${plural(event.prizes.length, 'prize')} set up`, cta: 'Manage prizes' },
    { to: '/admin/event', icon: CalendarDays, title: 'Event', text: event.eventDate ? formatDate(event.eventDate) : 'Name, date and description', cta: 'Edit event' },
    { to: '/admin/branding', icon: Palette, title: 'Branding', text: `${event.branding.companyName} logo and colours`, cta: 'Change branding' },
    { to: '/admin/draw', icon: SlidersHorizontal, title: 'Draw settings', text: `${MODE_LABELS[event.animationSettings.mode].title} · ${event.wheelSettings.removeWinners ? 'winners removed' : 'winners stay in'}`, cta: 'Draw settings' },
    { to: '/admin/winners', icon: History, title: 'Winner history', text: `${plural(event.winnerHistory.length, 'winner')} so far`, cta: 'View winners' },
  ]
  return (
    <div className="space-y-8">
      {event.isDemo && (
        <div className="flex flex-col gap-4 rounded-3xl border border-brand/20 bg-brand/[0.06] p-5 sm:flex-row sm:items-center">
          <Sparkles className="shrink-0 text-brand" />
          <p className="flex-1 text-[15px] text-ink-soft">
            <strong className="text-ink">This is demo data.</strong> Try a spin, then replace the names and prizes — or set up a brand-new event in five quick steps.
          </p>
          <Link to="/admin/setup">
            <Button variant="primary">Set up my event</Button>
          </Link>
        </div>
      )}

      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">Event</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{event.eventName}</h1>
          <Link to="/admin/events" className="text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
            Switch or create event
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Participants" value={event.participants.length} />
        <Stat label="Eligible" value={eligible} tone="brand" />
        <Stat label="Prizes" value={event.prizes.length} />
        <Stat label="Winners" value={event.winnerHistory.length} />
      </div>

      <PrizeSelector event={event} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div key={c.to} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Link
              to={c.to}
              className="group flex h-full flex-col rounded-3xl border border-line bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lift"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-on-brand">
                <c.icon size={24} />
              </div>
              <h2 className="mt-5 font-display text-xl font-semibold">{c.title}</h2>
              <p className="mt-1 flex-1 text-[15px] text-muted">{c.text}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-[15px] font-semibold text-brand">
                {c.cta} <ChevronRight size={18} className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="rounded-[32px] bg-inverse p-6 text-white ring-1 ring-line sm:p-10">
        <div className="flex flex-col items-center gap-5 text-center">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Ready for the audience?</h2>
          <p className="max-w-lg text-white/65">Opens the full-screen live view. Admin controls are hidden from the audience. Press Space to spin.</p>
          <Button variant="primary" size="xl" icon={<MonitorPlay size={24} />} onClick={() => present(event.id)} className="w-full max-w-md">
            START PRESENTATION
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-muted">
        <Link to="/admin/events" className="hover:text-ink">All events & templates</Link>
        <Link to="/admin/setup" className="hover:text-ink">Quick setup (new event)</Link>
        <Link to="/admin/advanced" className="hover:text-ink">Advanced settings</Link>
      </div>
    </div>
  )
}
