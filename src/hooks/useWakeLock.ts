import { useEffect } from 'react'

interface Sentinel {
  release(): Promise<void>
  addEventListener(type: 'release', cb: () => void): void
}

/**
 * Keeps the screen awake while the wheel is on show, so the projector never dims or sleeps mid-event.
 * The browser drops the lock when the tab is hidden, so it is re-requested whenever the page is visible again.
 * Unsupported browsers simply carry on without it.
 */
export function useWakeLock() {
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }).wakeLock
    if (!wl) return
    let sentinel: Sentinel | null = null
    let active = true
    const acquire = async () => {
      if (!active || sentinel || document.visibilityState !== 'visible') return
      try {
        const s = await wl.request('screen')
        if (!active) return void s.release().catch(() => undefined)
        sentinel = s
        s.addEventListener('release', () => {
          if (sentinel === s) sentinel = null
        })
      } catch {
        /* denied (battery saver, iframe policy) — nothing else to do */
      }
    }
    const onVisible = () => void acquire()
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    // Some browsers refuse the lock until the first tap; try again on the first interaction.
    window.addEventListener('pointerdown', onVisible, { once: true })
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pointerdown', onVisible)
      void sentinel?.release().catch(() => undefined)
      sentinel = null
    }
  }, [])
}
