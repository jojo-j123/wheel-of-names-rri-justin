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
      <div>
        <p className="mb-2 text-sm font-semibold">Big-screen look</p>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Big-screen look">
          {(
            [
              { v: 'dark', title: 'Dark', text: 'Best for projectors, LED walls and evening events', bg: '#0E0B0B', fg: '#FFFFFF' },
              { v: 'light', title: 'Light', text: 'For bright rooms and daytime venues', bg: '#F6F2EE', fg: '#1A1616' },
            ] as const
          ).map((o) => {
            const active = (value.stageTheme ?? 'dark') === o.v
            return (
              <button
                key={o.v}
                role="radio"
                aria-checked={active}
                onClick={() => set('stageTheme', o.v)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? 'border-brand ring-4 ring-brand/15' : 'border-line hover:border-ink/25'} bg-field`}
              >
                <span className="grid h-12 w-16 shrink-0 place-items-center rounded-lg ring-1 ring-black/10" style={{ background: o.bg }}>
                  <span className="h-6 w-6 rounded-full" style={{ background: value.primaryColor, boxShadow: `0 0 0 3px ${o.fg}22` }} />
                </span>
                <span>
                  <span className="block font-semibold">{o.title}</span>
                  <span className="block text-xs text-muted">{o.text}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <TextInput label="Company name" value={value.companyName} onChange={(e) => set('companyName', e.target.value)} maxLength={60} />
      <div>
        <p className="mb-2 text-sm font-semibold">Quick colour themes</p>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((p) => (
            <button key={p.name} onClick={() => onChange({ ...value, ...p.colors })} className="flex items-center gap-2 rounded-xl border border-line bg-field px-3 py-2 text-sm font-semibold transition hover:border-ink/25">
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
        <ColorPicker label="Background colour" description={value.stageTheme === "light" ? "Used in the dark big-screen look" : "Big-screen background"} value={value.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
      </div>
    </div>
  )
}
