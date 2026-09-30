import { useEffect, useRef } from 'react'
import type { Branding } from '../../types'
import { mix, rgba } from '../../lib/branding'
import { renderFace } from '../../lib/wheel/renderer'
import { DEMO_NAMES } from '../../lib/event/demo'
import { BrandLogo } from './BrandLogo'

/** Miniature live stage so colour choices are seen in context. */
export function BrandPreview({ branding, eventName }: { branding: Branding; eventName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    renderFace(c, 440, DEMO_NAMES.slice(0, 12), { primary: branding.primaryColor, secondary: branding.secondaryColor, accent: branding.accentColor })
  }, [branding.primaryColor, branding.secondaryColor, branding.accentColor])
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 shadow-lift"
      style={{
        color: branding.textColor,
        background: `radial-gradient(ellipse 80% 60% at 70% 60%, ${rgba(branding.primaryColor, 0.2)}, transparent 60%), linear-gradient(180deg, ${mix(branding.backgroundColor, '#ffffff', 0.04)}, ${branding.backgroundColor})`,
      }}
    >
      <div className="flex items-center gap-3">
        <BrandLogo logo={branding.logo} companyName={branding.companyName} variant="badge" className="h-10 w-10" />
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.3em] opacity-60">{branding.companyName} presents</p>
          <p className="truncate font-display font-semibold">{eventName}</p>
        </div>
      </div>
      <div className="relative mx-auto mt-5 aspect-square w-[70%]">
        <canvas ref={canvasRef} className="h-full w-full" />
        <div className="absolute left-1/2 top-1/2 aspect-square w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-[4%] shadow-lg">
          <BrandLogo logo={branding.logo} companyName={branding.companyName} variant="badge" className="h-full w-full" />
        </div>
        <div className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 -translate-y-1 border-x-[10px] border-t-[18px] border-x-transparent" style={{ borderTopColor: branding.primaryColor }} />
      </div>
      <div className="mt-5 flex justify-center">
        <span className="rounded-full px-8 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-lg" style={{ background: branding.primaryColor }}>
          Spin
        </span>
      </div>
      <p className="mt-3 text-center text-xs" style={{ color: branding.accentColor }}>
        Accent colour · lights & highlights
      </p>
    </div>
  )
}
