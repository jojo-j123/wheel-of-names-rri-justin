import { json } from './_lib/http.js'

// Same public project the app uses (src/lib/storage/supabaseBackend.ts).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cytjcknwgwpbvidrkagj.supabase.co'
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dGpja253Z3dwYnZpZHJrYWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMzQzNTIsImV4cCI6MjEwODcxMDM1Mn0.O6PsxiFV1nZc1I-zo99ajIQMCDZCO-RZ4lgPMxSLnLA'

/** GET /api/health — can the cloud (Supabase) be reached and read? Open it in a browser to diagnose sync. */
export async function GET(): Promise<Response> {
  const started = Date.now()
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wheel_state`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'content-type': 'application/json' },
      body: '{}',
    })
    if (!r.ok) return json({ ok: false, cloud: 'supabase', error: `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`, ms: Date.now() - started }, 502)
    const s = (await r.json()) as { events?: unknown[]; templates?: unknown[] }
    return json({ ok: true, cloud: 'supabase', events: s.events?.length ?? 0, templates: s.templates?.length ?? 0, ms: Date.now() - started })
  } catch (e) {
    return json({ ok: false, cloud: 'supabase', error: e instanceof Error ? e.message : String(e), ms: Date.now() - started }, 502)
  }
}
