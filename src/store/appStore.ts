import { create } from 'zustand'
import type { EventData, EventTemplate } from '../types'
import { createDemoEvent } from '../lib/event/demo'
import { sanitizeEvent, sanitizeTemplate } from '../lib/event/sanitize'
import { createBestAdapter, isQuotaError, type StorageAdapter } from '../lib/storage/storage'
import { toast } from './toastStore'
import { cloud, type CloudHost, type CloudStatus } from '../lib/storage/cloudSync'
import { useDraw } from './drawStore'

/** `offline`: storage unavailable this session (blocked or failed to load) — changes are not being saved. */
export type SaveStatus = 'saved' | 'saving' | 'error' | 'offline'

interface AppState {
  status: 'loading' | 'ready'
  persistent: boolean
  /** Live save indicator for operators. */
  saveStatus: SaveStatus
  /** Cloud (Vercel) sync state. `disabled` = cloud not connected, running on this device only. */
  cloudStatus: CloudStatus
  events: Record<string, EventData>
  templates: EventTemplate[]
  activeEventId: string | null
  init(): Promise<void>
  setActiveEvent(id: string): void
  /** Apply a pure update to one event and persist it immediately. */
  mutateEvent(id: string, fn: (e: EventData) => EventData, opts?: { immediate?: boolean }): EventData | null
  addEvent(e: EventData, activate?: boolean): void
  deleteEvent(id: string): void
  saveTemplate(t: EventTemplate): void
  deleteTemplate(id: string): void
  flush(): Promise<void>
}

let adapter: StorageAdapter | null = null
/**
 * Write-through persistence with per-event coalescing: every change is written immediately
 * (so a refresh right after an import can't lose it); if a write is already in flight, only the
 * latest version is written once it finishes.
 */
const inFlight = new Map<string, Promise<void>>()
const dirty = new Set<string>()

/** For tests or a future backend. */
export function configureStorage(a: StorageAdapter) {
  adapter = a
}

const RETRY_MS = 2000

function setSaveStatus(s: SaveStatus) {
  const current = useApp.getState().saveStatus
  // "offline" is sticky for the session: never claim changes are saved when storage is unavailable.
  if (current !== s && current !== 'offline') useApp.setState({ saveStatus: s })
}

function scheduleWrite(id: string, get: () => EventData | undefined) {
  if (inFlight.has(id)) {
    dirty.add(id)
    return
  }
  const e = get()
  if (!e) return
  setSaveStatus('saving')
  const p = writeEvent(e).then((ok) => {
    inFlight.delete(id)
    if (!ok) {
      // Keep the change in memory and keep retrying — never silently drop it.
      setSaveStatus('error')
      setTimeout(() => scheduleWrite(id, get), RETRY_MS)
      return
    }
    if (dirty.delete(id)) scheduleWrite(id, get)
    else if (!inFlight.size) setSaveStatus('saved')
  })
  inFlight.set(id, p)
}

let lastErrorToast = 0
async function writeEvent(e: EventData): Promise<boolean> {
  if (!adapter) return true
  try {
    await adapter.saveEvent(e)
    return true
  } catch (err) {
    if (Date.now() - lastErrorToast > 10000) {
      lastErrorToast = Date.now()
      toast.error(
        isQuotaError(err)
          ? 'Storage is full — your change is kept on screen but not saved. Remove large images or old events.'
          : 'Your latest change couldn’t be saved yet. Retrying automatically…',
      )
    }
    return false
  }
}

/** True while a change is still being written to storage. */
export function hasPendingWrites(): boolean {
  return inFlight.size > 0 || useApp.getState().saveStatus === 'error'
}

/** Ask the browser not to clear our storage when the disk is low (Chrome, Edge, Firefox). */
async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return
    await navigator.storage?.persist?.()
  } catch {
    /* not supported — IndexedDB still works normally */
  }
}

export const useApp = create<AppState>((set, get) => ({
  status: 'loading',
  persistent: true,
  saveStatus: 'saved',
  cloudStatus: 'connecting',
  events: {},
  templates: [],
  activeEventId: null,

  async init() {
    if (!adapter) adapter = await createBestAdapter()
    void requestPersistentStorage()
    const events: Record<string, EventData> = {}
    let corrupt = 0
    let loadFailed = false
    try {
      for (const raw of await adapter.loadEvents()) {
        const e = sanitizeEvent(raw)
        if (e) events[e.id] = e
        else corrupt++
      }
    } catch {
      loadFailed = true
      toast.error('Saved events couldn’t be loaded right now. Refresh the page to try again — nothing has been deleted.')
    }
    if (loadFailed) {
      // Never write over storage we failed to read: work in a temporary demo until the next refresh.
      const demo = createDemoEvent()
      events[demo.id] = demo
    }
    const templates: EventTemplate[] = []
    try {
      for (const raw of await adapter.loadTemplates()) {
        const t = sanitizeTemplate(raw)
        if (t) templates.push(t)
      }
    } catch {
      /* templates are optional */
    }
    let activeEventId = (await adapter.getMeta<string>('activeEventId').catch(() => undefined)) ?? null
    if (loadFailed) adapter = null // disable writes for this session so nothing real is overwritten
    const localEmpty = !Object.keys(events).length
    set({ events, templates, persistent: adapter?.persistent ?? false, saveStatus: adapter?.persistent ? 'saved' : 'offline' })
    // A brand-new device first asks the cloud for existing events before creating demo data.
    if (localEmpty && !loadFailed) await cloud.start(cloudHost).catch(() => false)
    if (!Object.keys(get().events).length) {
      const demo = createDemoEvent()
      set({ events: { [demo.id]: demo } })
      await writeEvent(demo)
    }
    const all = get().events
    if (!activeEventId || !all[activeEventId]) {
      activeEventId = Object.values(all).sort((a, b) => b.updatedAt - a.updatedAt)[0].id
    }
    set({ status: 'ready', activeEventId })
    if (corrupt) toast.error(`${corrupt} saved event(s) were damaged and were skipped.`)
    if (adapter && !adapter.persistent) toast.info('This browser is blocking storage. Your changes will be lost when you close the tab.')
    if (!localEmpty && !loadFailed) void cloud.start(cloudHost).catch(() => undefined)
    if (loadFailed) set({ cloudStatus: 'disabled' })
  },

  setActiveEvent(id) {
    if (!get().events[id] || get().activeEventId === id) return
    set({ activeEventId: id })
    void adapter?.setMeta('activeEventId', id).catch(() => undefined)
  },

  mutateEvent(id, fn) {
    const current = get().events[id]
    if (!current) return null
    let next = fn(current)
    if (next === current) return current
    // Every change must advance updatedAt, or cloud sync would treat it as "already saved".
    if (next.updatedAt <= current.updatedAt) next = { ...next, updatedAt: Math.max(Date.now(), current.updatedAt + 1) }
    set({ events: { ...get().events, [id]: next } })
    scheduleWrite(id, () => get().events[id])
    cloud.queueEvent(id)
    return next
  },

  addEvent(e, activate = true) {
    set({ events: { ...get().events, [e.id]: e } })
    void writeEvent(e)
    cloud.queueEvent(e.id)
    if (activate) get().setActiveEvent(e.id)
  },

  deleteEvent(id) {
    const events = { ...get().events }
    delete events[id]
    dirty.delete(id)
    let activeEventId = get().activeEventId
    if (activeEventId === id) {
      const rest = Object.values(events).sort((a, b) => b.updatedAt - a.updatedAt)
      if (!rest.length) {
        const demo = createDemoEvent()
        events[demo.id] = demo
        void writeEvent(demo)
        activeEventId = demo.id
      } else activeEventId = rest[0].id
      void adapter?.setMeta('activeEventId', activeEventId).catch(() => undefined)
    }
    set({ events, activeEventId })
    void adapter?.deleteEvent(id).catch(() => toast.error('The event couldn’t be removed from storage.'))
    cloud.deleteDoc('events', id)
  },

  saveTemplate(t) {
    set({ templates: [...get().templates.filter((x) => x.id !== t.id), t] })
    void adapter?.saveTemplate(t).catch((err) => toast.error(isQuotaError(err) ? 'Storage is full — template not saved.' : 'Template couldn’t be saved.'))
    void cloud.pushTemplate(t.id)
  },

  deleteTemplate(id) {
    set({ templates: get().templates.filter((x) => x.id !== id) })
    void adapter?.deleteTemplate(id).catch(() => undefined)
    cloud.deleteDoc('templates', id)
  },

  async flush() {
    while (inFlight.size) await Promise.all([...inFlight.values()])
  },
}))

export function useActiveEvent(): EventData | null {
  return useApp((s) => (s.activeEventId ? s.events[s.activeEventId] ?? null : null))
}

export function useEventById(id: string | undefined): EventData | null {
  return useApp((s) => (id ? s.events[id] ?? null : null))
}

/** Warn before closing/refreshing while a save is still pending, so nothing is lost. */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (hasPendingWrites()) {
      e.preventDefault()
      e.returnValue = ''
    }
  })
}

/** Bridge between the store and the cloud sync engine. Remote changes never trigger a push back. */
const cloudHost: CloudHost = {
  getEvent: (id) => useApp.getState().events[id],
  allEvents: () =>
    // Untouched demo data stays on the device so every new laptop doesn't add another demo to the cloud.
    Object.values(useApp.getState().events).filter((e) => !(e.isDemo && !e.winnerHistory.length && e.updatedAt - e.createdAt < 5000)),
  getTemplate: (id) => useApp.getState().templates.find((t) => t.id === id),
  allTemplates: () => useApp.getState().templates,
  applyEvents(list) {
    const events = { ...useApp.getState().events }
    for (const e of list) events[e.id] = e
    useApp.setState({ events })
    for (const e of list) scheduleWrite(e.id, () => useApp.getState().events[e.id])
  },
  removeEvents(ids) {
    const st = useApp.getState()
    const events = { ...st.events }
    for (const id of ids) {
      delete events[id]
      void adapter?.deleteEvent(id).catch(() => undefined)
    }
    let activeEventId = st.activeEventId
    if (activeEventId && !events[activeEventId]) {
      const rest = Object.values(events).sort((a, b) => b.updatedAt - a.updatedAt)
      if (!rest.length) {
        const demo = createDemoEvent()
        events[demo.id] = demo
        void writeEvent(demo)
      }
      activeEventId = Object.values(events).sort((a, b) => b.updatedAt - a.updatedAt)[0].id
      void adapter?.setMeta('activeEventId', activeEventId).catch(() => undefined)
      toast.info('The open event was deleted on another device.')
    }
    useApp.setState({ events, activeEventId })
  },
  applyTemplates(list) {
    useApp.setState({ templates: [...useApp.getState().templates, ...list] })
    for (const t of list) void adapter?.saveTemplate(t).catch(() => undefined)
  },
  removeTemplates(ids) {
    const set = new Set(ids)
    useApp.setState({ templates: useApp.getState().templates.filter((t) => !set.has(t.id)) })
    for (const id of ids) void adapter?.deleteTemplate(id).catch(() => undefined)
  },
  replaceImages(id, map) {
    const e = useApp.getState().events[id]
    if (!e) return
    const swap = (u?: string) => (u && map.get(u)) || u
    const next: EventData = {
      ...e,
      branding: { ...e.branding, logo: swap(e.branding.logo) ?? e.branding.logo },
      prizes: e.prizes.map((p) => ({ ...p, image: swap(p.image) })),
    }
    useApp.setState({ events: { ...useApp.getState().events, [id]: next } })
    scheduleWrite(id, () => useApp.getState().events[id])
  },
  setStatus: (cloudStatus) => {
    if (useApp.getState().cloudStatus !== cloudStatus) useApp.setState({ cloudStatus })
  },
  getMeta: async (key) => adapter?.getMeta(key),
  setMeta: async (key, value) => {
    await adapter?.setMeta(key, value)
  },
  isBusy: () => useDraw.getState().phase !== 'IDLE',
}
