import { forwardRef } from 'react'

/** Pointer at 12 o'clock. Its rotation (tick "kick") is driven directly by the wheel loop, not React. */
export const WheelPointer = forwardRef<HTMLDivElement, { color: string; accent: string }>(function WheelPointer({ color, accent }, ref) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-20 w-[9%] -translate-x-1/2 -translate-y-[38%]">
      <div ref={ref} style={{ transformOrigin: '50% 22%' }} className="will-change-transform">
        <svg viewBox="0 0 100 140" className="block w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)]">
          <defs>
            <linearGradient id="ptr-body" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={color} />
              <stop offset="1" stopColor={color} stopOpacity="0.78" />
            </linearGradient>
          </defs>
          <path d="M50 136 L14 52 A40 40 0 1 1 86 52 Z" fill="url(#ptr-body)" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
          <circle cx="50" cy="38" r="14" fill={accent} stroke="#fff" strokeWidth="3" />
          <path d="M30 22 Q50 8 70 22" stroke="rgba(255,255,255,0.45)" strokeWidth="4" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
})
