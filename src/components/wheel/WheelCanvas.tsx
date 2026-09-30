import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react'
import gsap from 'gsap'
import type { DrawPhase } from '../../types'
import { buildSpinPlan, type SpinPlan } from '../../lib/wheel/spinPlan'
import type { ModeTimings } from '../../lib/wheel/timings'
import { computeTargetRotation, normalizeAngle, segmentAngle, segmentAtPointer } from '../../lib/wheel/wheelMath'
import { drawBulbs, drawHighlight, drawLens, drawPegs, pegCount, renderFace, renderRim, type WheelColors } from '../../lib/wheel/renderer'

export interface SpinRequest {
  targetIndex: number
  /** Segment count of the frozen snapshot the winner was picked from. */
  count: number
  timings: ModeTimings
  /** Cosmetic landing offset inside the segment, [-0.3, 0.3]. */
  offsetFraction: number
  onPhase(phase: DrawPhase): void
  onLanded(): void
}

export interface WheelHandle {
  spin(req: SpinRequest): SpinPlan | null
  /** Emergency stop: freeze where it is. */
  stop(): void
  getRotation(): number
}

interface Props {
  names: string[]
  colors: WheelColors
  highlightIndex: number | null
  celebrate: boolean
  reducedMotion: boolean
  pointerEl: React.RefObject<HTMLDivElement | null>
  onTick?(speed: number): void
  onPointerIndex?(index: number): void
  onSpeed?(normalized: number): void
}

const MAX_CANVAS_PX = 2400

export const WheelCanvas = memo(
  forwardRef<WheelHandle, Props>(function WheelCanvas(props, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const faceRef = useRef<HTMLCanvasElement | null>(null)
    const rimRef = useRef<HTMLCanvasElement | null>(null)
    const propsRef = useRef(props)
    propsRef.current = props

    const st = useRef({
      rotation: 0,
      prevRotation: 0,
      velocity: 0,
      vmax: 1,
      spinning: false,
      tl: null as gsap.core.Timeline | null,
      pointerAngle: 0,
      lastPointerIndex: -1,
      highlight: 0,
      sizeCss: 0,
      dpr: 1,
      faceDirty: true,
      lastTime: 0,
    })

    // Re-render the static face only when the list, colors or size change.
    useEffect(() => {
      st.current.faceDirty = true
    }, [props.names, props.colors])

    useImperativeHandle(ref, () => ({
      spin(req) {
        const s = st.current
        const N = req.count
        if (N === 0 || s.spinning) return null
        s.tl?.kill()
        s.rotation = normalizeAngle(s.rotation)
        s.prevRotation = s.rotation
        const target = computeTargetRotation({
          currentRotation: s.rotation,
          targetIndex: req.targetIndex,
          count: N,
          rotations: req.timings.rotations,
          offsetFraction: req.offsetFraction,
        })
        // Overshoot stays inside the winning segment: |offset| ≤ 0.3 seg, overshoot ≤ 0.15 seg → < 0.5 seg.
        const overshoot = Math.min(segmentAngle(N) * 0.15, 2.5)
        const plan = buildSpinPlan({ start: s.rotation, target, timings: req.timings, overshoot })
        s.vmax = Math.max(1, plan.vmax)
        s.spinning = true
        let phase: DrawPhase | null = null
        const proxy = { t: 0 }
        const tl = gsap.timeline()
        tl.to(proxy, {
          t: plan.duration,
          duration: plan.duration,
          ease: 'none',
          onUpdate() {
            s.rotation = plan.positionAt(proxy.t)
            const p = plan.phaseAt(proxy.t)
            if (p !== phase) {
              phase = p
              req.onPhase(p)
            }
          },
          onComplete() {
            // Exact analytic landing, then fold back into [0, 360) to avoid cumulative growth.
            s.rotation = normalizeAngle(plan.target)
            s.prevRotation = s.rotation
            s.spinning = false
            s.velocity = 0
            s.tl = null
            req.onLanded()
          },
        })
        s.tl = tl
        return plan
      },
      stop() {
        const s = st.current
        s.tl?.kill()
        s.tl = null
        s.spinning = false
        s.velocity = 0
        s.rotation = normalizeAngle(s.rotation)
        s.prevRotation = s.rotation
      },
      getRotation: () => st.current.rotation,
    }))

    useEffect(() => {
      const s = st.current
      const el = containerRef.current
      if (!el) return
      const ro = new ResizeObserver(([entry]) => {
        const w = Math.round(entry.contentRect.width)
        if (w !== s.sizeCss) {
          s.sizeCss = w
          s.faceDirty = true
        }
      })
      ro.observe(el)

      const render = () => {
        const canvas = canvasRef.current
        const p = propsRef.current
        if (!canvas || s.sizeCss <= 0) return
        const now = performance.now() / 1000
        const dt = s.lastTime ? Math.min(0.1, now - s.lastTime) : 1 / 60
        s.lastTime = now
        const N = p.names.length

        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const px = Math.min(MAX_CANVAS_PX, Math.round(s.sizeCss * dpr))
        if (s.faceDirty || canvas.width !== px) {
          canvas.width = px
          canvas.height = px
          faceRef.current ??= document.createElement('canvas')
          rimRef.current ??= document.createElement('canvas')
          renderFace(faceRef.current, px, p.names, p.colors)
          renderRim(rimRef.current, px, N, p.colors)
          s.faceDirty = false
        }

        // Gentle idle drift keeps the stage alive between draws.
        if (!s.spinning && p.highlightIndex === null && !p.reducedMotion && N > 1) s.rotation += 3 * dt

        const delta = s.rotation - s.prevRotation
        s.velocity = delta / dt
        const speed = Math.min(1, Math.abs(s.velocity) / s.vmax)

        // Ticks: count peg crossings under the pointer since last frame.
        if (N > 1) {
          const peg = 360 / pegCount(N)
          const crossings = Math.abs(Math.floor(s.rotation / peg) - Math.floor(s.prevRotation / peg))
          if (crossings > 0 && s.spinning) {
            p.onTick?.(speed)
            const kick = p.reducedMotion ? 6 : 10 + 16 * Math.min(1, crossings / 2 + speed * 0.5)
            s.pointerAngle = Math.min(s.pointerAngle, -kick)
          }
          const idx = segmentAtPointer(s.rotation, N)
          if (idx !== s.lastPointerIndex) {
            s.lastPointerIndex = idx
            p.onPointerIndex?.(idx)
          }
        } else if (s.lastPointerIndex !== 0 && N === 1) {
          s.lastPointerIndex = 0
          p.onPointerIndex?.(0)
        }
        p.onSpeed?.(s.spinning ? speed : 0)
        s.prevRotation = s.rotation

        // Pointer spring back (time-based exponential decay).
        s.pointerAngle *= Math.pow(0.0009, dt)
        if (p.pointerEl.current) p.pointerEl.current.style.transform = `rotate(${s.pointerAngle.toFixed(2)}deg)`

        // Highlight fade.
        const hTarget = p.highlightIndex !== null ? 1 : 0
        s.highlight += (hTarget - s.highlight) * Math.min(1, dt * 5)

        const ctx = canvas.getContext('2d')
        const face = faceRef.current
        if (!ctx || !face) return
        const r = px / 2
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, px, px)
        ctx.translate(r, r)

        // Motion blur: faint trailing copies when moving fast.
        const step = Math.abs(delta)
        if (!p.reducedMotion && step > 2.5) {
          const ghosts = step > 10 ? 3 : 2
          for (let g = ghosts; g >= 1; g--) {
            ctx.save()
            ctx.globalAlpha = 0.22
            ctx.rotate(((s.rotation - (delta * g) / (ghosts + 1)) * Math.PI) / 180)
            ctx.drawImage(face, -r, -r)
            ctx.restore()
          }
          ctx.globalAlpha = 1
        }
        ctx.save()
        ctx.rotate((s.rotation * Math.PI) / 180)
        ctx.drawImage(face, -r, -r)
        ctx.restore()

        if (p.highlightIndex !== null || s.highlight > 0.01) {
          drawHighlight(ctx, r, N, p.highlightIndex ?? 0, s.rotation, s.highlight)
        }
        drawPegs(ctx, r, N, s.rotation, 'rgba(255,255,255,0.85)')
        if (rimRef.current) ctx.drawImage(rimRef.current, -r, -r)
        // Big lists: magnifier at the pointer keeps names readable — the winner sits in its centre when it stops.
        drawLens(ctx, r, p.names, p.colors, s.rotation, N > 0 ? segmentAtPointer(s.rotation, N) : 0)
        drawBulbs(ctx, r, now, p.celebrate ? 'win' : s.spinning ? 'spin' : 'idle', speed, p.colors)
      }
      gsap.ticker.add(render)
      return () => {
        gsap.ticker.remove(render)
        ro.disconnect()
        s.tl?.kill()
      }
    }, [])

    return (
      <div ref={containerRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
      </div>
    )
  }),
)
