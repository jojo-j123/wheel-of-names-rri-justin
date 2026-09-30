/**
 * Canvas drawing for the wheel. The expensive face (segments + labels) is rendered ONCE into an
 * offscreen canvas; each animation frame only rotates and blits it, so 1,000 segments stay at 60 FPS.
 */
import { mix, readableTextOn, rgba } from '../branding'

export interface WheelColors {
  primary: string
  secondary: string
  accent: string
}

export type LabelTier = 'full' | 'compact' | 'none'

export function labelTier(count: number): LabelTier {
  if (count <= 30) return 'full'
  if (count <= 100) return 'compact'
  return 'none'
}

/** Number of rim pegs (= tick points). Every boundary for small wheels, virtual pegs for big ones. */
export function pegCount(count: number): number {
  return count <= 72 ? Math.max(count, 1) : 72
}

export function segmentPalette(c: WheelColors): string[] {
  return [c.primary, c.secondary, mix(c.accent, '#ffffff', 0.15), mix(c.primary, c.secondary, 0.55)]
}

/** Segment color, ensuring the last and first segments never share a color. */
export function segmentColor(i: number, count: number, palette: string[]): string {
  if (count > 100) {
    const bandSize = Math.ceil(count / 24)
    const band = Math.floor(i / bandSize)
    const base = palette[band % palette.length]
    return i % 2 ? mix(base, '#000000', 0.12) : base
  }
  const k = palette.length
  if (count > 1 && i === count - 1 && (count - 1) % k === 0) return palette[2 % k]
  return palette[i % k]
}

function compactName(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length < 2) return name
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, Math.max(1, lo)) + '…'
}

const DEG = Math.PI / 180
/** Canvas angle 0 is 3 o'clock; our 0 is 12 o'clock. */
const TOP = -Math.PI / 2

export const FONT_STACK = '"Sora Variable", "Inter Variable", system-ui, sans-serif'

/** Renders the static wheel face (no rim). `size` in device pixels. */
export function renderFace(canvas: HTMLCanvasElement, size: number, names: string[], colors: WheelColors) {
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const r = size / 2
  const R = r * 0.94 // leave room for the rim drawn separately
  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.translate(r, r)
  const N = names.length
  const palette = segmentPalette(colors)

  if (N === 0) {
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, Math.PI * 2)
    ctx.fillStyle = mix(colors.secondary, '#000000', 0.2)
    ctx.fill()
    ctx.restore()
    return
  }

  const seg = (Math.PI * 2) / N
  for (let i = 0; i < N; i++) {
    const a0 = TOP + i * seg
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, R, a0, a0 + seg + (N > 1 ? 0.002 : 0))
    ctx.closePath()
    ctx.fillStyle = segmentColor(i, N, palette)
    ctx.fill()
  }

  // Separators.
  if (N > 1 && N <= 200) {
    ctx.strokeStyle = rgba('#ffffff', N <= 30 ? 0.28 : 0.14)
    ctx.lineWidth = Math.max(1, size * (N <= 30 ? 0.0022 : 0.001))
    ctx.beginPath()
    for (let i = 0; i < N; i++) {
      const a = TOP + i * seg
      ctx.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2)
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R)
    }
    ctx.stroke()
  }

  // Depth: darker toward the rim, soft light in the middle.
  const shade = ctx.createRadialGradient(0, 0, R * 0.15, 0, 0, R)
  shade.addColorStop(0, 'rgba(255,255,255,0.10)')
  shade.addColorStop(0.55, 'rgba(0,0,0,0)')
  shade.addColorStop(1, 'rgba(0,0,0,0.30)')
  ctx.fillStyle = shade
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.fill()

  // Labels.
  const tier = labelTier(N)
  if (tier !== 'none') {
    const labelR = R * 0.9
    const maxW = R * (tier === 'full' ? 0.6 : 0.55)
    const arcH = labelR * 0.55 * seg // usable height near the inner end of the label
    const base = tier === 'full' ? Math.min(R * 0.085, arcH * 0.62) : Math.min(R * 0.045, arcH * 0.8)
    const fontPx = Math.max(8, base)
    if (fontPx >= 8 && arcH >= 7) {
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.font = `${tier === 'full' ? 650 : 600} ${fontPx}px ${FONT_STACK}`
      for (let i = 0; i < N; i++) {
        const mid = TOP + (i + 0.5) * seg
        ctx.save()
        ctx.rotate(mid)
        const bg = segmentColor(i, N, palette)
        ctx.fillStyle = readableTextOn(bg)
        ctx.shadowColor = 'rgba(0,0,0,0.25)'
        ctx.shadowBlur = fontPx * 0.2
        const text = fitText(ctx, tier === 'full' ? names[i] : compactName(names[i]), maxW)
        ctx.fillText(text, labelR, 0)
        ctx.restore()
      }
    }
  }
  ctx.restore()
}

/** Static rim ring (metallic band + peg sockets). */
export function renderRim(canvas: HTMLCanvasElement, size: number, count: number, colors: WheelColors) {
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const r = size / 2
  const outer = r * 0.995
  const inner = r * 0.935
  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.translate(r, r)
  const band = ctx.createLinearGradient(-r, -r, r, r)
  band.addColorStop(0, mix(colors.secondary, '#ffffff', 0.35))
  band.addColorStop(0.35, mix(colors.secondary, '#000000', 0.35))
  band.addColorStop(0.65, mix(colors.secondary, '#ffffff', 0.18))
  band.addColorStop(1, mix(colors.secondary, '#000000', 0.5))
  ctx.beginPath()
  ctx.arc(0, 0, outer, 0, Math.PI * 2)
  ctx.arc(0, 0, inner, 0, Math.PI * 2, true)
  ctx.fillStyle = band
  ctx.fill('evenodd')
  // Hairlines.
  ctx.lineWidth = Math.max(1, size * 0.002)
  ctx.strokeStyle = rgba(colors.accent, 0.55)
  ctx.beginPath()
  ctx.arc(0, 0, inner, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.arc(0, 0, outer - ctx.lineWidth, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  void count
}

/** Rotating pegs on the face edge — they are what the pointer "clicks" against. */
export function drawPegs(ctx: CanvasRenderingContext2D, r: number, count: number, rotationDeg: number, color: string) {
  const P = pegCount(count)
  if (count <= 1) return
  const R = r * 0.94
  const pr = Math.max(1.5, r * (P > 48 ? 0.008 : 0.012))
  ctx.save()
  ctx.rotate(rotationDeg * DEG)
  ctx.fillStyle = color
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = pr
  const step = (Math.PI * 2) / P
  ctx.beginPath()
  for (let i = 0; i < P; i++) {
    const a = TOP + i * step
    const x = Math.cos(a) * (R - pr * 1.6)
    const y = Math.sin(a) * (R - pr * 1.6)
    ctx.moveTo(x + pr, y)
    ctx.arc(x, y, pr, 0, Math.PI * 2)
  }
  ctx.fill()
  ctx.restore()
}

/** Marquee bulbs around the rim. `mode` controls the chase pattern. */
export function drawBulbs(
  ctx: CanvasRenderingContext2D,
  r: number,
  time: number,
  mode: 'idle' | 'spin' | 'win',
  speed: number,
  colors: WheelColors,
) {
  const count = 32
  const rr = r * 0.965
  const br = r * 0.011
  for (let i = 0; i < count; i++) {
    const a = TOP + (i / count) * Math.PI * 2
    let on: number
    if (mode === 'win') on = Math.floor(time * 6) % 2 === i % 2 ? 1 : 0.15
    else if (mode === 'spin') on = (i + Math.floor(time * (8 + speed * 22))) % 4 === 0 ? 1 : 0.2
    else on = 0.35 + 0.65 * Math.max(0, Math.sin(time * 1.4 - i * 0.45))
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    ctx.beginPath()
    ctx.arc(x, y, br, 0, Math.PI * 2)
    ctx.fillStyle = on > 0.6 ? mix(colors.accent, '#ffffff', 0.5) : rgba(colors.accent, 0.25 + on * 0.5)
    if (on > 0.6) {
      ctx.shadowColor = colors.accent
      ctx.shadowBlur = br * 3
    } else ctx.shadowBlur = 0
    ctx.fill()
  }
  ctx.shadowBlur = 0
}

/** Dim everything except the winning segment. */
export function drawHighlight(ctx: CanvasRenderingContext2D, r: number, count: number, index: number, rotationDeg: number, strength: number) {
  if (count <= 1 || strength <= 0) return
  const R = r * 0.94
  const seg = (Math.PI * 2) / count
  ctx.save()
  ctx.rotate(rotationDeg * DEG)
  const a0 = TOP + index * seg
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, R, a0 + seg, a0, true)
  ctx.closePath()
  ctx.fillStyle = `rgba(0,0,0,${0.5 * strength})`
  ctx.fill('evenodd')
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, R, a0, a0 + seg)
  ctx.closePath()
  ctx.fillStyle = `rgba(255,255,255,${0.16 * strength})`
  ctx.fill()
  ctx.lineWidth = Math.max(2, r * 0.008)
  ctx.strokeStyle = `rgba(255,255,255,${0.85 * strength})`
  ctx.stroke()
  ctx.restore()
}
