import { createContext, useCallback, useContext, useRef, useState } from 'react'

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
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const add = useCallback(
    (type: ToastItem['type'], message: string) => {
      const id = nextId++
      setToasts((prev) => [...prev, { id, type, message }])
      const duration = type === 'error' ? 4000 : 2000
      timers.current.set(id, setTimeout(() => remove(id), duration))
    },
    [remove],
  )

  const success = useCallback((message: string) => add('success', message), [add])
  const error = useCallback((message: string) => add('error', message), [add])

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-[360px]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-[4px] text-xs shadow-md border animate-in slide-in-from-right ${
              t.type === 'error'
                ? 'bg-danger-light border-danger/30 text-danger'
                : 'bg-success-light border-success/30 text-success'
            }`}
          >
            <span className="flex-1 break-all">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100 text-[10px]"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
