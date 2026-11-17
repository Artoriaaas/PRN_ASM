import { useEffect, useCallback, createContext, useContext, useState, type ReactNode } from 'react'

type ToastItem = {
  id: number
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
  duration?: number
}

type ToastContextValue = {
  toast: (message: string, type?: ToastItem['type'], duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastItem['type'] = 'info', duration = 3000) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, type, duration }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <ToastItem key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    if (!item.duration) return
    const id = setTimeout(() => onDismiss(item.id), item.duration)
    return () => clearTimeout(id)
  }, [item.id, item.duration, onDismiss])

  return (
    <div className={`toast toast-${item.type}`} role="status">
      <span>{item.message}</span>
      <button type="button" className="toast-close" onClick={() => onDismiss(item.id)} aria-label="Đóng">
        ×
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast phải dùng trong ToastProvider')
  return ctx.toast
}

