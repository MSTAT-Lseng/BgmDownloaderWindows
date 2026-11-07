/**
 * @file 窗口标题栏（桌面端特有）。
 *
 * 用 frame: false 的无边框窗口 + 自绘标题栏，让深色主题贯穿到最顶部；
 * 同时保留系统的拖动 / 双击最大化 / 三个窗口按钮行为。
 */

import { useEffect, useState } from 'react'
import { getApi } from '../services/bridge'

export function WindowTitlebar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    // 用容器宽度变化近似监听最大化状态，避免额外的 IPC 通道
    const onResize = () => {
      setMaximized(window.outerWidth >= window.screen.availWidth - 2)
    }
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const api = getApi()

  return (
    <div className="titlebar">
      <div className="titlebar__drag">
        <img className="titlebar__logo" src="./images/appicon.png" alt="" />
        <span className="titlebar__title">番剧下载</span>
      </div>

      <div className="titlebar__controls">
        <button className="titlebar__btn" title="最小化" onClick={() => void api.window.minimize()}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          className="titlebar__btn"
          title={maximized ? '还原' : '最大化'}
          onClick={async () => setMaximized(await api.window.toggleMaximize())}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
              <rect x="0.5" y="2.5" width="7" height="7" />
              <path d="M2.5 2.5V0.5h7v7h-2" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          )}
        </button>
        <button className="titlebar__btn titlebar__btn--close" title="关闭" onClick={() => void api.window.close()}>
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor">
            <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
          </svg>
        </button>
      </div>
    </div>
  )
}
