import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useApp } from '../../store/appStore'

/** Always-visible reassurance that changes are stored on this computer. */
export function SaveIndicator() {
  const status = useApp((s) => s.saveStatus)
  const map = {
    saved: { icon: <CheckCircle2 size={15} />, text: 'All changes saved', cls: 'text-success' },
    saving: { icon: <Loader2 size={15} className="animate-spin" />, text: 'Saving…', cls: 'text-muted' },
    error: { icon: <AlertTriangle size={15} />, text: 'Not saved yet — retrying', cls: 'text-danger' },
    offline: { icon: <AlertTriangle size={15} />, text: 'Not saving — refresh the page', cls: 'text-danger' },
  }[status]
  return (
    <span role="status" aria-live="polite" className={`hidden items-center gap-1.5 text-xs font-semibold md:inline-flex ${map.cls}`}>
      {map.icon}
      {map.text}
    </span>
  )
}
