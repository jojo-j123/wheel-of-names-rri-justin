import { memo } from 'react'

/**
 * Partner/client logo on a white card: logos come in every shape and colour, and a white card keeps
 * dark wordmarks readable on the dark big screen. Shown as-is (object-contain), never stretched.
 */
export const PartnerLogo = memo(function PartnerLogo({ logo, name, className = '' }: { logo: string; name?: string; className?: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-white px-[0.6em] py-[0.35em] shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-black/5 ${className}`}>
      <img src={logo} alt={`${name || 'Partner'} logo`} draggable={false} className="h-full w-auto max-w-[12em] select-none object-contain" />
    </div>
  )
})
