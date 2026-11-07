/**
 * @file 极简的路由 / 导航栈，替代 expo-router。
 *
 * 页面数量很少（标签页 + 几个二级页面），用一个栈 + history 状态即可覆盖：
 *  - 标签页切换：重置为「标签根」
 *  - 二级页面：push / back
 *  - 内置浏览器页：由主进程承载 WebContentsView，这里只负责顶栏与容器区域
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/** 标签页标识 */
export type TabKey = 'calendar' | 'source' | 'favorite'

/** 可入栈的页面 */
export type Route =
  | { name: 'tabs'; tab: TabKey }
  | { name: 'search'; q: string }
  | { name: 'webview'; url: string; type: 'default' | 'sources' | 'player'; userAgent?: string; title?: string }
  | { name: 'settings' }
  | { name: 'about' }
  | { name: 'more-search' }

/** 导航上下文 */
interface NavigationContextValue {
  route: Route
  stack: Route[]
  /** 当前是否还有可返回的上一页 */
  canGoBack: boolean
  /** 当前选中的标签页 */
  activeTab: TabKey
  push: (route: Route) => void
  replace: (route: Route) => void
  back: () => void
  /** 切换标签页（会把导航栈重置为该标签根） */
  switchTab: (tab: TabKey) => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

const TABS_ROOT: Route = { name: 'tabs', tab: 'calendar' }

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([TABS_ROOT])

  const route = stack[stack.length - 1]

  const push = useCallback((next: Route) => {
    setStack((prev) => [...prev, next])
  }, [])

  const replace = useCallback((next: Route) => {
    setStack((prev) => [...prev.slice(0, -1), next])
  }, [])

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const switchTab = useCallback((tab: TabKey) => {
    setStack([{ name: 'tabs', tab }])
  }, [])

  const activeTab: TabKey = useMemo(() => {
    // 二级页面上，底部标签栏保持显示，选中项跟随它来源的标签
    for (let i = stack.length - 1; i >= 0; i--) {
      const r = stack[i]
      if (r.name === 'tabs') return r.tab
    }
    return 'calendar'
  }, [stack])

  const value = useMemo<NavigationContextValue>(
    () => ({ route, stack, canGoBack: stack.length > 1, activeTab, push, replace, back, switchTab }),
    [route, stack, activeTab, push, replace, back, switchTab]
  )

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

/** 读取导航上下文 */
export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigation 必须在 NavigationProvider 内使用')
  return ctx
}
