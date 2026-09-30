import confetti from 'canvas-confetti'

let instance: confetti.CreateTypes | null = null
let canvas: HTMLCanvasElement | null = null
const timers: ReturnType<typeof setTimeout>[] = []

function get(): confetti.CreateTypes {
  if (!instance) {
    canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '70' })
    document.body.appendChild(canvas)
    instance = confetti.create(canvas, { resize: true, useWorker: true })
  }
  return instance
}

/**
 * Controlled celebration: small burst → brief pause → side cannons → gentle fall-off.
 * Particle counts are modest to keep 60 FPS on venue laptops.
 */
export function celebrate(opts: { colors: string[]; grand: boolean; reduced: boolean }) {
  stopCelebration()
  const fire = get()
  const colors = opts.colors
  const scalar = opts.grand ? 1.15 : 1
  if (opts.reduced) {
    void fire({ particleCount: 40, spread: 70, startVelocity: 25, origin: { y: 0.55 }, colors, ticks: 120, gravity: 1.2, scalar })
    return
  }
  // 1. Small initial burst.
  void fire({ particleCount: opts.grand ? 90 : 60, spread: 70, startVelocity: 42, origin: { y: 0.5 }, colors, ticks: 220, scalar })
  // 2. Pause, then secondary side cannons.
  timers.push(
    setTimeout(() => {
      void fire({ particleCount: opts.grand ? 70 : 45, angle: 60, spread: 55, origin: { x: 0, y: 0.72 }, colors, ticks: 260, scalar })
      void fire({ particleCount: opts.grand ? 70 : 45, angle: 120, spread: 55, origin: { x: 1, y: 0.72 }, colors, ticks: 260, scalar })
    }, 450),
  )
  // 3. Gradual gentle fall from the top.
  const end = Date.now() + (opts.grand ? 3200 : 1800)
  const rain = () => {
    if (Date.now() > end) return
    void fire({ particleCount: opts.grand ? 4 : 2, startVelocity: 12, spread: 120, gravity: 0.7, drift: 0, ticks: 320, origin: { x: Math.random(), y: -0.05 }, colors, scalar: scalar * 0.9 })
    timers.push(setTimeout(rain, 90))
  }
  timers.push(setTimeout(rain, 900))
}

export function stopCelebration() {
  while (timers.length) clearTimeout(timers.pop())
  instance?.reset()
}
