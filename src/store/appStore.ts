import { create } from 'zustand'
import type { EventData, EventTemplate } from '../types'
import { createDemoEvent } from '../lib/event/demo'
import { sanitizeEvent, sanitizeTemplate } from '../lib/event/sanitize'
import { createBestAdapter, isQuotaError, type StorageAdapter } from '../lib/storage/storage'
import { toast } from './toastStore'

interface AppState {
  status: 'loading' | 'ready'
  persistent: boolean
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

function scheduleWrite(id: string, get: () => EventData | undefined) {
  if (inFlight.has(id)) {
    dirty.add(id)
    return
  }
  const e = get()
  if (!e) return
  const p = writeEvent(e).finally(() => {
    inFlight.delete(id)
    if (dirty.delete(id)) scheduleWrite(id, get)
  })
  inFlight.set(id, p)
}

async function writeEvent(e: EventData) {
  if (!adapter) return
  try {
    await adapter.saveEvent(e)
  } catch (err) {
    toast.error(
      isQuotaError(err)
        ? 'Storage is full. Remove large images or old events, then try again.'
        : 'Your latest change couldn’t be saved. Please try again.',
    )
  }
}

export const useApp = create<AppState>((set, get) => ({
  status: 'loading',
  persistent: true,
  events: {},
  templates: [],
  activeEventId: null,

  async init() {
    if (!adapter) adapter = await createBestAdapter()
    const events: Record<string, EventData> = {}
    let corrupt = 0
    try {
      for (const raw of await adapter.loadEvents()) {
        const e = sanitizeEvent(raw)
        if (e) events[e.id] = e
        else corrupt++
      }
    } catch {
      toast.error('Saved events couldn’t be loaded. Starting fresh — nothing has been deleted.')
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
    if (!Object.keys(events).length) {
      const demo = createDemoEvent()
      events[demo.id] = demo
      await writeEvent(demo)
    }
    let activeEventId = (await adapter.getMeta<string>('activeEventId').catch(() => undefined)) ?? null
    if (!activeEventId || !events[activeEventId]) {
      activeEventId = Object.values(events).sort((a, b) => b.updatedAt - a.updatedAt)[0].id
    }
    set({ status: 'ready', persistent: adapter.persistent, events, templates, activeEventId })
    if (corrupt) toast.error(`${corrupt} saved event(s) were damaged and were skipped.`)
    if (!adapter.persistent) toast.info('This browser is blocking storage. Your changes will be lost when you close the tab.')
  },

  setActiveEvent(id) {
    if (!get().events[id] || get().activeEventId === id) return
    set({ activeEventId: id })
    void adapter?.setMeta('activeEventId', id).catch(() => undefined)
  },

  mutateEvent(id, fn) {
    const current = get().events[id]
    if (!current) return null
    const next = fn(current)
    if (next === current) return current
    set({ events: { ...get().events, [id]: next } })
    scheduleWrite(id, () => get().events[id])
    return next
  },

  addEvent(e, activate = true) {
    set({ events: { ...get().events, [e.id]: e } })
    void writeEvent(e)
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
  },

  saveTemplate(t) {
    set({ templates: [...get().templates.filter((x) => x.id !== t.id), t] })
    void adapter?.saveTemplate(t).catch((err) => toast.error(isQuotaError(err) ? 'Storage is full — template not saved.' : 'Template couldn’t be saved.'))
  },

  deleteTemplate(id) {
    set({ templates: get().templates.filter((x) => x.id !== id) })
    void adapter?.deleteTemplate(id).catch(() => undefined)
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
