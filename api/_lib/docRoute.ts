import { cloudConfigured, deleteDoc, ID_RE, json, MAX_JSON_BYTES, readBody, saveDoc, type Kind } from './blobStore.js'

/** Shared PUT/DELETE handlers for /api/events and /api/templates (?id=…). */
export function docRoutes(kind: Kind, stampField: 'updatedAt' | 'createdAt') {
  async function PUT(request: Request): Promise<Response> {
    if (!cloudConfigured()) return json({ error: 'cloud storage not connected' }, 503)
    const params = new URL(request.url).searchParams
    const id = params.get('id') ?? ''
    if (!ID_RE.test(id)) return json({ error: 'invalid id' }, 400)
    const baseRaw = params.get('base')
    const base = baseRaw !== null && /^\d+$/.test(baseRaw) ? Number(baseRaw) : undefined
    const buf = await readBody(request, MAX_JSON_BYTES)
    if (!buf) return json({ error: 'too large' }, 413)
    let doc: Record<string, unknown>
    try {
      doc = JSON.parse(new TextDecoder().decode(buf))
    } catch {
      return json({ error: 'invalid json' }, 400)
    }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc) || doc.id !== id) return json({ error: 'invalid document' }, 400)
    if (kind === 'events' && !Array.isArray(doc.participants)) return json({ error: 'invalid event' }, 400)
    const stamp = Number(doc[stampField])
    if (!Number.isFinite(stamp) || stamp <= 0 || stamp > Date.now() + 24 * 3600 * 1000) return json({ error: 'invalid timestamp' }, 400)
    try {
      const r = await saveDoc(kind, id, Math.floor(stamp), JSON.stringify(doc), base)
      return r.ok ? json({ ok: true, stamp: r.stamp }) : json({ ok: false, reason: r.reason, newerStamp: r.newerStamp }, 409)
    } catch (e) {
      console.error(`${kind} save failed`, e)
      return json({ error: 'cloud write failed' }, 502)
    }
  }

  async function DELETE(request: Request): Promise<Response> {
    if (!cloudConfigured()) return json({ error: 'cloud storage not connected' }, 503)
    const url = new URL(request.url)
    const id = url.searchParams.get('id') ?? ''
    if (!ID_RE.test(id)) return json({ error: 'invalid id' }, 400)
    const at = Number(url.searchParams.get('at'))
    try {
      await deleteDoc(kind, id, Number.isFinite(at) && at > 0 ? Math.floor(at) : Date.now())
      return json({ ok: true })
    } catch (e) {
      console.error(`${kind} delete failed`, e)
      return json({ error: 'cloud delete failed' }, 502)
    }
  }

  return { PUT, DELETE }
}
