import { useCallback, useEffect, useState } from 'react'

export function useFullscreen() {
  const [active, setActive] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement)
  useEffect(() => {
    const on = () => setActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const enter = useCallback(async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
    } catch {
      /* Browser refused (no user gesture / iframe) — presentation still works windowed. */
    }
  }, [])
  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch {
      /* ignore */
    }
  }, [])
  const toggle = useCallback(() => (document.fullscreenElement ? exit() : enter()), [enter, exit])
  return { active, enter, exit, toggle, supported: typeof document !== 'undefined' && !!document.fullscreenEnabled }
}
