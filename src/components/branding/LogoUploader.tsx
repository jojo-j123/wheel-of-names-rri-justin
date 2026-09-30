import { ImagePlus, Loader2, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import { ACCEPTED_LOGO_TYPES, processImageFile } from '../../lib/image/imageUpload'
import { DEFAULT_LOGO } from '../../lib/branding'
import { Button } from '../common/Button'
import { BrandLogo } from './BrandLogo'

export function LogoUploader({ logo, companyName, onChange }: { logo: string; companyName: string; onChange(logo: string): void }) {
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
      <p className="mb-2 text-sm font-semibold">Current logo</p>
      <div className="flex flex-wrap items-center gap-5">
        <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-2xl border border-line bg-paper p-2">
          <BrandLogo logo={logo} companyName={companyName} className="max-h-full max-w-full" />
        </div>
        <div className="space-y-2">
          <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button icon={busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />} disabled={busy} onClick={() => ref.current?.click()}>
            Change logo
          </Button>
          {logo !== DEFAULT_LOGO && (
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
