import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { sound } from '../lib/audio/soundEngine'
import { useApp } from '../store/appStore'

/** "Start presentation": unlock audio + enter fullscreen inside the click, then open the live route. */
export function usePresent() {
  const navigate = useNavigate()
  return useCallback(
    (eventId?: string) => {
      const s = useApp.getState()
      const id = eventId ?? s.activeEventId
      if (!id) return
      const ev = s.events[id]
      sound.unlock()
      if (ev?.animationSettings.autoFullscreen && !document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => undefined)
      }
      navigate(`/event/${id}/present`)
    },
    [navigate],
  )
}
