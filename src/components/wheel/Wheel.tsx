import { forwardRef, memo, useRef } from 'react'
import type { Branding, DrawPhase } from '../../types'
import { BrandLogo } from '../branding/BrandLogo'
import { WheelCanvas, type WheelHandle } from './WheelCanvas'
import { WheelEffects } from './WheelEffects'
import { WheelPointer } from './WheelPointer'
import type { WheelColors } from '../../lib/wheel/renderer'

interface Props {
  names: string[]
  colors: WheelColors
  branding: Branding
  phase: DrawPhase
  grand: boolean
  highlightIndex: number | null
  celebrate: boolean
  reducedMotion: boolean
  listSize: number
  onTick?(speed: number): void
  onPointerIndex?(index: number): void
  onSpeed?(speed: number): void
}

export const Wheel = memo(
  forwardRef<WheelHandle, Props>(function Wheel(props, ref) {
    const pointerRef = useRef<HTMLDivElement>(null)
    const { branding } = props
    return (
      <div className="relative aspect-square w-full" role="img" aria-label={`Prize wheel with ${props.names.length} names`}>
        <WheelEffects phase={props.phase} color={branding.primaryColor} grand={props.grand} />
        <WheelCanvas
          ref={ref}
          names={props.names}
          colors={props.colors}
          highlightIndex={props.highlightIndex}
          celebrate={props.celebrate}
          reducedMotion={props.reducedMotion}
          listSize={props.listSize}
          pointerEl={pointerRef}
          onTick={props.onTick}
          onPointerIndex={props.onPointerIndex}
          onSpeed={props.onSpeed}
        />
        <WheelPointer ref={pointerRef} color={branding.primaryColor} accent={branding.accentColor} />
        {/* Hub: static (the logo never rotates). */}
        <div className="absolute left-1/2 top-1/2 z-10 aspect-square w-[21%] -translate-x-1/2 -translate-y-1/2 rounded-full p-[5%] shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
          style={{ background: `linear-gradient(145deg, #ffffff, #d9d4d0)` }}>
          {branding.hubLogo === 'partner' && branding.partnerLogo ? (
            <BrandLogo logo={branding.partnerLogo} companyName={branding.partnerName || 'Partner'} variant="badge" className="h-full w-full ring-1 ring-black/10" />
          ) : (
            <BrandLogo logo={branding.logo} companyName={branding.companyName} variant="badge" className="h-full w-full ring-1 ring-black/10" />
          )}
        </div>
      </div>
    )
  }),
)
