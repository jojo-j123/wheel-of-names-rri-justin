import type { Branding } from '../../types'
import { COLOR_PRESETS } from '../../lib/branding'
import { TextInput } from '../common/Form'
import { ColorPicker } from './ColorPicker'
import { LogoUploader } from './LogoUploader'

export function BrandingEditor({ value, onChange }: { value: Branding; onChange(b: Branding): void }) {
  const set = <K extends keyof Branding>(k: K, v: Branding[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-6">
      <LogoUploader logo={value.logo} companyName={value.companyName} onChange={(logo) => set('logo', logo)} />
      <TextInput label="Company name" value={value.companyName} onChange={(e) => set('companyName', e.target.value)} maxLength={60} />
      <div>
        <p className="mb-2 text-sm font-semibold">Quick colour themes</p>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((p) => (
            <button key={p.name} onClick={() => onChange({ ...value, ...p.colors })} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold transition hover:border-ink/25">
              <span className="flex -space-x-1">
                {[p.colors.primaryColor, p.colors.accentColor, p.colors.backgroundColor].map((c) => (
                  <span key={c} className="h-4 w-4 rounded-full ring-2 ring-white" style={{ background: c }} />
                ))}
              </span>
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ColorPicker label="Primary colour" description="Spin button, pointer, wheel" value={value.primaryColor} onChange={(v) => set('primaryColor', v)} />
        <ColorPicker label="Secondary colour" description="Wheel segments, rim" value={value.secondaryColor} onChange={(v) => set('secondaryColor', v)} />
        <ColorPicker label="Accent colour" description="Lights, highlights, confetti" value={value.accentColor} onChange={(v) => set('accentColor', v)} />
        <ColorPicker label="Background colour" description="Big-screen background" value={value.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
      </div>
    </div>
  )
}
