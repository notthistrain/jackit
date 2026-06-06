import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { toastProvider } from './toast-provider.variants'

interface ToastItem {
  id: number
  type: 'success' | 'error'
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx)
    throw new Error('useToast must be used within ToastProvider')
  return ctx
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const { container, toast, message, closeButton } = toastProvider()

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const add = useCallback(
    (type: ToastItem['type'], msg: string) => {
      const id = nextId++
      setToasts(prev => [...prev, { id, type, message: msg }])
      const duration = type === 'error' ? 4000 : 2000
      timers.current.set(id, setTimeout(remove, duration, id))
    },
    [remove],
  )

  const success = useCallback((msg: string) => add('success', msg), [add])
  const error = useCallback((msg: string) => add('error', msg), [add])

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div className={container()}>
        {toasts.map(t => (
          <div key={t.id} className={toast({ tone: t.type })}>
            <span className={message()}>{t.message}</span>
            <button onClick={() => remove(t.id)} className={closeButton()}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
