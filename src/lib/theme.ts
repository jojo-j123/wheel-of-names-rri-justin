/** App appearance for the admin screens (per device). The big screen has its own look per event. */
export type Appearance = 'light' | 'dark' | 'system'

const KEY = 'rri-appearance'

export function getAppearance(): Appearance {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function systemDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyAppearance(a: Appearance = getAppearance()) {
  const dark = a === 'dark' || (a === 'system' && systemDark())
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F0D0D' : '#F8F5F2')
}

export function setAppearance(a: Appearance) {
  try {
    localStorage.setItem(KEY, a)
  } catch {
    /* private mode — still applies for this visit */
  }
  applyAppearance(a)
}

/** Follow the OS when set to "system". */
export function watchSystemAppearance() {
  if (typeof matchMedia === 'undefined') return
  const mq = matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getAppearance() === 'system') applyAppearance('system')
  }
  // Safari < 14 only has the old addListener API.
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange)
  else (mq as unknown as { addListener?: (cb: () => void) => void }).addListener?.(onChange)
}
