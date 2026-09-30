import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Stage } from '../components/stage/Stage'
import { useApp, useEventById } from '../store/appStore'

/** /event/:eventId/present — audience view. No admin UI, no private data. */
export function PresentationPage() {
  const { eventId } = useParams()
  const event = useEventById(eventId)
  const navigate = useNavigate()
  const setActive = useApp((s) => s.setActiveEvent)
  useEffect(() => {
    if (event) setActive(event.id)
    document.title = event ? `${event.eventName} — Live` : 'RRI Event Wheel'
    return () => {
      document.title = 'RRI Event Wheel'
    }
  }, [event?.id, event?.eventName, setActive, event])
  if (!event) return <Navigate to="/" replace />
  const exit = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    navigate('/')
  }
  return <Stage key={event.id} event={event} mode="presentation" onExitPresentation={exit} />
}
