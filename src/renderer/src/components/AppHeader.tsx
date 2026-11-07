/**
 * @file 通用顶部标题栏：居中标题，可选左侧返回按钮与右侧功能图标。
 * 对应原 App 的 components/app-header.tsx。
 */

import type { ReactNode } from 'react'
import { Icon } from './Icon'

interface AppHeaderProps {
  title: string
  /** 右侧功能图标，传入才渲染 */
  icon?: ReactNode
  onIconPress?: () => void
  /** 是否显示左侧返回按钮 */
  showBack?: boolean
  onBackPress?: () => void
  /** 右侧额外内容（例如多个按钮） */
  extra?: ReactNode
}

/** 通用标题栏；返回键在左、功能图标在右，标题始终居中 */
export function AppHeader({ title, icon, onIconPress, showBack, onBackPress, extra }: AppHeaderProps) {
  return (
    <header className="app-header">
      {showBack ? (
        <button className="app-header__back" onClick={onBackPress} title="返回" aria-label="返回">
          <Icon name="chevron-back" size={22} />
        </button>
      ) : null}

      <h1 className="app-header__title" title={title}>
        {title}
      </h1>

      <div className="app-header__right">
        {extra}
        {icon ? (
          <button className="app-header__action" onClick={onIconPress} aria-label="更多操作">
            {icon}
          </button>
        ) : null}
      </div>
    </header>
  )
}
