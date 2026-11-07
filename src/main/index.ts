/**
 * @file 主进程入口：创建窗口、注册全部 IPC 处理函数、托管内置浏览器视图。
 */

import { app, BrowserWindow, dialog, ipcMain, net, session, shell } from 'electron'
import path from 'node:path'
import { IPC } from '@shared/ipc'
import type {
  FavoriteItem,
  FavoriteListOptions,
  OpenWebviewOptions,
  SearchConfig,
  SourceItem
} from '@shared/types'
import { closeFavoritesDb, favoritesDb } from './favorites-db'
import { loadSourceConfigs, loadSources } from './resources'
import { settingsStore } from './settings-store'
import { checkUpdate, notifyUpdate, showUpdateDialog } from './update'
import { WebviewController } from './webview-controller'

/** 与渲染进程顶部标题栏一致的窗口底色，避免加载时白屏闪烁 */
const BACKGROUND_COLOR = '#05070C'

let mainWindow: BrowserWindow | null = null
let webview: WebviewController | null = null

/** 统一向渲染进程推送事件 */
function emit(channel: string, payload: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

/**
 * 站点请求默认走一个独立的 session，方便整体调整 UA / 忽略证书错误。
 * 注意：内置浏览器视图单独使用 default session，避免与主界面互相影响。
 */
function configureSessions() {
  const defaultSession = session.defaultSession
  defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['fullscreen', 'media', 'clipboard-sanitized-write'].includes(permission))
  })

  // 部分动漫站点使用自签证书或证书链不完整，放行以提升可访问性
  app.on('certificate-error', (event, _wc, _url, _error, _cert, callback) => {
    event.preventDefault()
    callback(true)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 420,
    minHeight: 600,
    backgroundColor: BACKGROUND_COLOR,
    title: '番剧下载',
    show: false,
    // 无边框自绘标题栏，让深色主题贯穿到窗口顶部
    frame: false,
    autoHideMenuBar: true,
    // 窗口图标：开发时取项目 resources，打包后取 extraResources 内的副本
    icon: process.env['ELECTRON_RENDERER_URL']
      ? path.join(app.getAppPath(), 'resources', 'images', 'appicon.png')
      : path.join(process.resourcesPath, 'resources', 'images', 'appicon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // 主窗口内的外链一律交给系统浏览器，不在应用内打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  webview = new WebviewController(emit)
  webview.attach(mainWindow)

  mainWindow.on('closed', () => {
    webview?.destroy()
    webview = null
    mainWindow = null
  })
}

/** 注册全部 IPC 处理函数 */
function registerIpc() {
  ipcMain.handle(IPC.appInfo, () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform
  }))

  ipcMain.handle(IPC.sources, (): SourceItem[] => loadSources())
  ipcMain.handle(IPC.sourceConfigs, (): Record<number, SearchConfig> => loadSourceConfigs())

  /**
   * 用 Chromium 的网络栈请求网页文本。
   *
   * 原 App 里 RN 的 fetch 不受同源限制；Electron 渲染进程里直接 fetch 会被 CORS
   * 拦下，所以统一走主进程，并可自由设置 UA / Cookie / apikey。
   *
   * 这里特意不用 Node 自带的 fetch：Node(undici) 使用系统根证书，部分动漫站点的
   * 证书链不完整会直接报 unable to get local issuer certificate；而 net.fetch 走
   * Chromium 的证书库，与内置浏览器行为一致，并已被主进程的 certificate-error 放行。
   */
  ipcMain.handle(
    IPC.fetchText,
    async (
      _e,
      request: { url: string; method?: string; headers?: Record<string, string>; body?: string; timeout: number }
    ) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), Math.max(1, request.timeout) * 1000)
      try {
        const res = await net.fetch(request.url, {
          method: request.method || 'GET',
          headers: request.headers,
          body: request.body,
          signal: controller.signal,
          // 与原 App credentials: 'omit' 一致：只用请求头里显式定义的 Cookie
          credentials: 'omit',
          bypassCustomProtocolHandlers: true
        })
        const text = await res.text()
        return { ok: res.ok, status: res.status, text }
      } catch (e) {
        const err = e as Error
        if (err.name === 'AbortError') {
          const timeoutError = new Error('TIMEOUT')
          timeoutError.name = 'TimeoutError'
          throw timeoutError
        }
        throw err
      } finally {
        clearTimeout(timer)
      }
    }
  )

  ipcMain.handle(IPC.favoritesInit, () => {
    favoritesDb.init()
  })
  ipcMain.handle(IPC.favoritesList, (_e, options?: FavoriteListOptions) => favoritesDb.list(options))
  ipcMain.handle(IPC.favoritesExists, (_e, url: string) => favoritesDb.exists(url))
  ipcMain.handle(IPC.favoritesUpsert, (_e, item: FavoriteItem) => favoritesDb.upsert(item))
  ipcMain.handle(IPC.favoritesRemove, (_e, url: string) => favoritesDb.removeByUrl(url))

  ipcMain.handle(IPC.settingsGet, (_e, key: string) => settingsStore.get(key))
  ipcMain.handle(IPC.settingsSet, (_e, key: string, value: string) => settingsStore.set(key, value))

  ipcMain.handle(IPC.webviewOpen, async (_e, options: OpenWebviewOptions) => {
    if (!webview) throw new Error('内置浏览器尚未就绪')
    return webview.open(options)
  })
  ipcMain.handle(IPC.webviewClose, () => webview?.close())
  ipcMain.handle(IPC.webviewState, () => webview?.getState() ?? null)
  ipcMain.handle(IPC.webviewBack, () => webview?.goBack())
  ipcMain.handle(IPC.webviewForward, () => webview?.goForward())
  ipcMain.handle(IPC.webviewReload, () => webview?.reload())
  ipcMain.handle(IPC.webviewHeaderAction, () => webview?.headerAction())
  ipcMain.handle(IPC.webviewSetBounds, (_e, bounds: { x: number; y: number; width: number; height: number }) =>
    webview?.setBounds(bounds)
  )
  ipcMain.handle(IPC.webviewSetVisible, (_e, visible: boolean) => webview?.setVisible(visible))
  ipcMain.handle(IPC.webviewSyncFavorite, () => webview?.syncFavorite() ?? null)
  ipcMain.handle(
    IPC.webviewSetFavorite,
    (_e, options: { favorite: boolean; name?: string }) => webview?.setFavorite(options) ?? null
  )

  ipcMain.handle(IPC.windowMinimize, () => mainWindow?.minimize())
  ipcMain.handle(IPC.windowToggleMaximize, () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
    return mainWindow.isMaximized()
  })
  ipcMain.handle(IPC.windowClose, () => mainWindow?.close())

  ipcMain.handle(IPC.openExternal, async (_e, url: string) => {
    if (!url) return
    try {
      await shell.openExternal(url)
    } catch (e) {
      console.error('[shell] 打开链接失败:', url, e)
    }
  })

  ipcMain.handle(
    IPC.alert,
    async (_e, options: { title: string; message?: string; detail?: string; type?: 'info' | 'warning' | 'error' }) => {
      const target = BrowserWindow.getFocusedWindow() ?? mainWindow
      const opts = {
        type: options.type ?? 'info',
        title: options.title,
        message: options.message ?? options.title,
        detail: options.detail,
        buttons: ['确定'],
        noLink: true
      }
      if (target) await dialog.showMessageBox(target, opts)
      else await dialog.showMessageBox(opts)
    }
  )

  ipcMain.handle(IPC.checkUpdate, async (_e, display?: boolean) => {
    const result = await checkUpdate(false)
    if (result.hasUpdate && display) await showUpdateDialog(result)
    return result
  })
}

// 单实例：重复启动时聚焦已有窗口
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    configureSessions()
    registerIpc()
    createWindow()

    // 启动时静默检查更新，有新版本时发系统通知，不打扰用户
    void checkUpdate(false).then((result) => {
      if (result.hasUpdate) notifyUpdate(result)
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    closeFavoritesDb()
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    webview?.destroy()
    closeFavoritesDb()
  })
}
