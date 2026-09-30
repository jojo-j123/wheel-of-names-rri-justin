import { Check } from 'lucide-react'
import { SWATCHES, readableTextOn } from '../../lib/branding'

/** Visual colour choice: tap a swatch, or open the full picker. No hex codes required. */
export function ColorPicker({ label, description, value, onChange }: { label: string; description: string; value: string; onChange(v: string): void }) {
  return (
    <div className="rounded-2xl border border-line bg-field p-4">
      <div className="flex items-center gap-4">
        <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/10" style={{ background: value }} title="Open colour picker">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 h-full w-full opacity-0" aria-label={`${label}: pick any colour`} />
        </label>
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {SWATCHES.map((c) => {
          const active = c.toLowerCase() === value.toLowerCase()
          return (
            <button
              key={c}
              role="radio"
              aria-checked={active}
              aria-label={c}
              onClick={() => onChange(c)}
              className={`grid h-7 w-7 place-items-center rounded-full ring-1 ring-black/10 transition hover:scale-110 ${active ? 'ring-2 ring-ink ring-offset-2' : ''}`}
              style={{ background: c }}
            >
              {active && <Check size={14} style={{ color: readableTextOn(c) }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
