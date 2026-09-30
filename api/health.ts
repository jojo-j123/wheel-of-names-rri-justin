import { del, put } from '@vercel/blob'
import { cloudConfigured, json } from './_lib/blobStore.js'

/**
 * GET /api/health — is cloud saving switched on?
 * GET /api/health?check=1 — full round trip: write a tiny probe file, read it back, delete it.
 */
export async function GET(request: Request): Promise<Response> {
  const cloud = cloudConfigured()
  if (!cloud || !new URL(request.url).searchParams.has('check')) return json({ ok: true, cloud, version: 1 })
  const started = Date.now()
  const steps: Record<string, string> = {}
  try {
    const probe = `probe/check-${started}.json`
    const r = await put(probe, JSON.stringify({ at: started }), { access: 'public', addRandomSuffix: true, contentType: 'application/json' })
    steps.write = 'ok'
    const back = await fetch(r.url, { cache: 'no-store' })
    const body = back.ok ? ((await back.json()) as { at?: number }) : null
    steps.read = body?.at === started ? 'ok' : `failed (${back.status})`
    await del(r.url)
    steps.delete = 'ok'
  } catch (e) {
    steps.error = e instanceof Error ? e.message : String(e)
  }
  const ok = steps.write === 'ok' && steps.read === 'ok' && steps.delete === 'ok'
  return json({ ok, cloud, steps, ms: Date.now() - started }, ok ? 200 : 502)
}
