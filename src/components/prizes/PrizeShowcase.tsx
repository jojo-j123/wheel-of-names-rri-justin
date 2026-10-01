import { AnimatePresence, motion } from 'framer-motion'
import { Gift } from 'lucide-react'
import type { Branding, Prize } from '../../types'
import { mix, rgba } from '../../lib/branding'

interface Props {
  prize: Prize | null
  remaining: number
  branding: Branding
  big: boolean
  emptyText: string
}

/** The "now drawing" prize — top of the visual hierarchy before a draw. */
export function PrizeShowcase({ prize, remaining, branding, big, emptyText }: Props) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={prize?.id ?? 'none'}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="flex w-full flex-col items-center text-center wide:items-start wide:text-left"
      >
        <p className="stage-kicker text-[clamp(0.7rem,1.2vh,1rem)]" style={{ color: branding.stageTheme === 'light' ? mix(branding.accentColor, '#000000', 0.55) : branding.accentColor }}>
          {prize ? 'Now drawing' : 'Ready to draw'}
        </p>
        {prize ? (
          <>
            <div
              className={`relative mt-[1.6vh] hidden overflow-hidden rounded-[28px] ring-1 ring-fg/12 wide:block ${big ? 'w-[min(26vw,44vh)]' : 'w-[min(24vw,34vh)]'} aspect-square`}
              style={{ boxShadow: `0 40px 80px -30px ${rgba(branding.primaryColor, 0.55)}, 0 0 0 1px rgba(255,255,255,0.04)` }}
            >
              {prize.image ? (
                <img src={prize.image} alt={prize.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center" style={{ background: `radial-gradient(circle at 30% 20%, ${branding.primaryColor}, ${branding.secondaryColor})` }}>
                  <Gift className="h-1/3 w-1/3 text-white/85" strokeWidth={1.4} />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/5" />
            </div>
            <div className={`mt-[1.8vh] flex items-center gap-3 wide:hidden ${big ? 'phone:hidden' : ''}`}>
              {prize.image && <img src={prize.image} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-fg/15" />}
            </div>
            <h2 className={`mt-[1vh] font-display font-bold leading-[1.05] tracking-tight ${big ? 'text-[clamp(1.8rem,4.4vh,4.2rem)]' : 'text-[clamp(1.5rem,3.6vh,3rem)]'}`}>
              {prize.name}
            </h2>
            {(prize.description || prize.sponsor) && (
              <p className="mt-1 text-[clamp(0.9rem,1.7vh,1.35rem)] text-fg/60">
                {prize.description}
                {prize.description && prize.sponsor ? ' · ' : ''}
                {prize.sponsor ? `Sponsored by ${prize.sponsor}` : ''}
              </p>
            )}
            {prize.quantity > 1 && (
              <p className="mt-[1.2vh] inline-flex items-center gap-2 rounded-full bg-fg/8 px-3 py-1 text-[clamp(0.75rem,1.4vh,1.05rem)] font-semibold text-fg/80 ring-1 ring-fg/10">
                {remaining} of {prize.quantity} left
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 max-w-sm text-fg/55">{emptyText}</p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
