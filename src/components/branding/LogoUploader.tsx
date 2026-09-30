import { ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { ACCEPTED_LOGO_TYPES, processImageFile } from '../../lib/image/imageUpload'
import { DEFAULT_LOGO } from '../../lib/branding'
import { Button } from '../common/Button'
import { BrandLogo } from './BrandLogo'

interface Props {
  logo: string | undefined
  companyName: string
  onChange(logo: string | undefined): void
  /** 'main' = host logo (can reset to RRI). 'partner' = optional second logo (can be removed). */
  kind?: 'main' | 'partner'
}

export function LogoUploader({ logo, companyName, onChange, kind = 'main' }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function onFile(file?: File) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      // Logos are kept byte-for-byte when reasonably sized so they are never altered.
      onChange(await processImageFile(file, { maxSize: 1200, accept: ACCEPTED_LOGO_TYPES, keepOriginalUnder: 2 * 1024 * 1024 }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That logo couldn’t be used.')
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{kind === 'main' ? 'Current logo' : 'Partner / client logo (optional)'}</p>
      <div className="flex flex-wrap items-center gap-5">
        <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-2xl border border-line bg-white p-2">
          {logo ? (
            <BrandLogo logo={logo} companyName={companyName} className="max-h-full max-w-full" />
          ) : (
            <span className="px-2 text-center text-xs font-semibold text-[#6e6562]">No partner logo</span>
          )}
        </div>
        <div className="space-y-2">
          <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button icon={busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />} disabled={busy} onClick={() => ref.current?.click()}>
            {kind === 'main' ? 'Change logo' : logo ? 'Change partner logo' : 'Add partner logo'}
          </Button>
          {kind === 'partner' && logo && (
            <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => onChange(undefined)}>
              Remove partner logo
            </Button>
          )}
          {kind === 'main' && logo !== DEFAULT_LOGO && (
            <Button variant="ghost" size="sm" icon={<RotateCcw size={15} />} onClick={() => onChange(DEFAULT_LOGO)}>
              Use the RRI logo
            </Button>
          )}
          <p className="text-xs text-muted">PNG, JPG, WEBP or SVG. Shown as-is, never stretched.</p>
        </div>
      </div>
      {error && <p className="mt-3 rounded-xl bg-danger/8 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
    </div>
  )
}
