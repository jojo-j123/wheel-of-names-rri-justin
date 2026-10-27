export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/** Reads the body, or null if it is larger than `max` bytes. */
export async function readBody(request: Request, max: number): Promise<ArrayBuffer | null> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > max) return null
  const buf = await request.arrayBuffer()
  return buf.byteLength > max ? null : buf
}
