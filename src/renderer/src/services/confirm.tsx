/**
 * @file 应用内确认弹窗（Promise 版）。
 *
 * 原因同 prompt：无边框窗口里 window.confirm 也会直接返回 false，
 * 所以删除收藏等需要二次确认的操作统一用这里的弹窗。
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ConfirmOptions {
  title: string
  detail?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue>({ confirm: async () => false })

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmContextValue['confirm']>((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setState(options)
    })
  }, [])

  const finish = useCallback((result: boolean) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setState(null)
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="modal-mask modal-mask--center" onClick={() => finish(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog__title">{state.title}</h2>
            {state.detail ? <p className="dialog__detail">{state.detail}</p> : null}
            <div className="dialog__actions">
              <button className="dialog__btn" onClick={() => finish(false)}>
                {state.cancelText ?? '取消'}
              </button>
              <button
                className={`dialog__btn ${state.danger ? 'dialog__btn--danger' : 'dialog__btn--primary'}`}
                onClick={() => finish(true)}
                autoFocus
              >
                {state.confirmText ?? '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

/** 获取 confirm 方法 */
export function useConfirm(): ConfirmContextValue['confirm'] {
  return useContext(ConfirmContext).confirm
}
