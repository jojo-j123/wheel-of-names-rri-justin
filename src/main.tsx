import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/sora'
import './index.css'
import App from './App.tsx'
import { applyAppearance, watchSystemAppearance } from './lib/theme'
import { installStaleChunkRecovery, reportError } from './lib/errorReport'

// Older iPhones (iOS < 15.4) lack structuredClone; event data is plain JSON, so this fallback is exact.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (<T,>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T))) as typeof structuredClone
}

applyAppearance()
watchSystemAppearance()
installStaleChunkRecovery()
window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'window'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
