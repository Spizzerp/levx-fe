import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  /** Optional Solana tx signature — renders as explorer link */
  txSig?: string
}

interface ToastState {
  toasts: Toast[]
  add: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

let _id = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = String(++_id)
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    // Auto-dismiss after 5s
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 5000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Shorthand helpers */
export const toast = {
  success: (title: string, opts?: { message?: string; txSig?: string }) =>
    useToastStore.getState().add({ type: 'success', title, ...opts }),
  error: (title: string, opts?: { message?: string }) =>
    useToastStore.getState().add({ type: 'error', title, ...opts }),
  info: (title: string, opts?: { message?: string }) =>
    useToastStore.getState().add({ type: 'info', title, ...opts }),
}
