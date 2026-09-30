/**
 * Sends crash details (never event/participant data) to /api/log so they show up in Vercel runtime logs.
 * Rate-limited and fire-and-forget: reporting must never cause problems of its own.
 */
let sent = 0

export function reportError(error: unknown, context: string, componentStack?: string | null) {
  try {
    if (sent >= 5) return
    sent++
    const e = error instanceof Error ? error : new Error(String(error))
    const body = JSON.stringify({
      context,
      message: e.message.slice(0, 500),
      stack: (e.stack ?? '').slice(0, 2000),
      componentStack: (componentStack ?? '').slice(0, 2000),
      path: location.pathname,
      userAgent: navigator.userAgent,
      translated: document.documentElement.classList.contains('translated-ltr') || document.documentElement.classList.contains('translated-rtl'),
      at: new Date().toISOString(),
    })
    if (navigator.sendBeacon?.(new URL('/api/log', location.href), new Blob([body], { type: 'application/json' }))) return
    void fetch('/api/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined)
  } catch {
    /* never throw from the reporter */
  }
}

const RELOAD_KEY = 'rri-chunk-reload'

/** After a new deploy, an open tab may request files that no longer exist — reload once to pick up the new version. */
export function installStaleChunkRecovery() {
  const recover = () => {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
      if (Date.now() - last < 30_000) return false // avoid reload loops
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    } catch {
      /* storage blocked — still try once */
    }
    location.reload()
    return true
  }
  window.addEventListener('vite:preloadError', (ev) => {
    ev.preventDefault()
    recover()
  })
  window.addEventListener('unhandledrejection', (ev) => {
    const msg = String((ev.reason as Error)?.message ?? ev.reason ?? '')
    if (/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(msg)) recover()
  })
}

export function isChunkLoadError(error: unknown): boolean {
  return /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch/i.test(String((error as Error)?.message ?? error))
}
