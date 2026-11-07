/**
 * @file IPC 通道名常量，主进程与 preload 共用，避免字符串写错。
 */
export const IPC = {
  appInfo: 'app:info',
  sources: 'sources:list',
  sourceConfigs: 'sources:configs',
  fetchText: 'net:fetch-text',
  favoritesInit: 'favorites:init',
  favoritesList: 'favorites:list',
  favoritesExists: 'favorites:exists',
  favoritesUpsert: 'favorites:upsert',
  favoritesRemove: 'favorites:remove',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  webviewOpen: 'webview:open',
  webviewClose: 'webview:close',
  webviewState: 'webview:get-state',
  webviewBack: 'webview:back',
  webviewForward: 'webview:forward',
  webviewReload: 'webview:reload',
  webviewHeaderAction: 'webview:header-action',
  webviewSetBounds: 'webview:set-bounds',
  webviewSetVisible: 'webview:set-visible',
  webviewSyncFavorite: 'webview:sync-favorite',
  webviewSetFavorite: 'webview:set-favorite',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  openExternal: 'shell:open-external',
  alert: 'dialog:alert',
  checkUpdate: 'update:check',
  // 主进程 → 渲染进程的推送通道
  eventWebviewState: 'event:webview-state',
  eventWebviewClose: 'event:webview-close',
  eventWebviewToast: 'event:webview-toast'
} as const
