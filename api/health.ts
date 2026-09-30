import { cloudConfigured, json } from './_lib/blobStore.js'

/** Lets the app know whether cloud saving is switched on (Blob store connected to the project). */
export function GET(): Response {
  return json({ ok: true, cloud: cloudConfigured(), version: 1 })
}
