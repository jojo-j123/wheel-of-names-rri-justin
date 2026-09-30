/**
 * Persistence layer. The app only talks to `StorageAdapter`, so IndexedDB can be swapped
 * for a backend (REST, Supabase…) later without touching UI or store code.
 */
import { createStore, del, entries, get, set } from 'idb-keyval'
import type { EventData, EventTemplate } from '../../types'

export interface StorageAdapter {
  readonly persistent: boolean
  loadEvents(): Promise<unknown[]>
  saveEvent(event: EventData): Promise<void>
  deleteEvent(id: string): Promise<void>
  loadTemplates(): Promise<unknown[]>
  saveTemplate(t: EventTemplate): Promise<void>
  deleteTemplate(id: string): Promise<void>
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta(key: string, value: unknown): Promise<void>
}

const EVENT = 'event:'
const TEMPLATE = 'template:'
const META = 'meta:'

export function createIndexedDbAdapter(): StorageAdapter {
  const store = createStore('rri-event-wheel', 'kv')
  const byPrefix = async (prefix: string) =>
    (await entries(store)).filter(([k]) => typeof k === 'string' && k.startsWith(prefix)).map(([, v]) => v)
  return {
    persistent: true,
    loadEvents: () => byPrefix(EVENT),
    saveEvent: (e) => set(EVENT + e.id, e, store),
    deleteEvent: (id) => del(EVENT + id, store),
    loadTemplates: () => byPrefix(TEMPLATE),
    saveTemplate: (t) => set(TEMPLATE + t.id, t, store),
    deleteTemplate: (id) => del(TEMPLATE + id, store),
    getMeta: (key) => get(META + key, store),
    setMeta: (key, value) => set(META + key, value, store),
  }
}

/** Fallback when IndexedDB is blocked (some private-browsing modes). Data lasts until the tab closes. */
export function createMemoryAdapter(): StorageAdapter {
  const m = new Map<string, unknown>()
  const byPrefix = async (prefix: string) => [...m.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => structuredClone(v))
  return {
    persistent: false,
    loadEvents: () => byPrefix(EVENT),
    saveEvent: async (e) => void m.set(EVENT + e.id, structuredClone(e)),
    deleteEvent: async (id) => void m.delete(EVENT + id),
    loadTemplates: () => byPrefix(TEMPLATE),
    saveTemplate: async (t) => void m.set(TEMPLATE + t.id, structuredClone(t)),
    deleteTemplate: async (id) => void m.delete(TEMPLATE + id),
    getMeta: async <T,>(key: string) => m.get(META + key) as T | undefined,
    setMeta: async (key, value) => void m.set(META + key, value),
  }
}

/** Picks IndexedDB when it actually works, otherwise memory. */
export async function createBestAdapter(): Promise<StorageAdapter> {
  try {
    if (typeof indexedDB === 'undefined') return createMemoryAdapter()
    const a = createIndexedDbAdapter()
    await a.setMeta('probe', Date.now())
    return a
  } catch {
    return createMemoryAdapter()
  }
}

export function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const est = await navigator.storage?.estimate?.()
    if (!est) return null
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
  } catch {
    return null
  }
}
