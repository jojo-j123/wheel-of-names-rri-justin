/**
 * End-to-end cloud sync: real /api handlers + real CloudSync engine, with Vercel Blob replaced by
 * an in-memory fake. Simulates several devices talking to the same cloud.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventData, EventTemplate } from '../types'
import { createDemoEvent } from '../lib/event/demo'
import { addParticipants, recordWinner } from '../lib/event/operations'
import { CloudSync, type CloudHost, type CloudStatus } from '../lib/storage/cloudSync'
import { mergeConflict } from '../lib/storage/merge'

/* ------------------------------------------------------------- fake Vercel Blob */

const blobs = new Map<string, { body: string | Blob; uploadedAt: Date; contentType: string }>()
let seq = 0
const BASE = 'https://fake.blob.test/'

vi.mock('@vercel/blob', () => ({
  put: async (pathname: string, body: string | Blob, opts: { addRandomSuffix?: boolean; contentType?: string }) => {
    let p = pathname
    if (opts.addRandomSuffix) {
      const dot = p.lastIndexOf('.')
      p = `${p.slice(0, dot)}-${(++seq).toString(36).padStart(6, 'x')}${p.slice(dot)}`
    }
    blobs.set(p, { body, uploadedAt: new Date(Date.now() + seq), contentType: opts.contentType ?? '' })
    return { url: BASE + p, pathname: p }
  },
  list: async ({ prefix = '' }: { prefix?: string }) => ({
    blobs: [...blobs.entries()].filter(([p]) => p.startsWith(prefix)).map(([p, b]) => ({ url: BASE + p, pathname: p, uploadedAt: b.uploadedAt })),
    hasMore: false,
  }),
  del: async (urls: string | string[]) => {
    for (const u of [urls].flat()) blobs.delete(u.replace(BASE, ''))
  },
}))

const events = await import('../../api/events')
const templates = await import('../../api/templates')
const state = await import('../../api/state')
const upload = await import('../../api/upload')
const health = await import('../../api/health')

let online = true
const realFetch = globalThis.fetch

/** Routes /api/* to the real handlers and blob URLs to the fake store. */
const serverFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith(BASE)) {
    const b = blobs.get(url.slice(BASE.length))
    return b ? new Response(b.body) : new Response('missing', { status: 404 })
  }
  if (url.startsWith('data:')) return realFetch(url)
  if (!online) throw new TypeError('Failed to fetch')
  const req = new Request('https://app.test' + url, init)
  const path = new URL(req.url).pathname
  const m = req.method
  if (path === '/api/health') return health.GET(req)
  if (path === '/api/state') return state.GET()
  if (path === '/api/upload' && m === 'POST') return upload.POST(req)
  if (path === '/api/events') return m === 'PUT' ? events.PUT(req) : events.DELETE(req)
  if (path === '/api/templates') return m === 'PUT' ? templates.PUT(req) : templates.DELETE(req)
  return new Response('not found', { status: 404 })
}

/* ------------------------------------------------------------- fake devices */

interface Device {
  sync: CloudSync
  events: Map<string, EventData>
  templates: Map<string, EventTemplate>
  status: CloudStatus
  busy: boolean
  edit(id: string, fn: (e: EventData) => EventData): void
}

function device(initial: EventData[] = []): Device {
  const meta = new Map<string, unknown>()
  const d: Device = {
    sync: new CloudSync(serverFetch),
    events: new Map(initial.map((e) => [e.id, e])),
    templates: new Map(),
    status: 'connecting',
    busy: false,
    edit(id, fn) {
      d.events.set(id, fn(d.events.get(id)!))
      d.sync.queueEvent(id, 0)
    },
  }
  const host: CloudHost = {
    getEvent: (id) => d.events.get(id),
    allEvents: () => [...d.events.values()],
    getTemplate: (id) => d.templates.get(id),
    allTemplates: () => [...d.templates.values()],
    applyEvents: (l) => l.forEach((e) => d.events.set(e.id, e)),
    removeEvents: (ids) => ids.forEach((id) => d.events.delete(id)),
    applyTemplates: (l) => l.forEach((t) => d.templates.set(t.id, t)),
    removeTemplates: (ids) => ids.forEach((id) => d.templates.delete(id)),
    replaceImages: (id, map) => {
      const e = d.events.get(id)!
      d.events.set(id, { ...e, prizes: e.prizes.map((p) => ({ ...p, image: (p.image && map.get(p.image)) || p.image })) })
    },
    setStatus: (s) => (d.status = s),
    getMeta: async <T,>(k: string) => meta.get(k) as T | undefined,
    setMeta: async (k, v) => void meta.set(k, structuredClone(v)),
    isBusy: () => d.busy,
  }
  ;(d as Device & { host: CloudHost }).host = host
  return d
}
const start = (d: Device) => d.sync.start((d as Device & { host: CloudHost }).host)
/** Let queued pushes (setTimeout 0 + async fetches) finish. */
const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 5))
}

beforeEach(() => {
  vi.stubGlobal('fetch', serverFetch) // server-side reads of blob URLs go to the fake store
  blobs.clear()
  online = true
  process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.BLOB_READ_WRITE_TOKEN
})

describe('cloud API', () => {
  it('health reports whether the Blob store is connected', async () => {
    expect(await (await health.GET(new Request('https://x/api/health'))).json()).toMatchObject({ cloud: true })
    const check = await (await health.GET(new Request('https://x/api/health?check=1'))).json()
    expect(check).toMatchObject({ ok: true, steps: { write: 'ok', read: 'ok', delete: 'ok' } })
    expect([...blobs.keys()].filter((k) => k.startsWith('probe/'))).toHaveLength(0)
    delete process.env.BLOB_READ_WRITE_TOKEN
    expect(await (await health.GET(new Request('https://x/api/health'))).json()).toMatchObject({ cloud: false })
  })

  it('rejects bad input (open API guards)', async () => {
    const bad = (body: unknown, id = 'evt_abcdef') =>
      events.PUT(new Request(`https://x/api/events?id=${id}`, { method: 'PUT', body: JSON.stringify(body) }))
    expect((await bad({}, '../etc')).status).toBe(400)
    expect((await bad({ id: 'evt_other', participants: [], updatedAt: 1 })).status).toBe(400)
    expect((await bad({ id: 'evt_abcdef', updatedAt: 1 })).status).toBe(400)
    expect((await bad({ id: 'evt_abcdef', participants: [], updatedAt: Date.now() + 1e10 })).status).toBe(400)
    const huge = await events.PUT(new Request('https://x/api/events?id=evt_abcdef', { method: 'PUT', body: 'x'.repeat(5 * 1024 * 1024) }))
    expect(huge.status).toBe(413)
    const notImage = await upload.POST(new Request('https://x/api/upload', { method: 'POST', headers: { 'content-type': 'text/html' }, body: '<script>' }))
    expect(notImage.status).toBe(415)
  })

  it('keeps only the newest versions and refuses stale writes', async () => {
    const e = createDemoEvent()
    const put = (updatedAt: number) =>
      events.PUT(new Request(`https://x/api/events?id=${e.id}`, { method: 'PUT', body: JSON.stringify({ ...e, updatedAt }) }))
    for (const t of [100, 200, 300, 400]) expect((await put(t)).status).toBe(200)
    expect([...blobs.keys()].filter((k) => k.startsWith(`events/${e.id}/`))).toHaveLength(3)
    expect((await put(150)).status).toBe(409)
    const s = (await (await state.GET()).json()) as { events: EventData[] }
    expect(s.events).toHaveLength(1)
    expect(s.events[0].updatedAt).toBe(400)
  })
})

describe('multi-device sync', () => {
  it('an event created on the stage laptop appears on a second device', async () => {
    const laptop = device([createDemoEvent()])
    const id = [...laptop.events.keys()][0]
    laptop.edit(id, (e) => addParticipants(e, [{ name: 'Cloud Person' }], { preventDuplicates: false }).event)
    await start(laptop)
    await settle()
    expect(laptop.status).toBe('synced')

    const phone = device()
    await start(phone)
    expect(phone.events.get(id)?.participants.some((p) => p.name === 'Cloud Person')).toBe(true)
  })

  it('prize images are uploaded once and referenced by URL', async () => {
    const e = createDemoEvent()
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    e.prizes[0] = { ...e.prizes[0], image: png }
    e.prizes[1] = { ...e.prizes[1], image: png }
    const a = device([e])
    await start(a)
    await settle()
    const images = [...blobs.keys()].filter((k) => k.startsWith('images/'))
    expect(images).toHaveLength(1) // deduplicated
    expect(a.events.get(e.id)!.prizes[0].image).toMatch(/^https:\/\/fake\.blob\.test\/images\//)
    const stored = JSON.stringify((await (await state.GET()).json()))
    expect(stored).not.toContain('data:image')
  })

  it('a winner recorded on stage survives a simultaneous edit on another device', async () => {
    const base = createDemoEvent()
    const stage = device([base])
    await start(stage)
    await settle()
    const phone = device()
    await start(phone)

    // Both edit at "the same time": stage records a winner, phone adds a participant.
    stage.edit(base.id, (e) => recordWinner(e, { participant: e.participants[0], prize: e.prizes[0], mode: 'dramatic', removeFromPool: true }).event)
    await new Promise((r) => setTimeout(r, 3))
    phone.events.set(base.id, addParticipants(phone.events.get(base.id)!, [{ name: 'Late Arrival' }], { preventDuplicates: false }).event)
    phone.sync.queueEvent(base.id, 0)
    await settle()
    await stage.sync.pullNow()
    await phone.sync.pullNow()
    await settle()
    await stage.sync.pullNow()

    const cloud = ((await (await state.GET()).json()) as { events: EventData[] }).events[0]
    expect(cloud.winnerHistory).toHaveLength(1)
    expect(stage.events.get(base.id)!.winnerHistory).toHaveLength(1)
    expect(phone.events.get(base.id)!.winnerHistory).toHaveLength(1)
  })

  it('works offline and catches up when the connection returns', async () => {
    const e = createDemoEvent()
    const a = device([e])
    await start(a)
    await settle()
    online = false
    a.edit(e.id, (x) => addParticipants(x, [{ name: 'Offline Add' }], { preventDuplicates: false }).event)
    await settle()
    expect(a.status).toBe('offline')
    expect(a.events.get(e.id)!.participants.some((p) => p.name === 'Offline Add')).toBe(true) // still on device
    online = true
    a.sync.queueEvent(e.id, 0)
    await settle()
    const cloud = ((await (await state.GET()).json()) as { events: EventData[] }).events[0]
    expect(cloud.participants.some((p) => p.name === 'Offline Add')).toBe(true)
  })

  it('deletions propagate and are not resurrected', async () => {
    const e = createDemoEvent()
    const a = device([e])
    await start(a)
    await settle()
    const b = device()
    await start(b)
    expect(b.events.has(e.id)).toBe(true)
    a.events.delete(e.id)
    a.sync.deleteDoc('events', e.id)
    await settle()
    await b.sync.pullNow()
    expect(b.events.has(e.id)).toBe(false)
    const c = device()
    await start(c)
    expect(c.events.has(e.id)).toBe(false)
  })

  it('does not swap data under a spinning wheel', async () => {
    const e = createDemoEvent()
    const a = device([e])
    await start(a)
    await settle()
    const b = device()
    await start(b)
    a.edit(e.id, (x) => addParticipants(x, [{ name: 'During Spin' }], { preventDuplicates: false }).event)
    await settle()
    b.busy = true
    await b.sync.pullNow()
    expect(b.events.get(e.id)!.participants.some((p) => p.name === 'During Spin')).toBe(false)
    b.busy = false
    await b.sync.pullNow()
    expect(b.events.get(e.id)!.participants.some((p) => p.name === 'During Spin')).toBe(true)
  })

  it('runs local-only when the cloud is not connected', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    const a = device([createDemoEvent()])
    expect(await start(a)).toBe(false)
    expect(a.status).toBe('disabled')
  })
})

describe('mergeConflict', () => {
  it('keeps newer fields but unions winners and renumbers draws', () => {
    const base = createDemoEvent()
    const a = recordWinner(base, { participant: base.participants[0], prize: null, mode: 'standard', removeFromPool: true }).event
    const b = { ...recordWinner({ ...base, eventName: 'Renamed' }, { participant: base.participants[1], prize: null, mode: 'standard', removeFromPool: true }).event, updatedAt: a.updatedAt + 10 }
    const m = mergeConflict(b, a)
    expect(m.eventName).toBe('Renamed')
    expect(m.winnerHistory).toHaveLength(2)
    expect(m.winnerHistory.map((w) => w.drawNumber)).toEqual([1, 2])
    expect(m.updatedAt).toBeGreaterThan(b.updatedAt)
  })
})
