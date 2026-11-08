/**
 * @file 内置浏览器页：顶栏 + 原生 WebContentsView 容器。
 *
 * 与原 Expo 版 webview.tsx 对应。页面内容本身由主进程的 WebContentsView 渲染，
 * 这里只负责：
 *  - 把容器的实际位置 / 尺寸同步给主进程（原生视图浮在渲染进程之上）
 *  - 顶栏右侧按钮：sources 模式外部打开，player 模式切换收藏
 *  - 加载进度条、错误遮罩、前进后退
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { OpenWebviewOptions, WebviewState } from '@shared/types'
import { Icon } from '../components/Icon'
import { useNavigation } from '../navigation'
import { getApi } from '../services/bridge'
import { usePrompt } from '../services/prompt'

interface WebviewScreenProps {
  url: string
  type: 'default' | 'sources' | 'player'
  userAgent?: string
  title?: string
}

export function WebviewScreen({ url, type, userAgent, title }: WebviewScreenProps) {
  const { back } = useNavigation()
  const prompt = usePrompt()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<WebviewState | null>(null)
  const [progress, setProgress] = useState(0)
  // 加载结束后让进度条多停留一小会儿，才能看到它补满并淡出
  const [barVisible, setBarVisible] = useState(false)

  /** 把容器区域同步给主进程的原生视图 */
  const syncBounds = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    void getApi().webview.setBounds({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    })
  }, [])

  // 打开 / 切换到该页面时加载目标地址
  useEffect(() => {
    const options: OpenWebviewOptions = { url, type, userAgent, title }
    let cancelled = false

    getApi()
      .webview.open(options)
      .then((initial) => {
        if (!cancelled) setState(initial)
      })
      .catch((e) => console.error('打开内置浏览器失败:', e))

    return () => {
      cancelled = true
    }
  }, [url, type, userAgent, title])

  // 订阅主进程推送的浏览器状态。
  // 注意：页面切换会让本组件重新挂载，挂载期间可能已经错过若干次推送，
  // 所以订阅后立刻再取一次当前状态，避免进度条停在旧值。
  useEffect(() => {
    const api = getApi()
    const off = api.on('webview:state', (next) => {
      setState(next)
    })
    void api.webview
      .getState()
      .then((current) => {
        if (current) setState(current)
      })
      .catch(() => {})
    return off
  }, [])

  // 进度始终从 state 派生，保证任何来源（open 结果 / 推送 / 主动查询）都能更新进度条
  useEffect(() => {
    if (state) setProgress(state.progress)
  }, [state])

  /**
   * 进度条的显示时机。
   *
   * 关键：loading 变 false 时进度可能还停在 30% 左右（主进程随后才补满），
   * 所以不能以 loading 作为隐藏依据，否则进度条会在补满动画开始前就消失。
   * 正确做法是「只要还在加载，或进度尚未到 100%，就一直显示」。
   */
  useEffect(() => {
    if (!state) return

    if (state.loading || state.progress < 1) {
      setBarVisible(true)
      return
    }

    // 已到 100%：停留一小会儿让淡出动画走完再卸载
    const timer = window.setTimeout(() => setBarVisible(false), 380)
    return () => window.clearTimeout(timer)
  }, [state])

  // 打开后主动同步一次收藏状态，保证星标一开始就是准确的
  useEffect(() => {
    if (type !== 'player') return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void getApi()
        .webview.syncFavorite()
        .then((next) => {
          if (!cancelled && next) setState(next)
        })
    }, 600)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [type, url])

  // 布局变化时同步容器位置：窗口缩放、顶栏高度变化等都会影响
  useLayoutEffect(() => {
    syncBounds()
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(() => syncBounds())
    observer.observe(el)
    window.addEventListener('resize', syncBounds)

    // 窗口从最大化 / 全屏恢复时布局会稍晚稳定，补一次
    const timer = window.setTimeout(syncBounds, 120)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncBounds)
      window.clearTimeout(timer)
    }
  }, [syncBounds])

  // 离开该页面时关闭原生视图（返回时由下一次 open 重新创建）
  useEffect(() => {
    return () => {
      void getApi().webview.setVisible(false)
    }
  }, [])

  /** 返回上一页：先退出内置浏览器视图，再退导航栈 */
  const handleBack = useCallback(() => {
    void getApi().webview.close()
    back()
  }, [back])

  /** 顶栏右侧按钮：sources 外部打开 / player 收藏切换 */
  const handleHeaderAction = useCallback(async () => {
    const api = getApi()

    // sources 模式没有收藏概念，交给主进程用系统浏览器打开
    if (type === 'sources') {
      await api.webview.headerAction()
      return
    }

    // 以数据库为准确定当前是否已收藏，避免顶栏星标与实际状态不一致
    const synced = await api.webview.syncFavorite()
    if (synced) setState(synced)

    if (synced?.favorite) {
      // 已收藏 → 取消收藏
      const next = await api.webview.setFavorite({ favorite: false })
      if (next) setState(next)
      return
    }

    // 未收藏 → 先让用户命名，再落库
    const defaultName = synced?.title || url
    const name = await prompt({ title: '添加收藏', defaultValue: defaultName, placeholder: '请输入名称' })
    if (name === null) return
    const trimmed = name.trim()
    if (!trimmed) return

    const next = await api.webview.setFavorite({ favorite: true, name: trimmed })
    if (next) setState(next)
  }, [type, state, url, prompt])

  return (
    <div className="page webview-page">
      <div className="webview-toolbar">
        <button className="icon-btn" onClick={handleBack} title="返回">
          <Icon name="chevron-back" size={20} />
        </button>
        <button className="icon-btn" onClick={() => void getApi().webview.goBack()} title="后退">
          <Icon name="chevron-back" size={16} color="#9AA4BF" />
        </button>
        <button
          className="icon-btn"
          onClick={() => void getApi().webview.goForward()}
          title="前进"
          style={{ transform: 'rotate(180deg)' }}
        >
          <Icon name="chevron-back" size={16} color="#9AA4BF" />
        </button>
        <button className="icon-btn" onClick={() => void getApi().webview.reload()} title="刷新">
          <Icon name="reload-outline" size={17} color="#9AA4BF" />
        </button>

        <p className="webview-toolbar__title" title={state?.url || url}>
          {state?.title || title || '加载中...'}
        </p>

        {type === 'player' ? (
          <button
            className="icon-btn"
            onClick={() => void handleHeaderAction()}
            title={state?.favorite ? '取消收藏' : '收藏'}
          >
            <Icon name={state?.favorite ? 'star' : 'star-outline'} size={20} color="#EAF0FF" />
          </button>
        ) : null}

        {type === 'sources' ? (
          <button
            className="icon-btn"
            onClick={() => void handleHeaderAction()}
            title="在系统浏览器中打开"
          >
            <Icon name="open-outline" size={20} color="#EAF0FF" />
          </button>
        ) : null}
      </div>

      {barVisible ? (
        <div className="progress-track">
          {/*
            宽度直接用估算出的进度值；固定最小值只在 0% 时给出可见的一小段，
            不再用 Math.max(4, ...) 把进度钉死在 4%（那会让进度条永远停在同一个位置）。
          */}
          <div
            className={`progress-bar${progress >= 1 ? ' progress-bar--done' : ''}`}
            style={{ width: `${Math.min(100, Math.max(2, progress * 100))}%` }}
          />
        </div>
      ) : null}

      {/* 原生视图挂载在此容器内 */}
      <div className="webview-container" ref={containerRef}>
        {state?.error ? (
          <div className="webview-error">
            <p className="webview-error__title">加载失败</p>
            <p className="webview-error__desc">{state.error}</p>
            <p className="webview-error__desc">URL: {url}</p>
            <button className="btn" onClick={() => void getApi().webview.reload()}>
              重新加载
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
