/**
 * Cloud sync (Vercel Blob via /api/*). Local-first:
 *  - every change is saved on the device instantly (IndexedDB), then pushed to the cloud;
 *  - offline or failed pushes retry with backoff and resume when the connection returns;
 *  - other devices' changes are pulled every few seconds and on focus;
 *  - conflicts keep the newer version but never lose recorded winners (see merge.ts).
 * When the cloud isn't connected (local dev, Blob store not set up) the app simply runs local-only.
 */
import type { EventData, EventTemplate } from '../../types'
import { sanitizeEvent, sanitizeTemplate } from '../event/sanitize'
import { mergeConflict } from './merge'

export type CloudStatus = 'disabled' | 'connecting' | 'synced' | 'syncing' | 'offline'

export interface CloudHost {
  getEvent(id: string): EventData | undefined
  allEvents(): EventData[]
  getTemplate(id: string): EventTemplate | undefined
  allTemplates(): EventTemplate[]
  /** Replace/insert events from the cloud (no cloud push is triggered). */
  applyEvents(events: EventData[]): void
  removeEvents(ids: string[]): void
  applyTemplates(templates: EventTemplate[]): void
  removeTemplates(ids: string[]): void
  /** Swap uploaded image URLs into an event without changing its timestamp. */
  replaceImages(id: string, map: Map<string, string>): void
  setStatus(s: CloudStatus): void
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta(key: string, value: unknown): Promise<void>
  /** A draw is animating — defer applying remote changes to the active event. */
  isBusy(): boolean
}

interface Outbox {
  deletes: { kind: 'events' | 'templates'; id: string; at: number }[]
}

interface StateResponse {
  events: unknown[]
  deletedEvents: { id: string; deletedAt: number }[]
  templates: unknown[]
  deletedTemplates: { id: string; deletedAt: number }[]
}

const PUSH_DELAY_MS = 800
const POLL_MS = 15000
const MAX_BACKOFF_MS = 30000

export class CloudSync {
  private host: CloudHost | null = null
  enabled = false
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private pushing = new Set<string>()
  private again = new Set<string>()
  /** updatedAt of each event as last confirmed in the cloud (the "base" of local edits). */
  private synced: Record<string, number> = {}
  /** Events with local changes not yet confirmed by the cloud (tracked explicitly — never inferred from clocks). */
  private dirty = new Set<string>()
  private outbox: Outbox = { deletes: [] }
  private imageCache = new Map<string, string>()
  private backoff = 0
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private failures = 0
  private fetchImpl: typeof fetch

  constructor(fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? ((...a) => fetch(...a))
  }

  /** Detects the cloud; if available, performs the first full sync. Resolves quickly when offline. */
  private started: Promise<boolean> | null = null

  /** Idempotent (React StrictMode may call init twice). */
  start(host: CloudHost): Promise<boolean> {
    this.started ??= this.doStart(host)
    return this.started
  }

  private async doStart(host: CloudHost): Promise<boolean> {
    this.host = host
    host.setStatus('connecting')
    try {
      const r = await this.api('/api/health', {}, 5000)
      const body = r.ok ? ((await r.json()) as { cloud?: boolean }) : null
      this.enabled = !!body?.cloud
    } catch {
      this.enabled = false
    }
    if (!this.enabled) {
      host.setStatus('disabled')
      return false
    }
    this.synced = (await host.getMeta<Record<string, number>>('cloudSynced')) ?? {}
    this.outbox = (await host.getMeta<Outbox>('cloudOutbox')) ?? { deletes: [] }
    for (const id of (await host.getMeta<string[]>('cloudDirty')) ?? []) this.dirty.add(id)
    // Events this device has never synced (first sync from an existing device) count as local changes.
    for (const e of host.allEvents()) if (this.synced[e.id] === undefined) this.dirty.add(e.id)
    await this.pullNow()
    await this.flushDeletes()
    for (const id of this.dirty) this.queueEvent(id, 0)
    for (const t of host.allTemplates()) if (!this.synced['tpl:' + t.id]) void this.pushTemplate(t.id)
    if (typeof window !== 'undefined') {
      this.pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') void this.pullNow()
      }, POLL_MS)
      window.addEventListener('focus', () => void this.pullNow())
      window.addEventListener('online', () => {
        this.backoff = 0
        void this.flushAll()
      })
    }
    return true
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.timers.forEach(clearTimeout)
    this.timers.clear()
  }

  hasPending(): boolean {
    return this.enabled && (this.dirty.size > 0 || this.timers.size > 0 || this.pushing.size > 0 || this.outbox.deletes.length > 0)
  }

  private async api(path: string, init: RequestInit = {}, timeoutMs = 20000): Promise<Response> {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      return await this.fetchImpl(path, { ...init, signal: ctrl.signal, cache: 'no-store' })
    } finally {
      clearTimeout(t)
    }
  }

  private updateStatus() {
    if (!this.host || !this.enabled) return
    if (this.failures > 0) this.host.setStatus('offline')
    else this.host.setStatus(this.hasPending() ? 'syncing' : 'synced')
  }

  private persistMeta() {
    void this.host?.setMeta('cloudSynced', this.synced).catch(() => undefined)
    void this.host?.setMeta('cloudDirty', [...this.dirty]).catch(() => undefined)
    void this.host?.setMeta('cloudOutbox', this.outbox).catch(() => undefined)
  }

  /* ---------------------------------------------------------------- pull */

  private pulling: Promise<void> | null = null

  pullNow(): Promise<void> {
    if (!this.enabled || !this.host) return Promise.resolve()
    this.pulling ??= this.doPull().finally(() => (this.pulling = null))
    return this.pulling
  }

  private async doPull() {
    const host = this.host!
    let data: StateResponse
    try {
      const r = await this.api('/api/state')
      if (!r.ok) throw new Error(`state ${r.status}`)
      data = (await r.json()) as StateResponse
      this.failures = 0
    } catch {
      this.failures++
      this.updateStatus()
      return
    }
    const pendingDeletes = new Set(this.outbox.deletes.map((d) => `${d.kind}:${d.id}`))

    // Deletions made on other devices.
    const removeIds: string[] = []
    for (const d of data.deletedEvents ?? []) {
      const local = host.getEvent(d.id)
      if (local && d.deletedAt >= local.updatedAt) removeIds.push(d.id)
    }
    if (removeIds.length) host.removeEvents(removeIds)

    const apply: EventData[] = []
    for (const raw of data.events ?? []) {
      const remote = sanitizeEvent(raw)
      if (!remote || pendingDeletes.has(`events:${remote.id}`)) continue
      const local = host.getEvent(remote.id)
      const base = this.synced[remote.id]
      const remoteChanged = remote.updatedAt !== base
      const localDirty = this.dirty.has(remote.id)
      if (!local) {
        apply.push(remote)
        this.synced[remote.id] = remote.updatedAt
        this.dirty.delete(remote.id)
      } else if (!remoteChanged) {
        if (localDirty) this.queueEvent(remote.id)
      } else if (host.isBusy()) {
        continue // never swap data under a spinning wheel; the next pull applies it
      } else if (!localDirty) {
        apply.push(remote)
        this.synced[remote.id] = remote.updatedAt
      } else {
        // Both sides changed since the last sync: newer fields win, winners from both are kept.
        const merged = remote.updatedAt >= local.updatedAt ? mergeConflict(remote, local) : mergeConflict(local, remote)
        apply.push(merged)
        this.synced[remote.id] = remote.updatedAt
        this.queueEvent(remote.id)
      }
    }
    if (apply.length) host.applyEvents(apply)

    const removeTpl = (data.deletedTemplates ?? []).map((d) => d.id).filter((id) => host.getTemplate(id))
    if (removeTpl.length) host.removeTemplates(removeTpl)
    const tpls = (data.templates ?? [])
      .map(sanitizeTemplate)
      .filter((t): t is EventTemplate => !!t && !host.getTemplate(t.id) && !pendingDeletes.has(`templates:${t.id}`))
    if (tpls.length) host.applyTemplates(tpls)
    for (const t of data.templates ?? []) {
      const id = (t as { id?: string })?.id
      if (id) this.synced['tpl:' + id] = 1
    }
    this.persistMeta()
    this.updateStatus()
  }

  /* ---------------------------------------------------------------- push */

  queueEvent(id: string, delay = PUSH_DELAY_MS) {
    if (!this.enabled) return
    this.dirty.add(id)
    const t = this.timers.get(id)
    if (t) clearTimeout(t)
    this.timers.set(
      id,
      setTimeout(() => {
        this.timers.delete(id)
        void this.pushEvent(id)
      }, delay),
    )
    this.updateStatus()
  }

  private async pushEvent(id: string) {
    const host = this.host
    if (!host) return
    if (this.pushing.has(id)) {
      this.again.add(id)
      return
    }
    let e = host.getEvent(id)
    if (!e) {
      this.dirty.delete(id)
      return
    }
    const base = this.synced[id]
    if (base !== undefined && e.updatedAt <= base) {
      // This device's clock is behind the cloud's: bump so the new version sorts after the base.
      e = { ...e, updatedAt: base + 1 }
      host.applyEvents([e])
    }
    this.pushing.add(id)
    this.updateStatus()
    let retry = false
    try {
      const event = await this.offloadImages(e)
      const r = await this.api(`/api/events?id=${encodeURIComponent(id)}&base=${base ?? 0}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      })
      if (r.ok) {
        this.synced[id] = event.updatedAt
        // Only clean if nothing changed locally while the request was in flight.
        if ((host.getEvent(id)?.updatedAt ?? 0) === event.updatedAt && !this.again.has(id)) this.dirty.delete(id)
        this.failures = 0
        this.backoff = 0
      } else if (r.status === 409) {
        const body = (await r.json().catch(() => ({}))) as { reason?: string }
        if (body.reason === 'deleted') {
          this.dirty.delete(id)
          host.removeEvents([id])
        } else {
          this.pushing.delete(id)
          await this.pullNow() // someone else saved first — pull merges both, then re-pushes
        }
      } else if (r.status === 413) {
        // Too large even after image upload: keep it local, don't hammer the server.
        console.warn('[cloud] event too large to sync', id)
      } else retry = true
    } catch {
      retry = true
    } finally {
      this.pushing.delete(id)
    }
    if (retry) {
      this.failures++
      this.backoff = Math.min(MAX_BACKOFF_MS, this.backoff ? this.backoff * 2 : 2000)
      this.queueEvent(id, this.backoff)
    } else if (this.again.delete(id)) this.queueEvent(id, 0)
    this.persistMeta()
    this.updateStatus()
  }

  /** Upload embedded (data: URL) images once and reference them by URL — keeps event documents small. */
  private async offloadImages(e: EventData): Promise<EventData> {
    const urls = [e.branding.logo, ...e.prizes.map((p) => p.image)].filter((u): u is string => !!u && u.startsWith('data:image/'))
    if (!urls.length) return e
    const map = new Map<string, string>()
    for (const dataUrl of new Set(urls)) {
      const cached = this.imageCache.get(dataUrl)
      if (cached) {
        map.set(dataUrl, cached)
        continue
      }
      const blob = await (await fetch(dataUrl)).blob()
      const r = await this.api('/api/upload', { method: 'POST', headers: { 'content-type': blob.type }, body: blob })
      if (!r.ok) {
        if (r.status >= 500 || r.status === 0) throw new Error('upload failed')
        continue // unsupported/too large: leave embedded
      }
      const { url } = (await r.json()) as { url: string }
      this.imageCache.set(dataUrl, url)
      map.set(dataUrl, url)
    }
    if (!map.size) return e
    this.host?.replaceImages(e.id, map)
    const swap = (u?: string) => (u && map.get(u)) || u
    return {
      ...e,
      branding: { ...e.branding, logo: swap(e.branding.logo) ?? e.branding.logo },
      prizes: e.prizes.map((p) => ({ ...p, image: swap(p.image) })),
    }
  }

  async pushTemplate(id: string) {
    if (!this.enabled || !this.host) return
    const t = this.host.getTemplate(id)
    if (!t || t.builtIn) return
    try {
      const r = await this.api(`/api/templates?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...t, createdAt: t.createdAt || Date.now() }),
      })
      if (r.ok || r.status === 409) this.synced['tpl:' + id] = 1
    } catch {
      /* retried on next start */
    }
    this.persistMeta()
  }

  /* ---------------------------------------------------------------- deletes */

  deleteDoc(kind: 'events' | 'templates', id: string) {
    if (!this.enabled) return
    const t = this.timers.get(id)
    if (t) clearTimeout(t)
    this.timers.delete(id)
    this.dirty.delete(id)
    this.outbox.deletes.push({ kind, id, at: Date.now() })
    this.persistMeta()
    void this.flushDeletes()
  }

  private async flushDeletes() {
    const remaining: Outbox['deletes'] = []
    for (const d of this.outbox.deletes) {
      try {
        const r = await this.api(`/api/${d.kind}?id=${encodeURIComponent(d.id)}&at=${d.at}`, { method: 'DELETE' })
        if (!r.ok && r.status >= 500) remaining.push(d)
      } catch {
        remaining.push(d)
      }
    }
    this.outbox.deletes = remaining
    if (remaining.length) this.failures++
    this.persistMeta()
    this.updateStatus()
  }

  private async flushAll() {
    await this.flushDeletes()
    for (const id of this.dirty) this.queueEvent(id, 0)
    await this.pullNow()
  }
}

export const cloud = new CloudSync()
