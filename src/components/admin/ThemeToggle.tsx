import { Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { getAppearance, setAppearance, type Appearance } from '../../lib/theme'

const ORDER: Appearance[] = ['light', 'dark', 'system']
const META: Record<Appearance, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: 'Light' },
  dark: { icon: Moon, label: 'Dark' },
  system: { icon: Monitor, label: 'Auto' },
}

/** One-click appearance switch: Light → Dark → Auto (follows the computer). */
export function ThemeToggle() {
  const [value, setValue] = useState<Appearance>(getAppearance)
  const next = ORDER[(ORDER.indexOf(value) + 1) % ORDER.length]
  const { icon: Icon, label } = META[value]
  return (
    <button
      onClick={() => {
        setAppearance(next)
        setValue(next)
      }}
      className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-soft transition hover:bg-ink/5"
      title={`Appearance: ${label} — click for ${META[next].label}`}
      aria-label={`Appearance: ${label}. Switch to ${META[next].label}`}
    >
      <Icon size={18} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  )
}
