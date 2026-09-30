import { cloudConfigured, isImageType, json, MAX_IMAGE_BYTES, readBody, saveImage } from './_lib/blobStore.js'

/** POST /api/upload — raw image bytes (JPG/PNG/WEBP/SVG, ≤ 4 MB) → public URL. */
export async function POST(request: Request): Promise<Response> {
  if (!cloudConfigured()) return json({ error: 'cloud storage not connected' }, 503)
  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!isImageType(type)) return json({ error: 'unsupported image type' }, 415)
  const buf = await readBody(request, MAX_IMAGE_BYTES)
  if (!buf || !buf.byteLength) return json({ error: 'image too large or empty' }, 413)
  try {
    return json({ url: await saveImage(buf, type) })
  } catch (e) {
    console.error('image upload failed', e)
    return json({ error: 'upload failed' }, 502)
  }
}
