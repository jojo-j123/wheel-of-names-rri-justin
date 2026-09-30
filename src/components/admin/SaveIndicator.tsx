import { AlertTriangle, CheckCircle2, Cloud, CloudOff, Loader2 } from 'lucide-react'
import { useApp } from '../../store/appStore'

/** Always-visible reassurance: saved on this device, and synced to the cloud when connected. */
export function SaveIndicator() {
  const status = useApp((s) => s.saveStatus)
  const cloud = useApp((s) => s.cloudStatus)
  let view: { icon: React.ReactNode; text: string; cls: string }
  if (status === 'error') view = { icon: <AlertTriangle size={15} />, text: 'Not saved yet — retrying', cls: 'text-danger' }
  else if (status === 'offline') view = { icon: <AlertTriangle size={15} />, text: 'Not saving — refresh the page', cls: 'text-danger' }
  else if (status === 'saving' || cloud === 'syncing' || cloud === 'connecting')
    view = { icon: <Loader2 size={15} className="animate-spin" />, text: cloud === 'disabled' ? 'Saving…' : 'Saving to cloud…', cls: 'text-muted' }
  else if (cloud === 'synced') view = { icon: <Cloud size={15} />, text: 'Saved to cloud', cls: 'text-success' }
  else if (cloud === 'offline') view = { icon: <CloudOff size={15} />, text: 'Offline — saved on this device, will sync', cls: 'text-amber-700 dark:text-amber-400' }
  else view = { icon: <CheckCircle2 size={15} />, text: 'Saved on this device', cls: 'text-success' }
  return (
    <span role="status" aria-live="polite" className={`hidden items-center gap-1.5 text-xs font-semibold md:inline-flex ${view.cls}`}>
      {view.icon}
      {view.text}
    </span>
  )
}
