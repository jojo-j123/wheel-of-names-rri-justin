/**
 * In-memory stand-in for the Supabase project used in tests: the four wheel_* RPCs (same rules as
 * supabase/migrations/*.sql) and the public image bucket.
 */
export const FAKE_SUPABASE = 'https://fake.supabase.test'

type Kind = 'events' | 'templates'
const ID_RE = /^[A-Za-z0-9_-]{6,100}$/

export function createFakeSupabase() {
  const docs = new Map<string, { kind: Kind; id: string; doc: Record<string, unknown>; stamp: number; seq: number }>()
  const tombs = new Map<string, { kind: Kind; id: string; deletedAt: number; seq: number }>()
  const history: { kind: Kind; id: string; stamp: number; reason: string }[] = []
  const images = new Map<string, { bytes: Uint8Array; type: string }>()
  let seq = 0
  const calls: string[] = []
  const state = { online: true }
  const realFetch = globalThis.fetch

  const version = () => Math.max(0, ...[...docs.values()].map((d) => d.seq), ...[...tombs.values()].map((t) => t.seq))

  function save(kind: Kind, id: string, doc: Record<string, unknown>, base: number | null) {
    if (!['events', 'templates'].includes(kind) || !ID_RE.test(id)) return { ok: false, status: 400, error: 'invalid id' }
    if (JSON.stringify(doc).length > 4 * 1024 * 1024) return { ok: false, status: 413, error: 'too large' }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc) || doc.id !== id) return { ok: false, status: 400, error: 'invalid document' }
    if (kind === 'events' && !Array.isArray(doc.participants)) return { ok: false, status: 400, error: 'invalid event' }
    const stamp = Math.floor(Number(doc[kind === 'events' ? 'updatedAt' : 'createdAt']))
    if (!Number.isFinite(stamp) || stamp <= 0 || stamp > Date.now() + 86400000) return { ok: false, status: 400, error: 'invalid timestamp' }
    const key = `${kind}:${id}`
    const tomb = tombs.get(key)
    if (tomb && tomb.deletedAt >= stamp) return { ok: false, status: 409, reason: 'deleted' }
    const cur = docs.get(key)
    if (cur && cur.stamp === stamp) return { ok: true, stamp }
    if (base !== null && (cur?.stamp ?? 0) !== base) return { ok: false, status: 409, reason: 'stale', newerStamp: cur?.stamp ?? null }
    if (cur && cur.stamp > stamp) return { ok: false, status: 409, reason: 'stale', newerStamp: cur.stamp }
    if (cur) history.push({ kind, id, stamp: cur.stamp, reason: 'replaced' })
    docs.set(key, { kind, id, doc: structuredClone(doc), stamp, seq: ++seq })
    return { ok: true, stamp }
  }

  function del(kind: Kind, id: string, at: number | null) {
    if (!['events', 'templates'].includes(kind) || !ID_RE.test(id)) return { ok: false, status: 400, error: 'invalid id' }
    const key = `${kind}:${id}`
    const when = at && at > 0 ? at : Date.now()
    tombs.set(key, { kind, id, deletedAt: Math.max(tombs.get(key)?.deletedAt ?? 0, when), seq: ++seq })
    const cur = docs.get(key)
    if (cur) {
      history.push({ kind, id, stamp: cur.stamp, reason: 'deleted' })
      docs.delete(key)
    }
    return { ok: true }
  }

  function wheelState() {
    const of = (k: Kind) => [...docs.values()].filter((d) => d.kind === k).sort((a, b) => a.id.localeCompare(b.id)).map((d) => structuredClone(d.doc))
    const dead = (k: Kind) => [...tombs.values()].filter((t) => t.kind === k).map((t) => ({ id: t.id, deletedAt: t.deletedAt }))
    return { events: of('events'), deletedEvents: dead('events'), templates: of('templates'), deletedTemplates: dead('templates'), serverTime: Date.now(), version: version() }
  }

  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } })

  const net: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith('data:')) return realFetch(url)
    if (!url.startsWith(FAKE_SUPABASE)) throw new TypeError('Failed to fetch')
    if (!state.online) throw new TypeError('Failed to fetch')
    const path = url.slice(FAKE_SUPABASE.length)
    const key = new Headers(init?.headers).get('apikey')
    if (!key && !path.startsWith('/storage/v1/object/public/')) return json({ message: 'No API key found in request' }, 401)
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.slice('/rest/v1/rpc/'.length)
      calls.push(fn)
      const a = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      if (fn === 'wheel_version') return json(version())
      if (fn === 'wheel_state') return json(wheelState())
      if (fn === 'wheel_save') return json(save(a.p_kind as Kind, String(a.p_id), a.p_doc as Record<string, unknown>, (a.p_base as number | null) ?? null))
      if (fn === 'wheel_delete') return json(del(a.p_kind as Kind, String(a.p_id), (a.p_at as number | null) ?? null))
      return json({ message: 'function not found' }, 404)
    }
    const up = /^\/storage\/v1\/object\/wheel-images\/(.+)$/.exec(path)
    if (up && (init?.method ?? 'GET').toUpperCase() === 'POST') {
      calls.push('upload')
      const name = up[1]
      const type = new Headers(init?.headers).get('content-type') ?? ''
      const bytes = new Uint8Array(await new Response(init?.body).arrayBuffer())
      if (!/^[0-9a-f]{64}\.(jpg|png|webp|svg)$/.test(name)) return json({ statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }, 400)
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(type)) return json({ statusCode: '415', error: 'invalid_mime_type' }, 400)
      if (bytes.length > 10 * 1024 * 1024) return json({ statusCode: '413', error: 'Payload too large' }, 413)
      if (images.has(name)) return json({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }, 400)
      images.set(name, { bytes, type })
      return json({ Key: `wheel-images/${name}` })
    }
    const pub = /^\/storage\/v1\/object\/public\/wheel-images\/(.+)$/.exec(path)
    if (pub) {
      const img = images.get(pub[1])
      return img ? new Response(img.bytes.slice().buffer as ArrayBuffer, { headers: { "content-type": img.type } }) : new Response('not found', { status: 400 })
    }
    return json({ message: 'not found' }, 404)
  }

  return {
    net,
    state,
    calls,
    images,
    history,
    cloudState: wheelState,
    rpcSave: save,
    reset() {
      docs.clear()
      tombs.clear()
      images.clear()
      history.length = 0
      calls.length = 0
      seq = 0
      state.online = true
    },
  }
}
