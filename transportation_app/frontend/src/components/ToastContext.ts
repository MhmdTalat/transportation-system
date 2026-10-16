import { createContext, useContext } from 'react'

type ToastKind = 'success' | 'error'
export interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
