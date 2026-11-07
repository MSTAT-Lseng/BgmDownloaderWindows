/**
 * @file 全局轻提示（Toast），替代原 App 的 react-native-root-toast。
 *
 * 用 Context 暴露 toast(msg)，任意组件都能调用；渲染在根节点，不会被页面滚动裁剪。
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface ToastState {
  id: number
  message: string
}

interface ToastContextValue {
  show: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<number | null>(null)

  const show = useCallback((message: string, duration = 1800) => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setToast({ id: Date.now(), message })
    timerRef.current = window.setTimeout(() => setToast(null), duration)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div className="toast" key={toast.id} role="status">
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

/** 获取 toast 方法 */
export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}
