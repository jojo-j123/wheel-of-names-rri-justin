import type { Branding } from '../types'

/** Exact uploaded RRI logo, served untouched from /public. */
export const DEFAULT_LOGO = '/brand/rri-logo.jpeg'

/** RRI defaults — sampled from the official logo. Change here to rebrand the defaults. */
export const DEFAULT_BRANDING: Branding = {
  companyName: 'RRI',
  logo: DEFAULT_LOGO,
  primaryColor: '#D0453A',
  secondaryColor: '#1F1B1B',
  accentColor: '#E9C893',
  backgroundColor: '#0E0B0B',
  textColor: '#FFFFFF',
  stageTheme: 'dark',
}

export const COLOR_PRESETS: { name: string; colors: Pick<Branding, 'primaryColor' | 'secondaryColor' | 'accentColor' | 'backgroundColor'> }[] = [
  { name: 'RRI Red', colors: { primaryColor: '#D0453A', secondaryColor: '#1F1B1B', accentColor: '#E9C893', backgroundColor: '#0E0B0B' } },
  { name: 'Midnight', colors: { primaryColor: '#3B6FF5', secondaryColor: '#151B2E', accentColor: '#8FD3FF', backgroundColor: '#070B16' } },
  { name: 'Emerald', colors: { primaryColor: '#159A6E', secondaryColor: '#12211C', accentColor: '#E4C67A', backgroundColor: '#07110D' } },
  { name: 'Royal', colors: { primaryColor: '#7B4AE2', secondaryColor: '#1C1530', accentColor: '#F2C46D', backgroundColor: '#0C0816' } },
  { name: 'Festive', colors: { primaryColor: '#C8243A', secondaryColor: '#0F3D2E', accentColor: '#F4D27A', backgroundColor: '#0A100D' } },
  { name: 'Graphite', colors: { primaryColor: '#F5A524', secondaryColor: '#232323', accentColor: '#FFFFFF', backgroundColor: '#0D0D0D' } },
]

export const SWATCHES = [
  '#D0453A', '#C8243A', '#E4572E', '#F5A524', '#E9C893', '#159A6E', '#0E9FA8',
  '#3B6FF5', '#7B4AE2', '#D63384', '#FFFFFF', '#B8B2AE', '#4A4545', '#1F1B1B', '#0E0B0B',
]

export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = isHexColor(hex) ? hex.slice(1) : '000000'
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Mix two hex colors. t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Relative luminance (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function readableTextOn(hex: string): string {
  return luminance(hex) > 0.45 ? '#1A1616' : '#FFFFFF'
}

/** CSS variables applied at the root of stage/admin so every component follows the brand. */
/** Colors for the live stage in the chosen big-screen look. */
export function stagePalette(b: Branding) {
  if (b.stageTheme === 'light') {
    return { bg: '#F6F2EE', text: '#1A1616', fg: '#1A1616', bar: 'rgba(255,255,255,0.7)', glow: 0.1 }
  }
  return { bg: b.backgroundColor, text: b.textColor, fg: '#FFFFFF', bar: 'rgba(0,0,0,0.35)', glow: 0.16 }
}

export function brandCssVars(b: Branding): Record<string, string> {
  return {
    '--brand-primary': b.primaryColor,
    '--brand-secondary': b.secondaryColor,
    '--brand-accent': b.accentColor,
    '--brand-bg': b.backgroundColor,
    '--brand-text': b.textColor,
    '--brand-on-primary': readableTextOn(b.primaryColor),
  }
}
