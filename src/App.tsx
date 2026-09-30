import { lazy, useEffect, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { ConfirmDialogHost } from './components/common/ConfirmDialog'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ToastHost } from './components/common/Toast'
import { useApp } from './store/appStore'
import { EventScreen } from './pages/EventScreen'
import { PresentationPage } from './pages/Presentation'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminHome } from './pages/admin/AdminHome'

/** Admin sub-pages load on demand so the live stage starts as fast as possible. */
function page<K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => loader().then((m) => ({ default: m[name] })))
}
const EditEventPage = page(() => import('./pages/admin/EditEvent'), 'EditEventPage')
const ParticipantsPage = page(() => import('./pages/admin/Participants'), 'ParticipantsPage')
const PrizesPage = page(() => import('./pages/admin/Prizes'), 'PrizesPage')
const BrandingPage = page(() => import('./pages/admin/Branding'), 'BrandingPage')
const DrawSettingsPage = page(() => import('./pages/admin/DrawSettings'), 'DrawSettingsPage')
const WinnersPage = page(() => import('./pages/admin/Winners'), 'WinnersPage')
const AdvancedSettingsPage = page(() => import('./pages/admin/AdvancedSettings'), 'AdvancedSettingsPage')
const EventsPage = page(() => import('./pages/admin/Events'), 'EventsPage')
const SetupWizardPage = page(() => import('./pages/admin/SetupWizard'), 'SetupWizardPage')

/** Legacy/deep links like /events/:id/participants → select that event, open the matching admin page. */
function EventDeepLink({ section }: { section?: string }) {
  const { id } = useParams()
  const exists = useApp((s) => (id ? !!s.events[id] : false))
  const setActive = useApp((s) => s.setActiveEvent)
  useEffect(() => {
    if (id && exists) setActive(id)
  }, [id, exists, setActive])
  return <Navigate to={section ? `/admin/${section}` : '/admin'} replace />
}

function Loading() {
  return (
    <div className="grid h-dvh place-items-center bg-[#0e0b0b]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[#d0453a]" aria-label="Loading" />
    </div>
  )
}

export default function App() {
  const status = useApp((s) => s.status)
  useEffect(() => {
    void useApp.getState().init()
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        {status !== 'ready' ? (
          <Loading />
        ) : (
          <Routes>
            <Route path="/" element={<EventScreen />} />
            <Route path="/event/:eventId/present" element={<PresentationPage />} />
            <Route path="/events/:eventId/present" element={<PresentationPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminHome />} />
              <Route path="event" element={<EditEventPage />} />
              <Route path="participants" element={<ParticipantsPage />} />
              <Route path="prizes" element={<PrizesPage />} />
              <Route path="branding" element={<BrandingPage />} />
              <Route path="draw" element={<DrawSettingsPage />} />
              <Route path="winners" element={<WinnersPage />} />
              <Route path="advanced" element={<AdvancedSettingsPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="setup" element={<SetupWizardPage />} />
            </Route>
            <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="/events" element={<Navigate to="/admin/events" replace />} />
            <Route path="/events/:id" element={<EventDeepLink />} />
            <Route path="/events/:id/participants" element={<EventDeepLink section="participants" />} />
            <Route path="/events/:id/prizes" element={<EventDeepLink section="prizes" />} />
            <Route path="/events/:id/winners" element={<EventDeepLink section="winners" />} />
            <Route path="/events/:id/branding" element={<EventDeepLink section="branding" />} />
            <Route path="/events/:id/settings" element={<EventDeepLink section="draw" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
        <ErrorBoundary silent>
          <ToastHost />
        </ErrorBoundary>
        <ErrorBoundary silent>
          <ConfirmDialogHost />
        </ErrorBoundary>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
