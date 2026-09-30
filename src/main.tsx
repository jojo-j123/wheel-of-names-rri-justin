import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/sora'
import './index.css'
import App from './App.tsx'
import { applyAppearance, watchSystemAppearance } from './lib/theme'
import { installStaleChunkRecovery, reportError } from './lib/errorReport'

applyAppearance()
watchSystemAppearance()
installStaleChunkRecovery()
window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'window'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
