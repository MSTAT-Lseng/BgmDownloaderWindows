/**
 * @file 主进程与渲染进程共享的类型定义。
 *
 * 渲染进程无法直接访问 Node / Electron API（contextIsolation + 无 nodeIntegration），
 * 所有系统能力都通过 preload 暴露的 IPC 接口调用，契约集中定义在这里。
 */

/** 单个站点条目（来自 resources/sources/index.json） */
export interface SourceItem {
  id: number
  name: string
  url: string
  desc: string | null
  icon: string
  enabled: boolean
  adaptation: boolean
}

/** 站点的搜索配置（来自 resources/sources/config_<id>.json） */
export interface SearchConfig {
  search_config: {
    url: string
    method?: string
    cookie?: string
    body?: unknown
    details_format: string
    item_regex: string
    fields: {
      image: { match_index: number; description?: string }
      url: { match_index: number; description?: string }
      title: { match_index: number; description?: string }
    }
  }
}

/** 单条收藏；url 唯一 */
export interface FavoriteItem {
  name: string
  url: string
}

/** 收藏列表查询参数 */
export interface FavoriteListOptions {
  limit?: number
  offset?: number
  keyword?: string
  orderBy?: 'name' | 'url'
  order?: 'ASC' | 'DESC'
}

/** 内置浏览器的加载模式，对应原 App 的 type 参数 */
export type ViewMode = 'default' | 'sources' | 'player'

/** 打开内置浏览器时的参数 */
export interface OpenWebviewOptions {
  url: string
  type?: ViewMode
  /** 来源页指定的 UA；不传则用 Electron 默认 UA */
  userAgent?: string
  /** 顶部标题，先占位，加载完成后会被页面标题覆盖 */
  title?: string
}

/** 内置浏览器的实时状态，主进程主动推送给渲染进程 */
export interface WebviewState {
  /** 当前加载地址 */
  url: string
  /** 当前网页标题 */
  title: string
  /** 加载进度 0 ~ 1 */
  progress: number
  /** 是否正在加载 */
  loading: boolean
  /** 加载失败的原因；正常时为 null */
  error: string | null
  /** 所打开页面是否已收藏（仅 player 模式有效） */
  favorite: boolean
  /** 是否处于全屏状态（用于切换窗口全屏） */
  fullscreen: boolean
}

/** 主进程 → 渲染进程的推送事件 */
export interface RendererEvents {
  'webview:state': WebviewState
  'webview:close': { reason: 'closed' | 'blocked' }
  'webview:toast': { message: string }
}

/** 搜索请求参数 */
export interface SearchRequest {
  keyword: string
  /** 超时秒数 */
  timeout: number
}

/** 渲染进程调用主进程的方法集合 */
export interface RendererApi {
  /** 运行时信息 */
  getAppInfo(): Promise<{ version: string; electron: string; chrome: string; platform: string }>

  /** 站点数据 */
  getSources(): Promise<SourceItem[]>
  getSourceConfigs(): Promise<Record<number, SearchConfig>>

  /** 使用指定 UA 请求网页文本（绕开浏览器的同源 / CORS 限制） */
  fetchText(request: {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: string
    timeout: number
  }): Promise<{ ok: boolean; status: number; text: string }>

  /** 收藏（SQLite） */
  favorites: {
    init(): Promise<void>
    list(options?: FavoriteListOptions): Promise<FavoriteItem[]>
    exists(url: string): Promise<boolean>
    upsert(item: FavoriteItem): Promise<void>
    removeByUrl(url: string): Promise<void>
  }

  /** 键值设置（等价于原 AsyncStorage） */
  settings: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
  }

  /** 内置浏览器 / 窗口控制 */
  webview: {
    open(options: OpenWebviewOptions): Promise<WebviewState>
    close(): Promise<void>
    getState(): Promise<WebviewState | null>
    goBack(): Promise<void>
    goForward(): Promise<void>
    reload(): Promise<void>
    /** 与右侧顶栏按钮对应：sources 模式为外部打开，player 模式为收藏开关 */
    headerAction(): Promise<void>
    /** 更新浏览器视图的位置与显隐 */
    setBounds(bounds: { x: number; y: number; width: number; height: number }): Promise<void>
    setVisible(visible: boolean): Promise<void>
    /** 重新按数据库刷新收藏状态，并返回最新状态 */
    syncFavorite(): Promise<WebviewState | null>
    /** 幂等地设置当前页面收藏状态（收藏时带名称），返回最新状态 */
    setFavorite(options: { favorite: boolean; name?: string }): Promise<WebviewState | null>
  }

  window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<boolean>
    close(): Promise<void>
  }

  /** 打开外部链接（系统默认浏览器 / 邮件客户端） */
  openExternal(url: string): Promise<void>

  /** 系统原生提示框 */
  alert(options: { title: string; message?: string; detail?: string; type?: 'info' | 'warning' | 'error' }): Promise<void>

  /** 检查更新 */
  checkUpdate(): Promise<{ hasUpdate: boolean; latest?: string; log?: string; url?: string; force?: boolean }>

  /** 订阅主进程推送事件，返回取消订阅函数 */
  on<K extends keyof RendererEvents>(channel: K, listener: (payload: RendererEvents[K]) => void): () => void
}
