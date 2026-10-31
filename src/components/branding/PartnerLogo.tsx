import { memo } from 'react'

/**
 * Partner/client logo on a card: logos come in every shape and colour. White (default) keeps dark wordmarks
 * readable on the dark big screen; black suits logos made for dark backgrounds. Shown as-is, never stretched.
 */
export const PartnerLogo = memo(function PartnerLogo({ logo, name, dark = false, className = '' }: { logo: string; name?: string; dark?: boolean; className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-2xl px-[0.6em] py-[0.35em] shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${dark ? 'bg-black ring-1 ring-white/15' : 'bg-white ring-1 ring-black/5'} ${className}`}
    >
      <img src={logo} alt={`${name || 'Partner'} logo`} draggable={false} className="h-full w-auto max-w-[12em] select-none object-contain" />
    </div>
  )
})
