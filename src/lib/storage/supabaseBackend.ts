/**
 * Cloud backend on Supabase (Postgres + Storage).
 *
 * The sync engine (cloudSync.ts) speaks a tiny REST dialect: /api/health, /api/state, /api/events, /api/templates,
 * /api/upload. This module answers those calls from Supabase, so the engine and its conflict rules stay unchanged.
 * The database side lives in supabase/migrations/*.sql; the browser may only call its four functions.
 *
 * Polling is cheap: each poll asks for a single change counter and downloads the full state only when it moved.
 */

// Public by design: the anon key only allows calling the four wheel_* functions and uploading images.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://cytjcknwgwpbvidrkagj.supabase.co'
export const SUPABASE_ANON_KEY: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dGpja253Z3dwYnZpZHJrYWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMzQzNTIsImV4cCI6MjEwODcxMDM1Mn0.O6PsxiFV1nZc1I-zo99ajIQMCDZCO-RZ4lgPMxSLnLA'

const BUCKET = 'wheel-images'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

export function publicImageUrl(base: string, path: string) {
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * A fetch() that serves the sync engine's /api/* calls from Supabase. Anything else goes to the real network.
 * `net` is the underlying fetch (swapped for a fake in tests).
 */
export function createSupabaseFetch(base = SUPABASE_URL, key = SUPABASE_ANON_KEY, net: typeof fetch = (...a) => fetch(...a)): typeof fetch {
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  let cache: { version: number; body: string } | null = null

  async function rpc<T>(fn: string, args: Record<string, unknown>, signal?: AbortSignal | null): Promise<T> {
    const r = await net(`${base}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(args),
      signal: signal ?? undefined,
      cache: 'no-store',
    })
    if (!r.ok) throw new Error(`supabase ${fn} ${r.status}`)
    return (await r.json()) as T
  }

  /** Map a wheel_save/wheel_delete result to the HTTP status the engine expects. */
  const toResponse = (res: { ok: boolean; status?: number; [k: string]: unknown }) => json(res, res.ok ? 200 : (res.status ?? 400))

  return async (input, init) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!raw.startsWith('/api/') || raw.startsWith('/api/log')) return net(input, init)
    const url = new URL(raw, 'http://local')
    const method = (init?.method ?? 'GET').toUpperCase()
    const signal = init?.signal
    const id = url.searchParams.get('id') ?? ''
    try {
      switch (url.pathname) {
        case '/api/health': {
          if (!base || !key) return json({ ok: true, cloud: false })
          await rpc<number>('wheel_version', {}, signal)
          return json({ ok: true, cloud: true, backend: 'supabase' })
        }
        case '/api/state': {
          const version = Number(await rpc<number>('wheel_version', {}, signal))
          if (!cache || cache.version !== version) {
            const state = await rpc<Record<string, unknown>>('wheel_state', {}, signal)
            cache = { version: Number(state.version ?? version), body: JSON.stringify(state) }
          }
          return new Response(cache.body, { status: 200, headers: { 'content-type': 'application/json' } })
        }
        case '/api/events':
        case '/api/templates': {
          const kind = url.pathname === '/api/events' ? 'events' : 'templates'
          if (method === 'DELETE') {
            const at = Number(url.searchParams.get('at'))
            return toResponse(await rpc('wheel_delete', { p_kind: kind, p_id: id, p_at: Number.isFinite(at) && at > 0 ? Math.floor(at) : null }, signal))
          }
          const text = typeof init?.body === 'string' ? init.body : await new Response(init?.body).text()
          if (text.length > 4 * 1024 * 1024) return json({ error: 'too large' }, 413)
          let doc: unknown
          try {
            doc = JSON.parse(text)
          } catch {
            return json({ error: 'invalid json' }, 400)
          }
          const baseRaw = url.searchParams.get('base')
          const baseStamp = baseRaw !== null && /^\d+$/.test(baseRaw) ? Number(baseRaw) : null
          return toResponse(await rpc('wheel_save', { p_kind: kind, p_id: id, p_doc: doc, p_base: kind === 'events' ? baseStamp : null }, signal))
        }
        case '/api/upload': {
          const body = init?.body
          const blob = body instanceof Blob ? body : new Blob([body as BlobPart])
          const type = (new Headers(init?.headers).get('content-type') ?? blob.type).split(';')[0].trim().toLowerCase()
          const ext = IMAGE_EXT[type]
          if (!ext) return json({ error: 'unsupported image type' }, 415)
          if (!blob.size || blob.size > MAX_IMAGE_BYTES) return json({ error: 'image too large or empty' }, 413)
          const buf = await blob.arrayBuffer()
          const path = `${await sha256Hex(buf)}.${ext}`
          const r = await net(`${base}/storage/v1/object/${BUCKET}/${path}`, {
            method: 'POST',
            headers: { ...headers, 'content-type': type, 'cache-control': 'max-age=31536000', 'x-upsert': 'false' },
            body: buf,
            signal: signal ?? undefined,
          })
          // Same bytes → same name: "already exists" means the image is already in the cloud.
          if (!r.ok) {
            const text = await r.text().catch(() => '')
            if (!(r.status === 409 || /exists|duplicate/i.test(text))) return json({ error: 'upload failed' }, r.status >= 500 ? 502 : r.status)
          }
          return json({ url: publicImageUrl(base, path) })
        }
        default:
          return json({ error: 'not found' }, 404)
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e
      // Network down or Supabase unreachable: let the engine retry like any failed request.
      throw e instanceof Error ? e : new Error(String(e))
    }
  }
}
