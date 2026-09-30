import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, Maximize, Minimize, OctagonX } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DrawController } from '../../hooks/useDrawController'
import type { useFullscreen } from '../../hooks/useFullscreen'
import { isSpinning, useDraw } from '../../store/drawStore'

/**
 * Presentation mode shows no admin UI. These three safety controls appear only while the
 * operator moves the mouse, and fade away after a moment. Keyboard: F fullscreen, S stop.
 */
export function PresenterControls({ ctrl, fs, onExit }: { ctrl: DrawController; fs: ReturnType<typeof useFullscreen>; onExit(): void }) {
  const [visible, setVisible] = useState(false)
  const phase = useDraw((s) => s.phase)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const show = () => {
      setVisible(true)
      clearTimeout(t)
      t = setTimeout(() => setVisible(false), 2500)
    }
    window.addEventListener('mousemove', show)
    window.addEventListener('touchstart', show)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousemove', show)
      window.removeEventListener('touchstart', show)
    }
  }, [])
  const cls = 'grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white/80 ring-1 ring-white/15 backdrop-blur transition hover:bg-black/70 hover:text-white'
  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="fixed bottom-4 right-4 z-[65] flex gap-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
          {isSpinning(phase) && (
            <button className={`${cls} !bg-[#c62f2f]`} onClick={ctrl.emergencyStop} aria-label="Emergency stop" title="Emergency stop (S)">
              <OctagonX size={20} />
            </button>
          )}
          {fs.supported && (
            <button className={cls} onClick={() => void fs.toggle()} aria-label={fs.active ? 'Exit fullscreen' : 'Fullscreen'} title="Fullscreen (F)">
              {fs.active ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          )}
          <button className={cls} onClick={onExit} aria-label="Exit presentation" title="Exit presentation">
            <LogOut size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
