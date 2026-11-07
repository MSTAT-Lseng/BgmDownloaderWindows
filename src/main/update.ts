/**
 * @file 版本更新检查：对比远程配置与本地版本号。
 *
 * 与原 Expo 版逻辑一致，只是把 Alert / Linking 换成 Electron 的 dialog / shell。
 * 桌面端不做静默自动安装，只提示并交给浏览器下载。
 */

import { app, dialog, net, shell, Notification } from 'electron'

interface UpdateConfig {
  version: string
  update_log: string
  url: string
  force: boolean
}

interface UpdateResponse {
  [key: string]: UpdateConfig
}

const UPDATE_URL = 'https://mstat.top/bgm_downloader/update.json'

export interface UpdateResult {
  hasUpdate: boolean
  latest?: string
  log?: string
  url?: string
  force?: boolean
}

/**
 * 查询更新信息。
 *
 * @param display 是否直接弹出原生对话框；启动时静默检查应传 false，把结果交给渲染进程处理
 */
export async function checkUpdate(display = false): Promise<UpdateResult> {
  try {
    const currentVersion = app.getVersion()
    // 加时间戳规避 CDN 缓存；用 net.fetch 走 Chromium 证书栈，避免个别环境根证书缺失
    const res = await net.fetch(`${UPDATE_URL}?token=${Date.now()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as UpdateResponse

    // 桌面端优先读 windows 配置，缺失时退回 android（安卓包即当前基线版本）
    const config = data.windows ?? data.win ?? data.android
    if (!config || config.version === currentVersion) return { hasUpdate: false }

    const result: UpdateResult = {
      hasUpdate: true,
      latest: config.version,
      log: config.update_log,
      url: config.url,
      force: !!config.force
    }

    if (display) await showUpdateDialog(result)
    return result
  } catch (e) {
    console.log('[UpdateService] 检查更新跳过:', e)
    return { hasUpdate: false }
  }
}

/** 弹出更新提示；强制更新时不给取消按钮 */
export async function showUpdateDialog(result: UpdateResult) {
  if (!result.hasUpdate || !result.url) return

  const buttons = result.force ? ['立即更新', '退出'] : ['稍后再说', '立即更新']
  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: `发现新版本 ${result.latest}`,
    message: `发现新版本 ${result.latest}`,
    detail: result.log ?? '',
    buttons,
    defaultId: result.force ? 0 : 1,
    cancelId: result.force ? 1 : 0,
    noLink: true
  })

  const confirmed = result.force ? response === 0 : response === 1
  if (confirmed) {
    await shell.openExternal(result.url)
  }
}

/** 系统通知（启动静默检查发现新版本时使用） */
export function notifyUpdate(result: UpdateResult) {
  if (!result.hasUpdate) return
  if (Notification.isSupported()) {
    new Notification({
      title: '番剧下载 有新版本',
      body: `最新版本 ${result.latest}，可在「设置 → 关于软件」中查看。`
    }).show()
  }
}
