import { ArrowLeft, MonitorPlay } from 'lucide-react'
import { Suspense, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { BrandLogo } from '../../components/branding/BrandLogo'
import { Button } from '../../components/common/Button'
import { ErrorBoundary } from '../../components/common/ErrorBoundary'
import { usePresent } from '../../hooks/usePresent'
import { brandCssVars } from '../../lib/branding'
import { useActiveEvent } from '../../store/appStore'

/** Simple admin shell: logo, event name, Back to event, Start presentation. No sidebar maze. */
export function AdminLayout() {
  const event = useActiveEvent()
  const present = usePresent()
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  if (!event) return null
  const b = event.branding
  return (
    <div className="min-h-dvh bg-paper" style={brandCssVars(b) as React.CSSProperties}>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/admin" className="flex min-w-0 items-center gap-3 rounded-xl">
            <BrandLogo logo={b.logo} companyName={b.companyName} variant="badge" className="h-11 w-11 shrink-0 ring-1 ring-line" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">Admin</p>
              <p className="truncate font-display text-[15px] font-semibold">{event.eventName}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/" className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-[15px] font-semibold text-ink-soft transition hover:bg-ink/5">
              <ArrowLeft size={18} /> <span className="hidden sm:inline">Back to event</span>
            </Link>
            <Button variant="primary" icon={<MonitorPlay size={18} />} onClick={() => present(event.id)}>
              <span className="hidden sm:inline">Start presentation</span>
              <span className="sm:hidden">Present</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        <ErrorBoundary label="this page">
          <Suspense fallback={<div className="grid h-64 place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" aria-label="Loading" /></div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}
