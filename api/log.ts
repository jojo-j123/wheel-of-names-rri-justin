import { json, readBody } from './_lib/blobStore.js'

/** POST /api/log — client crash reports, written to Vercel runtime logs. No event data is accepted. */
export async function POST(request: Request): Promise<Response> {
  const buf = await readBody(request, 16 * 1024)
  if (!buf) return json({ ok: false }, 413)
  try {
    const r = JSON.parse(new TextDecoder().decode(buf)) as Record<string, unknown>
    const pick = (k: string, n: number) => String(r[k] ?? '').slice(0, n)
    console.error(
      '[client-error]',
      JSON.stringify({
        context: pick('context', 60),
        message: pick('message', 500),
        path: pick('path', 200),
        translated: r.translated === true,
        userAgent: pick('userAgent', 300),
        stack: pick('stack', 2000),
        componentStack: pick('componentStack', 2000),
        at: pick('at', 40),
      }),
    )
  } catch {
    return json({ ok: false }, 400)
  }
  return json({ ok: true })
}
