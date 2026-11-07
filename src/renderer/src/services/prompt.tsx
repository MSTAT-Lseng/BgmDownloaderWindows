/**
 * @file 应用内输入弹窗（Promise 版）。
 *
 * Electron 的无边框窗口不支持原生 window.prompt（直接返回 null），
 * 因此收藏命名改用应用内自绘弹窗，行为与原 App 的 Modal 一致。
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface PromptContextValue {
  /** 弹出输入框；用户取消时 resolve(null) */
  prompt: (options: { title: string; defaultValue?: string; placeholder?: string; confirmText?: string }) => Promise<string | null>
}

const PromptContext = createContext<PromptContextValue>({ prompt: async () => null })

interface PromptState {
  title: string
  defaultValue: string
  placeholder?: string
  confirmText: string
}

export function PromptProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PromptState | null>(null)
  const [value, setValue] = useState('')
  // 用 ref 保存最新的输入值：对话框按钮在渲染时绑定 onClick，
  // 若直接闭包读 value，快速输入后立刻回车/点击会拿到旧值
  const valueRef = useRef('')
  const resolverRef = useRef<((v: string | null) => void) | null>(null)

  const updateValue = useCallback((next: string) => {
    valueRef.current = next
    setValue(next)
  }, [])

  const prompt = useCallback<PromptContextValue['prompt']>((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      updateValue(options.defaultValue ?? '')
      setState({
        title: options.title,
        defaultValue: options.defaultValue ?? '',
        placeholder: options.placeholder,
        confirmText: options.confirmText ?? '保存'
      })
    })
  }, [updateValue])

  const finish = useCallback((result: string | null) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setState(null)
  }, [])

  return (
    <PromptContext.Provider value={{ prompt }}>
      {children}
      {state && (
        <div className="modal-mask modal-mask--center" onClick={() => finish(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog__title">{state.title}</h2>
            <input
              className="dialog__input"
              autoFocus
              value={value}
              placeholder={state.placeholder ?? '请输入名称'}
              onChange={(e) => updateValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finish(valueRef.current.trim() || null)
                if (e.key === 'Escape') finish(null)
              }}
            />
            <div className="dialog__actions">
              <button className="dialog__btn" onClick={() => finish(null)}>
                取消
              </button>
              <button
                className="dialog__btn dialog__btn--primary"
                onClick={() => finish(valueRef.current.trim() || null)}
                disabled={!value.trim()}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </PromptContext.Provider>
  )
}

/** 获取 prompt 方法 */
export function usePrompt(): PromptContextValue['prompt'] {
  return useContext(PromptContext).prompt
}
