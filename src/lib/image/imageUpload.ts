/** Image validation + downscaling so uploads stay small in IndexedDB and fast on stage. */

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ACCEPTED_LOGO_TYPES = [...ACCEPTED_IMAGE_TYPES, 'image/svg+xml']
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('We couldn’t read that image. Please try another file.'))
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file doesn’t look like a working image. Please try a JPG, PNG or WEBP.'))
    img.src = src
  })
}

export interface ProcessOptions {
  maxSize: number
  accept: string[]
  /** Keep the original bytes when already small enough (used for logos so they stay pixel-exact). */
  keepOriginalUnder?: number
}

export async function processImageFile(file: File, opts: ProcessOptions): Promise<string> {
  if (!opts.accept.includes(file.type)) {
    const kinds = opts.accept.map((t) => t.split('/')[1].replace('svg+xml', 'SVG').replace('jpeg', 'JPG').toUpperCase()).join(', ')
    throw new Error(`Please choose an image file (${kinds}).`)
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error('This image is too large. Please use one under 15 MB.')
  const original = await fileToDataUrl(file)
  const img = await loadImage(original)
  if (file.type === 'image/svg+xml') return original
  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  if (opts.keepOriginalUnder && file.size <= opts.keepOriginalUnder && longest <= opts.maxSize * 1.5) return original
  const scale = Math.min(1, opts.maxSize / longest)
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return original
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const out = canvas.toDataURL('image/webp', 0.88)
  // Some browsers can't encode WEBP and silently return PNG; either is fine.
  return out.length < original.length || scale < 1 ? out : original
}
