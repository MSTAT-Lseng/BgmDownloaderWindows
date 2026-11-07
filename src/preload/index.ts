/**
 * @file preload：通过 contextBridge 把受限的 IPC 能力暴露给渲染进程。
 *
 * 渲染进程里拿不到 ipcRenderer，只能调用这里显式开放的接口，
 * 保证第三方页面内容无法触达系统能力。
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type { RendererApi, RendererEvents } from '../shared/types'

/** 推送通道 → 通道名映射，供 on() 使用 */
const EVENT_CHANNELS: Record<keyof RendererEvents, string> = {
  'webview:state': IPC.eventWebviewState,
  'webview:close': IPC.eventWebviewClose,
  'webview:toast': IPC.eventWebviewToast
}

const api: RendererApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo),

  getSources: () => ipcRenderer.invoke(IPC.sources),
  getSourceConfigs: () => ipcRenderer.invoke(IPC.sourceConfigs),

  fetchText: (request) => ipcRenderer.invoke(IPC.fetchText, request),

  favorites: {
    init: () => ipcRenderer.invoke(IPC.favoritesInit),
    list: (options) => ipcRenderer.invoke(IPC.favoritesList, options),
    exists: (url) => ipcRenderer.invoke(IPC.favoritesExists, url),
    upsert: (item) => ipcRenderer.invoke(IPC.favoritesUpsert, item),
    removeByUrl: (url) => ipcRenderer.invoke(IPC.favoritesRemove, url)
  },

  settings: {
    get: (key) => ipcRenderer.invoke(IPC.settingsGet, key),
    set: (key, value) => ipcRenderer.invoke(IPC.settingsSet, key, value)
  },

  webview: {
    open: (options) => ipcRenderer.invoke(IPC.webviewOpen, options),
    close: () => ipcRenderer.invoke(IPC.webviewClose),
    getState: () => ipcRenderer.invoke(IPC.webviewState),
    goBack: () => ipcRenderer.invoke(IPC.webviewBack),
    goForward: () => ipcRenderer.invoke(IPC.webviewForward),
    reload: () => ipcRenderer.invoke(IPC.webviewReload),
    headerAction: () => ipcRenderer.invoke(IPC.webviewHeaderAction),
    setBounds: (bounds) => ipcRenderer.invoke(IPC.webviewSetBounds, bounds),
    setVisible: (visible) => ipcRenderer.invoke(IPC.webviewSetVisible, visible),
    syncFavorite: () => ipcRenderer.invoke(IPC.webviewSyncFavorite),
    setFavorite: (options) => ipcRenderer.invoke(IPC.webviewSetFavorite, options)
  },

  window: {
    minimize: () => ipcRenderer.invoke(IPC.windowMinimize),
    toggleMaximize: () => ipcRenderer.invoke(IPC.windowToggleMaximize),
    close: () => ipcRenderer.invoke(IPC.windowClose)
  },

  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),

  alert: (options) => ipcRenderer.invoke(IPC.alert, options),

  checkUpdate: () => ipcRenderer.invoke(IPC.checkUpdate, true),

  on: (channel, listener) => {
    const ipcChannel = EVENT_CHANNELS[channel]
    const handler = (_e: IpcRendererEvent, payload: unknown) => listener(payload as never)
    ipcRenderer.on(ipcChannel, handler)
    return () => {
      ipcRenderer.removeListener(ipcChannel, handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
