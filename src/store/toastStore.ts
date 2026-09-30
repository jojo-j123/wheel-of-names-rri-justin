import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info'
export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastState {
  toasts: Toast[]
  push(kind: ToastKind, message: string, ms?: number): void
  dismiss(id: number): void
}

let seq = 0
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push(kind, message, ms = kind === 'error' ? 6000 : 3200) {
    const id = ++seq
    set({ toasts: [...get().toasts.slice(-3), { id, kind, message }] })
    setTimeout(() => get().dismiss(id), ms)
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },
}))

export const toast = {
  success: (m: string) => useToasts.getState().push('success', m),
  error: (m: string) => useToasts.getState().push('error', m),
  info: (m: string) => useToasts.getState().push('info', m),
}
