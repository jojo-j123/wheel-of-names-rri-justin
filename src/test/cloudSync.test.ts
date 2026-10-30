/**
 * End-to-end cloud sync: real CloudSync engine + real Supabase adapter, with the Supabase project replaced by an
 * in-memory fake that applies the same rules as the SQL functions. Simulates several devices sharing one cloud.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventData, EventTemplate } from '../types'
import { createDemoEvent } from '../lib/event/demo'
import { addParticipants, recordWinner } from '../lib/event/operations'
import { CloudSync, type CloudHost, type CloudStatus } from '../lib/storage/cloudSync'
import { mergeConflict } from '../lib/storage/merge'
import { createSupabaseFetch } from '../lib/storage/supabaseBackend'
import { createFakeSupabase, FAKE_SUPABASE } from './fakeSupabase'

const fake = createFakeSupabase()
const serverFetch = () => createSupabaseFetch(FAKE_SUPABASE, 'test-anon-key', fake.net)
/** Same shape the old /api/state returned, read straight from the fake cloud. */
const state = { GET: async () => new Response(JSON.stringify(fake.cloudState())) }
const blobs = { keys: () => [...fake.images.keys()].map((k) => `images/${k}`) }
let cloudOff = false

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
    sync: new CloudSync(cloudOff ? createSupabaseFetch('', '', fake.net) : serverFetch()),
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
  vi.stubGlobal('fetch', fake.net) // the app's own cloud singleton talks to the fake too
  fake.reset()
  cloudOff = false
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cloud backend (Supabase adapter)', () => {
  const api = serverFetch()
  const put = (id: string, body: unknown, base?: number) =>
    api(`/api/events?id=${id}${base !== undefined ? `&base=${base}` : ''}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) })

  it('health reports the cloud is connected, and local-only without config', async () => {
    expect(await (await api('/api/health')).json()).toMatchObject({ ok: true, cloud: true })
    expect(await (await createSupabaseFetch('', '', fake.net)('/api/health')).json()).toMatchObject({ cloud: false })
  })

  it('rejects bad input', async () => {
    expect((await put('../etc', { id: '../etc', participants: [], updatedAt: 1 })).status).toBe(400)
    expect((await put('evt_abcdef', { id: 'evt_other', participants: [], updatedAt: 1 })).status).toBe(400)
    expect((await put('evt_abcdef', { id: 'evt_abcdef', updatedAt: 1 })).status).toBe(400)
    expect((await put('evt_abcdef', { id: 'evt_abcdef', participants: [], updatedAt: Date.now() + 1e10 })).status).toBe(400)
    expect((await put('evt_abcdef', 'x'.repeat(5 * 1024 * 1024))).status).toBe(413)
    const notImage = await api('/api/upload', { method: 'POST', headers: { 'content-type': 'text/html' }, body: new Blob(['<script>']) })
    expect(notImage.status).toBe(415)
  })

  it('refuses stale writes and keeps the newest version', async () => {
    const e = createDemoEvent()
    for (const t of [100, 200, 300, 400]) expect((await put(e.id, { ...e, updatedAt: t })).status).toBe(200)
    expect((await put(e.id, { ...e, updatedAt: 150 })).status).toBe(409)
    expect((await put(e.id, { ...e, updatedAt: 500 }, 300)).status).toBe(409) // someone else saved 400 since
    expect((await put(e.id, { ...e, updatedAt: 500 }, 400)).status).toBe(200)
    const s = (await (await state.GET()).json()) as { events: EventData[] }
    expect(s.events).toHaveLength(1)
    expect(s.events[0].updatedAt).toBe(500)
    expect(fake.history.filter((h) => h.id === e.id).length).toBeGreaterThan(0) // old versions kept as a safety net
  })

  it('polling is cheap: the full state is only downloaded when something changed', async () => {
    const e = createDemoEvent()
    await put(e.id, e)
    for (let i = 0; i < 5; i++) await api('/api/state')
    expect(fake.calls.filter((c) => c === 'wheel_state')).toHaveLength(1)
    await put(e.id, { ...e, updatedAt: e.updatedAt + 1 })
    await api('/api/state')
    expect(fake.calls.filter((c) => c === 'wheel_state')).toHaveLength(2)
  })

  it('stores images once (same bytes, same file) and returns a public URL', async () => {
    const png = await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).blob()
    const up = async () => (await (await api('/api/upload', { method: 'POST', headers: { 'content-type': 'image/png' }, body: png })).json()) as { url: string }
    const a = await up()
    const b = await up()
    expect(a.url).toBe(b.url)
    expect(a.url).toMatch(/^https:\/\/fake\.supabase\.test\/storage\/v1\/object\/public\/wheel-images\/[0-9a-f]{64}\.png$/)
    expect(fake.images.size).toBe(1)
    expect((await fake.net(a.url)).ok).toBe(true)
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
    expect(a.events.get(e.id)!.prizes[0].image).toMatch(/^https:\/\/fake\.supabase\.test\/storage\/v1\/object\/public\/wheel-images\//)
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
    fake.state.online = false
    a.edit(e.id, (x) => addParticipants(x, [{ name: 'Offline Add' }], { preventDuplicates: false }).event)
    await settle()
    expect(a.status).toBe('offline')
    expect(a.events.get(e.id)!.participants.some((p) => p.name === 'Offline Add')).toBe(true) // still on device
    fake.state.online = true
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

  it('edits made after the event was deleted elsewhere still reach the cloud (never stuck)', async () => {
    const e = createDemoEvent()
    const laptop = device([e])
    await start(laptop)
    await settle()
    // Another device deletes the event…
    const other = device()
    await start(other)
    other.events.delete(e.id)
    other.sync.deleteDoc('events', e.id)
    await settle()
    // …then the laptop keeps working on it (newer than the delete).
    await new Promise((r) => setTimeout(r, 5))
    laptop.edit(e.id, (x) => ({ ...addParticipants(x, [{ name: 'Saved Later' }], { preventDuplicates: false }).event, updatedAt: Date.now() }))
    for (let i = 0; i < 4; i++) {
      await settle()
      await laptop.sync.pullNow()
    }
    await settle()
    expect(laptop.status).toBe('synced')
    const cloud = ((await (await state.GET()).json()) as { events: EventData[] }).events.find((x) => x.id === e.id)
    expect(cloud?.participants.some((p) => p.name === 'Saved Later')).toBe(true)
    const fresh = device()
    await start(fresh)
    expect(fresh.events.get(e.id)?.participants.some((p) => p.name === 'Saved Later')).toBe(true)
  })

  it('a refused save is retried until it lands, so a device never silently stops syncing', { timeout: 15000 }, async () => {
    const e = createDemoEvent()
    const a = device([e])
    await start(a)
    await settle()
    const b = device()
    await start(b)
    // Both edit; one of them is refused as stale at first.
    a.edit(e.id, (x) => ({ ...addParticipants(x, [{ name: 'From A' }], { preventDuplicates: false }).event, updatedAt: Date.now() }))
    b.edit(e.id, (x) => ({ ...addParticipants(x, [{ name: 'From B' }], { preventDuplicates: false }).event, updatedAt: Date.now() + 1 }))
    for (let i = 0; i < 6; i++) {
      await settle()
      await a.sync.pullNow()
      await b.sync.pullNow()
    }
    // The merged change is pushed after the normal short delay; wait for it (up to 5 s).
    const has = (names: string[]) => names.includes('From A') && names.includes('From B')
    for (let i = 0; i < 50 && !has((fake.cloudState().events[0] as unknown as EventData).participants.map((p) => p.name)); i++) await new Promise((r) => setTimeout(r, 100))
    await a.sync.pullNow()
    await settle()
    const cloud = ((await (await state.GET()).json()) as { events: EventData[] }).events[0]
    expect(cloud.participants.map((p) => p.name)).toEqual(expect.arrayContaining(['From A', 'From B']))
    expect(a.events.get(e.id)!.participants.map((p) => p.name)).toEqual(expect.arrayContaining(['From A', 'From B']))
    expect(a.status).toBe('synced')
    expect(b.status).toBe('synced')
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
    cloudOff = true
    const a = device([createDemoEvent()])
    expect(await start(a)).toBe(false)
    expect(a.status).toBe('disabled')
  })
})

describe('demo removal', () => {
  it('the app deletes a sample-only demo from the cloud, rescues an edited one, keeps adopted events', async () => {
    const demo = createDemoEvent()
    const edited = addParticipants(createDemoEvent(), [{ name: 'Test Name' }], { preventDuplicates: false }).event
    const adopted = { ...createDemoEvent(), eventName: 'Our Real Gala', isDemo: false }
    const old = device([demo, edited, adopted])
    await start(old)
    await settle()
    const before = (await (await state.GET()).json()) as { events: EventData[] }
    expect(before.events.map((e) => e.id).sort()).toEqual([demo.id, edited.id, adopted.id].sort())

    // A phone opens the new version of the app with nothing stored locally.
    const { useApp, configureStorage } = await import('../store/appStore')
    const { createMemoryAdapter } = await import('../lib/storage/storage')
    configureStorage(createMemoryAdapter())
    useApp.setState({ status: 'loading', events: {}, activeEventId: null })
    await useApp.getState().init()
    await settle()

    const after = (await (await state.GET()).json()) as { events: EventData[]; deletedEvents: string[] }
    const keptId = `${edited.id}-kept`
    expect(after.events.map((e) => e.id).sort()).toEqual([adopted.id, keptId].sort())
    expect(after.events.find((e) => e.id === keptId)!.participants.some((p) => p.name === 'Test Name')).toBe(true)
    expect(Object.keys(useApp.getState().events).sort()).toEqual([adopted.id, keptId].sort())
  })
})

describe('second device opening the app', () => {
  it('a blank event left on this device never hides the real event from the cloud', async () => {
    const real = addParticipants({ ...createDemoEvent(), eventName: 'PWC', isDemo: false }, [{ name: 'Real Guest' }], { preventDuplicates: false }).event
    const laptop = device([real])
    await start(laptop)
    await settle()

    vi.resetModules() // a fresh app, as on a real page load (the cloud connection is one per page)
    const { useApp, configureStorage } = await import('../store/appStore')
    const { createMemoryAdapter } = await import('../lib/storage/storage')
    const { createStarterEvent } = await import('../lib/event/defaults')
    const mem = createMemoryAdapter()
    const blank = createStarterEvent()
    await mem.saveEvent(blank)
    await mem.setMeta('activeEventId', blank.id) // the old blank event was the one on screen
    configureStorage(mem)
    useApp.setState({ status: 'loading', events: {}, activeEventId: null })
    await useApp.getState().init()
    await settle()

    const s = useApp.getState()
    expect(s.activeEventId).toBe(real.id)
    expect(s.events[real.id].participants.some((p) => p.name === 'Real Guest')).toBe(true)
    expect(s.events[blank.id]).toBeUndefined()
  })
})

describe('cloud waking up slowly', () => {
  it('keeps trying to connect instead of staying offline until a refresh', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] })
    try {
      const e = createDemoEvent()
      const seed = device([e])
      await start(seed)
      await vi.advanceTimersByTimeAsync(2000)
      fake.state.online = false
      const late = device()
      const lateHost = (late as Device & { host: CloudHost }).host
      let connected = false
      late.sync.onLateStart = () => (connected = true)
      expect(await late.sync.start(lateHost)).toBe(false)
      expect(late.status).toBe('offline')
      fake.state.online = true
      await vi.advanceTimersByTimeAsync(11000)
      expect(connected).toBe(true)
      expect(late.events.has(e.id)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
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
