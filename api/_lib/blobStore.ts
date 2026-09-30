/**
 * Cloud storage for RRI Event Wheel on Vercel Blob.
 *
 * Layout (every save creates a new immutable version, so reads are never stale from CDN caching):
 *   events/<id>/v<updatedAt>-<random>.json      event versions (newest 3 kept)
 *   deleted/<id>.json                            tombstone so other devices don't resurrect a deleted event
 *   templates/<id>/v<createdAt>-<random>.json    saved templates
 *   deleted-templates/<id>.json
 *   images/<sha256>.<ext>                        prize images & logos (content-addressed, deduplicated)
 */
import { del, list, put } from '@vercel/blob'

export type Kind = 'events' | 'templates'
const TOMBSTONE: Record<Kind, string> = { events: 'deleted/', templates: 'deleted-templates/' }
const KEEP_VERSIONS = 3

export const MAX_JSON_BYTES = 4 * 1024 * 1024
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024
export const ID_RE = /^[A-Za-z0-9_-]{6,100}$/

export function cloudConfigured(): boolean {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

interface Version {
  id: string
  url: string
  pathname: string
  stamp: number
  uploadedAt: number
}

async function listAll(prefix: string) {
  const out: { url: string; pathname: string; uploadedAt: Date }[] = []
  let cursor: string | undefined
  do {
    const r = await list({ prefix, cursor, limit: 1000 })
    out.push(...r.blobs)
    cursor = r.hasMore ? r.cursor : undefined
  } while (cursor)
  return out
}

/** v<stamp>-… → stamp (the document's updatedAt / createdAt). */
function parseVersion(kind: Kind, b: { url: string; pathname: string; uploadedAt: Date }): Version | null {
  const m = new RegExp(`^${kind}/([A-Za-z0-9_-]+)/v(\\d+)-`).exec(b.pathname)
  if (!m) return null
  return { id: m[1], url: b.url, pathname: b.pathname, stamp: Number(m[2]), uploadedAt: new Date(b.uploadedAt).getTime() }
}

function newestPerId(versions: Version[]): Map<string, Version> {
  const best = new Map<string, Version>()
  for (const v of versions) {
    const cur = best.get(v.id)
    if (!cur || v.stamp > cur.stamp || (v.stamp === cur.stamp && v.uploadedAt > cur.uploadedAt)) best.set(v.id, v)
  }
  return best
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' })
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx])
      }
    }),
  )
  return out
}

export interface Tombstone {
  id: string
  deletedAt: number
}

async function tombstones(kind: Kind): Promise<Tombstone[]> {
  const blobs = await listAll(TOMBSTONE[kind])
  return blobs
    .map((b) => {
      const m = /\/([A-Za-z0-9_-]+)-t(\d+)\.json$/.exec(b.pathname)
      return m ? { id: m[1], deletedAt: Number(m[2]) } : null
    })
    .filter((t): t is Tombstone => !!t)
}

/** Everything a device needs to sync: newest version of every document + deletions. */
export async function readAll(kind: Kind): Promise<{ docs: unknown[]; deleted: Tombstone[] }> {
  const [blobs, deleted] = await Promise.all([listAll(`${kind}/`), tombstones(kind)])
  const newest = [...newestPerId(blobs.map((b) => parseVersion(kind, b)).filter((v): v is Version => !!v)).values()]
  const docs = (await mapLimit(newest, 8, (v) => fetchJson(v.url))).filter((d) => d !== null)
  return { docs, deleted }
}

export interface SaveResult {
  ok: boolean
  stamp?: number
  reason?: 'stale' | 'deleted'
  newerStamp?: number
}

/**
 * Save a new version (optimistic concurrency).
 * `base` = the version the device last saw. If someone else saved since then, the write is refused
 * with 409 so the device merges first — nobody's changes are silently overwritten.
 * Without `base`, falls back to "newest timestamp wins".
 */
export async function saveDoc(kind: Kind, id: string, stamp: number, body: string, base?: number): Promise<SaveResult> {
  const [versions, deleted] = await Promise.all([listAll(`${kind}/${id}/`), tombstones(kind)])
  const tomb = deleted.find((t) => t.id === id)
  if (tomb && tomb.deletedAt >= stamp) return { ok: false, reason: 'deleted' }
  const parsed = versions.map((b) => parseVersion(kind, b)).filter((v): v is Version => !!v)
  const newest = parsed.reduce<Version | null>((a, v) => (!a || v.stamp > a.stamp ? v : a), null)
  if (newest && newest.stamp === stamp) return { ok: true, stamp } // identical version already stored
  if (base !== undefined && (newest?.stamp ?? 0) !== base) return { ok: false, reason: 'stale', newerStamp: newest?.stamp }
  if (newest && newest.stamp > stamp) return { ok: false, reason: 'stale', newerStamp: newest.stamp }
  await put(`${kind}/${id}/v${stamp}-.json`, body, {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'application/json',
  })
  // Keep a few recent versions as a safety net, remove older ones.
  const old = parsed.sort((a, b) => b.stamp - a.stamp).slice(KEEP_VERSIONS - 1)
  if (old.length) await del(old.map((v) => v.url)).catch(() => undefined)
  return { ok: true, stamp }
}

export async function deleteDoc(kind: Kind, id: string, deletedAt: number): Promise<void> {
  const versions = await listAll(`${kind}/${id}/`)
  await put(`${TOMBSTONE[kind]}${id}-t${deletedAt}.json`, JSON.stringify({ id, deletedAt }), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
  if (versions.length) await del(versions.map((v) => v.url))
}

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export async function saveImage(bytes: ArrayBuffer, contentType: string): Promise<string> {
  const ext = IMAGE_TYPES[contentType]
  if (!ext) throw new Error('unsupported image type')
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  const r = await put(`images/${hash}.${ext}`, new Blob([bytes], { type: contentType }), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  })
  return r.url
}

export function isImageType(t: string): boolean {
  return t in IMAGE_TYPES
}

/** Reads a request body with a hard size cap (protects the open API from huge uploads). */
export async function readBody(request: Request, max: number): Promise<ArrayBuffer | null> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > max) return null
  const buf = await request.arrayBuffer()
  return buf.byteLength > max ? null : buf
}
