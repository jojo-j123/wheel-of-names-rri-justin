import { useEffect, useState } from 'react'
import type { ReducedMotionSetting } from '../types'

export function useSystemReducedMotion(): boolean {
  const [v, setV] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setV(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return v
}

export function useReducedMotion(setting: ReducedMotionSetting): boolean {
  const system = useSystemReducedMotion()
  return setting === 'on' || (setting === 'system' && system)
}
