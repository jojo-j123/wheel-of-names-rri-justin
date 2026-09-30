import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useToasts } from '../../store/toastStore'

const icons = { success: CheckCircle2, error: XCircle, info: Info }
const tones = { success: 'text-success', error: 'text-danger', info: 'text-ink-soft' }

export function ToastHost() {
  const { toasts, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = icons[t.kind]
          return (
            <motion.button
              key={t.id}
              layout
              onClick={() => dismiss(t.id)}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-card/95 px-4 py-3 text-left text-sm font-medium text-ink shadow-lift backdrop-blur"
            >
              <Icon size={18} className={`shrink-0 ${tones[t.kind]}`} />
              <span>{t.message}</span>
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
