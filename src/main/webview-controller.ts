/**
 * @file 内置浏览器：用 WebContentsView 在主窗口容器区域内承载第三方站点页面。
 *
 * 替代原 Expo 版的 react-native-webview，能力一一对应：
 *  - 加载进度 / 标题 / 错误回传给渲染进程（顶部标题栏与进度条）
 *  - 播放页只放行白名单域名与同站页面，其余跳转一律拦截（防广告跳转）
 *  - 播放页注入全屏监听脚本与页面净化脚本（每 2 秒重注入一次，兜底 SPA 跳转）
 *  - 顶部右侧按钮：sources 模式外部打开，player 模式切换收藏
 */

import { BrowserWindow, WebContentsView, shell, type Rectangle } from 'electron'
import type { WebviewState, ViewMode } from '@shared/types'
import { favoritesDb } from './favorites-db'
import { loadInjectedScript } from './resources'

/** player 模式下允许从其他站点跳转的外部播放页白名单 */
const PLAYER_URL_WHITELIST = ['xgct.com/video', 'xgcartoon.com/']

/** 默认 UA：声明为 Windows 桌面 Chrome，符合这是桌面版的事实 */
const DEFAULT_USER_AGENT = ''

/** 取主机名，非法时返回空串 */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/**
 * 判断两个主机名是否属于同一主域。
 *
 * 站点常把播放源放在独立子域（502.girigirilove.com、m.example.com 等），
 * 只看是否包含原始域名会误杀；这里比较去掉 www/m 前缀后的主域。
 */
function isSameSite(a: string, b: string): boolean {
  const strip = (host: string) => {
    const parts = host.toLowerCase().split('.').filter(Boolean)
    // 保留最后两段作为主域；对 .com.cn 这类双后缀做简单兼容
    if (parts.length <= 2) return parts.join('.')
    const lastTwo = parts.slice(-2).join('.')
    if (/^(com|net|org|gov|edu)\.(cn|hk|tw|jp|uk)$/.test(lastTwo)) {
      return parts.slice(-3).join('.')
    }
    return lastTwo
  }
  if (!a || !b) return false
  return strip(a) === strip(b)
}

/** 初始状态 */
function emptyState(url = ''): WebviewState {
  return { url, title: '加载中...', progress: 0, loading: true, error: null, favorite: false, fullscreen: false }
}

export class WebviewController {
  private win: BrowserWindow | null = null
  private view: WebContentsView | null = null
  private state: WebviewState | null = null
  private mode: ViewMode = 'default'
  private initialUrl = ''
  /** 初始地址的主机名，用于 player 模式的同站判断 */
  private initialHost = ''
  private customUa: string | undefined
  private bounds: Rectangle = { x: 0, y: 0, width: 0, height: 0 }
  private visible = false

  private fullscreenScript = ''
  private purifyScript = ''
  private purifyTimer: NodeJS.Timeout | null = null

  constructor(private readonly emit: (channel: 'webview:state' | 'webview:close' | 'webview:toast', payload: unknown) => void) {}

  /** 绑定主窗口，窗口销毁时清理定时器 */
  attach(win: BrowserWindow) {
    if (this.win && this.win !== win) this.destroy()
    this.win = win
    win.on('closed', () => {
      this.destroy()
      this.win = null
    })
  }

  /** 当前是否已打开浏览器视图 */
  isOpen() {
    return !!this.view
  }

  /** 当前状态快照 */
  getState(): WebviewState | null {
    return this.state
  }

  /** 设置容器区域（渲染进程上报的坐标，DIP） */
  setBounds(bounds: Rectangle) {
    this.bounds = bounds
    this.applyBounds()
  }

  /** 显示 / 隐藏浏览器视图（离开网页页时隐藏，避免遮挡其他界面） */
  setVisible(visible: boolean) {
    this.visible = visible
    if (!this.view) return
    this.view.setVisible(visible)
    if (visible && this.win) this.win.contentView.addChildView(this.view)
  }

  private applyBounds() {
    if (!this.view) return
    const { x, y, width, height } = this.bounds
    // 尺寸为 0 时直接隐藏，避免不可见区域仍参与布局
    this.view.setBounds({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.max(0, Math.round(width)),
      height: Math.max(0, Math.round(height))
    })
  }

  /** 打开一个地址；已存在视图时直接导航，避免重复创建 webContents */
  async open(options: { url: string; type?: ViewMode; userAgent?: string; title?: string }): Promise<WebviewState> {
    if (!this.win) throw new Error('窗口尚未就绪')

    this.mode = options.type ?? 'default'
    this.initialUrl = options.url
    this.initialHost = hostnameOf(options.url)
    this.customUa = options.userAgent

    if (this.mode === 'player') {
      this.fullscreenScript = loadInjectedScript('fullscreen_scripts')
      this.purifyScript = loadInjectedScript('config_scripts')
    } else {
      this.fullscreenScript = ''
      this.purifyScript = ''
    }

    const view = this.ensureView()
    this.state = emptyState(options.url)
    this.state.title = options.title || '加载中...'
    this.pushState()

    this.setVisible(true)
    this.restartPurifyTimer()
    void view.webContents.loadURL(options.url).catch((e) => this.handleLoadError(e))

    return this.state
  }

  /** 创建（首次）并返回 WebContentsView */
  private ensureView(): WebContentsView {
    if (this.view) return this.view
    if (!this.win) throw new Error('窗口尚未就绪')

    const view = new WebContentsView({
      webPreferences: {
        // 第三方站点页面完全不可信，关掉一切特权能力
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: true,
        backgroundThrottling: false,
        spellcheck: false
      }
    })
    this.view = view
    this.win.contentView.addChildView(view)
    this.applyBounds()
    view.setVisible(this.visible)

    const wc = view.webContents

    // 站点播放器要求「用户手势才能播放」，这里保留默认策略即可；
    // 但关闭后台节流，避免切到后台后视频/进度异常。
    wc.setAudioMuted(false)

    // ---- 进度与导航事件 ----
    wc.on('did-start-loading', () => this.patchState({ progress: 0, loading: true, error: null }))

    wc.on('did-stop-loading', () => {
      this.patchState({ progress: 1, loading: false })
      void this.refreshFavoriteFlag()
    })

    // 单页应用常在此之后才把最终地址确定下来，这里再补一次收藏状态查询，
    // 避免顶栏星标停留在初始的「未收藏」
    wc.on('did-navigate-in-page', () => {
      void this.refreshFavoriteFlag()
    })

    wc.on('page-title-updated', (_e, title) => {
      if (title) this.patchState({ title })
    })

    wc.on('did-navigate', (_e, url) => {
      this.patchState({ url })
      void this.refreshFavoriteFlag()
    })

    wc.on('did-navigate-in-page', (_e, url) => {
      this.patchState({ url })
      void this.refreshFavoriteFlag()
    })

    wc.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      // -3 是主动取消（例如被跳转拦截或新的导航覆盖），不算错误
      if (errorCode === -3 || !isMainFrame) return
      this.patchState({ error: `${errorDescription} (${errorCode})`, title: '加载失败', loading: false })
      console.warn(`[webview] load failed ${validatedURL}: ${errorDescription} (${errorCode})`)
    })

    wc.on('render-process-gone', (_e, details) => {
      this.patchState({ error: `页面进程异常退出：${details.reason}`, title: '加载失败', loading: false })
    })

    // ---- 全屏事件：把窗口切成全屏 / 还原 ----
    wc.on('enter-html-full-screen', () => {
      this.patchState({ fullscreen: true })
      this.win?.setFullScreen(true)
    })
    wc.on('leave-html-full-screen', () => {
      this.patchState({ fullscreen: false })
      this.win?.setFullScreen(false)
    })

    // ---- 弹窗：站点常把播放器开在 window.open 里，这里就地跳转 ----
    wc.setWindowOpenHandler(({ url }) => {
      if (!this.isNavigationAllowed(url)) {
        console.log(`[webview] blocked popup ${url}`)
        return { action: 'deny' }
      }
      if (/^https?:/i.test(url)) void wc.loadURL(url)
      return { action: 'deny' }
    })

    // ---- 导航守卫 1：页内脚本触发的跳转 ----
    wc.on('will-navigate', (event, url) => {
      if (!this.isNavigationAllowed(url)) {
        event.preventDefault()
        console.log(`[webview] blocked navigation ${url}: permission denied.`)
      }
    })

    // ---- 导航守卫 2：服务器端 302 重定向（will-navigate 管不到这种情况）----
    wc.on('will-redirect', (event, url) => {
      if (!this.isNavigationAllowed(url)) {
        event.preventDefault()
        console.log(`[webview] blocked redirect ${url}: permission denied.`)
      }
    })

    // 只放行播放必需的能力，其余敏感权限一律拒绝
    wc.session.setPermissionRequestHandler((_wc, permission, callback) => {
      const allowed = ['fullscreen', 'clipboard-sanitized-write', 'media']
      callback(allowed.includes(permission))
    })

    return view
  }

  /**
   * 判断某个地址是否允许导航。
   *
   * player 模式：只放行白名单域名与「同主域」的页面（含 m. / 数字前缀之类的子域，
   * 例如播放器会把 502.girigirilove.com 作为独立播放源），其余一律拦截，
   * 避免被广告或第三方跳转带走。
   * 其它模式：只放行 http(s)。
   */
  private isNavigationAllowed(url: string): boolean {
    try {
      if (!/^https?:/i.test(url)) return false
      if (this.mode !== 'player') return true

      if (PLAYER_URL_WHITELIST.some((item) => url.includes(item))) return true

      const initialHost = this.initialHost
      if (!initialHost) return true

      let targetHost: string
      try {
        targetHost = new URL(url).hostname
      } catch {
        return false
      }

      return isSameSite(hostnameOf(initialHost), targetHost)
    } catch {
      return false
    }
  }

  /** 每 2 秒重注入一次净化脚本，兜底单页应用跳转不重新执行注入的问题 */
  private restartPurifyTimer() {
    this.stopPurifyTimer()
    if (this.mode !== 'player') return

    this.purifyTimer = setInterval(() => {
      const wc = this.view?.webContents
      if (!wc || wc.isDestroyed()) return
      if (!this.purifyScript) return
      wc.executeJavaScript(this.purifyScript, true).catch(() => {
        /* 页面尚未就绪或已跳转，忽略 */
      })
    }, 2000)
  }

  private stopPurifyTimer() {
    if (this.purifyTimer) {
      clearInterval(this.purifyTimer)
      this.purifyTimer = null
    }
  }

  /** 加载失败时统一转换成 UI 需要的错误信息 */
  private handleLoadError(e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    this.patchState({ error: message, title: '加载失败', loading: false })
  }

  /** 合并状态并推送给渲染进程 */
  private patchState(patch: Partial<WebviewState>) {
    if (!this.view) return
    this.state = { ...(this.state ?? emptyState()), ...patch }
    this.pushState()
  }

  private pushState() {
    if (this.state) this.emit('webview:state', this.state)
  }

  /** 查询当前地址是否已收藏，player 模式外一律视为未收藏 */
  private async refreshFavoriteFlag() {
    if (this.mode !== 'player') {
      if (this.state?.favorite) this.patchState({ favorite: false })
      return
    }
    const url = this.state?.url
    if (!url) return
    try {
      const exists = favoritesDb.exists(url)
      if (exists !== this.state?.favorite) this.patchState({ favorite: exists })
    } catch (e) {
      console.error('[webview] 检查收藏状态失败:', e)
    }
  }

  /**
   * 重新计算收藏状态并返回最新状态。
   *
   * 渲染进程在打开页面、以及自己写库之后都会调用，避免顶栏星标与数据库脱节。
   */
  async syncFavorite(): Promise<WebviewState | null> {
    await this.refreshFavoriteFlag()
    return this.state
  }

  /** 右侧顶栏按钮：sources 模式外部打开，player 模式切换收藏 */
  async headerAction() {
    if (!this.state) return

    if (this.mode === 'sources') {
      await shell.openExternal(this.initialUrl || this.state.url)
      return
    }
    // player 模式的收藏切换由 setFavorite 专门负责，避免「先写库再切换」被重复取反
  }

  /**
   * 设置当前页面的收藏状态（幂等）。
   *
   * 渲染进程负责弹窗让用户命名，这里只做落库与状态同步；
   * 与 headerAction 分离，避免一次点击既写库又切换导致状态取反。
   */
  async setFavorite(options: { favorite: boolean; name?: string }): Promise<WebviewState | null> {
    if (!this.state || this.mode !== 'player') return this.state
    const url = this.state.url
    if (!url) return this.state

    try {
      if (options.favorite) {
        const name = (options.name ?? '').trim() || this.state.title || url
        favoritesDb.upsert({ name, url })
        this.patchState({ favorite: true })
      } else {
        favoritesDb.removeByUrl(url)
        this.patchState({ favorite: false })
      }
    } catch (e) {
      console.error('[webview] 设置收藏失败:', e)
    }
    return this.state
  }

  goBack() {
    const wc = this.view?.webContents
    if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  }

  goForward() {
    const wc = this.view?.webContents
    if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  }

  reload() {
    this.view?.webContents.reload()
  }

  /** 关闭并销毁浏览器视图 */
  close() {
    const view = this.view
    this.view = null
    this.stopPurifyTimer()
    if (view) {
      try {
        if (this.win) this.win.contentView.removeChildView(view)
        view.webContents.close()
      } catch (e) {
        console.warn('[webview] 销毁视图失败:', e)
      }
    }
    this.state = null
    this.visible = false
    if (this.win?.isFullScreen()) this.win.setFullScreen(false)
    this.emit('webview:close', { reason: 'closed' })
  }

  /** 应用退出时彻底释放 */
  destroy() {
    this.stopPurifyTimer()
    if (this.view) {
      try {
        this.win?.contentView.removeChildView(this.view)
        this.view.webContents.close()
      } catch {
        /* 窗口可能已先销毁 */
      }
    }
    this.view = null
    this.state = null
  }
}
