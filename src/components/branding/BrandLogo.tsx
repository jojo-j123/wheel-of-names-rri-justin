import { memo } from 'react'
import { DEFAULT_LOGO } from '../../lib/branding'

interface Props {
  logo: string
  companyName: string
  /** 'full' shows the whole image untouched. 'badge' frames it in a circle (for hubs / dark stage). */
  variant?: 'full' | 'badge'
  className?: string
}

/**
 * The uploaded RRI logo is displayed as-is — never stretched, recoloured or rotated.
 * For the circular badge we only frame the default file around its own white disc
 * (the mark itself is untouched); custom logos are letter-boxed on white.
 */
export const BrandLogo = memo(function BrandLogo({ logo, companyName, variant = 'full', className = '' }: Props) {
  if (variant === 'badge') {
    const isDefault = logo === DEFAULT_LOGO
    return (
      <div className={`relative overflow-hidden rounded-full bg-white ${className}`}>
        {isDefault ? (
          <img
            src={logo}
            alt={`${companyName} logo`}
            draggable={false}
            className="absolute max-w-none select-none"
            // Default file: 1179×1314 with the logo disc centred at (590, 618), radius ≈ 388.
            style={{ width: '152%', height: 'auto', left: '-26.06%', top: '-29.67%' }}
          />
        ) : (
          <img src={logo} alt={`${companyName} logo`} draggable={false} className="h-full w-full select-none object-contain p-[14%]" />
        )}
      </div>
    )
  }
  return <img src={logo} alt={`${companyName} logo`} draggable={false} className={`select-none object-contain ${className}`} />
})
