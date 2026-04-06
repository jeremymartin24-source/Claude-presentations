import { useState, useCallback, useEffect } from 'react'
import { createContext, useContext } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'

type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-green-900 border-green-500 text-green-100',
  error: 'bg-red-950 border-unoh-red text-red-100',
  info: 'bg-gray-900 border-unoh-red text-white',
  warning: 'bg-yellow-900 border-yellow-500 text-yellow-100',
}

const variantIcons: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className={clsx(
                'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl pointer-events-auto',
                variantStyles[toast.variant]
              )}
            >
              <span className="text-lg font-bold flex-shrink-0">{variantIcons[toast.variant]}</span>
              <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

// Standalone Toast component for direct use
export function ToastMessage({ message, variant = 'info' }: { message: string; variant?: ToastVariant }) {
  return (
    <div className={clsx(
      'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl',
      variantStyles[variant]
    )}>
      <span className="text-lg font-bold flex-shrink-0">{variantIcons[variant]}</span>
      <span className="text-sm font-medium">{message}</span>
    </div>
  )
}
