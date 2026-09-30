import { cloudConfigured, json, readAll } from './_lib/blobStore.js'

/** GET /api/state — newest version of every event and template, plus deletions. */
export async function GET(): Promise<Response> {
  if (!cloudConfigured()) return json({ error: 'cloud storage not connected' }, 503)
  try {
    const [events, templates] = await Promise.all([readAll('events'), readAll('templates')])
    return json({
      events: events.docs,
      deletedEvents: events.deleted,
      templates: templates.docs,
      deletedTemplates: templates.deleted,
      serverTime: Date.now(),
    })
  } catch (e) {
    console.error('state read failed', e)
    return json({ error: 'cloud read failed' }, 502)
  }
}
