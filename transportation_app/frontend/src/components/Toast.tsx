import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from './ToastContext'

type ToastKind = 'success' | 'error'
interface ToastMessage {
  id: number
  kind: ToastKind
  message: string
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((items) => [...items, { id, kind, message }])
  }, [])

  useEffect(() => {
    if (!toasts.length) return
    const timers = toasts.map((toast) =>
      window.setTimeout(
        () => setToasts((items) => items.filter((item) => item.id !== toast.id)),
        4200,
      ),
    )
    return () => timers.forEach(window.clearTimeout)
  }, [toasts])

  const contextValue = useMemo(() => ({ showToast }), [showToast])
  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={`app-toast toast-${toast.kind}`} key={toast.id} role="status">
            <i className={`bi ${toast.kind === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}`} aria-hidden="true" />
            <span>{toast.message}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}>
              <i className="bi bi-x" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
