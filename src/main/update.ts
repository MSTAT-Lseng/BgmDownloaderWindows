/**
 * @file 版本更新检查：对比远程配置与本地版本号。
 *
 * 远程配置 https://mstat.top/bgm_downloader/update.json 按平台分组（android / ios / windows），
 * 桌面端只读 windows 段。各平台字段略有差异，这里做兼容读取：
 *   - version   最新版本号（必填）
 *   - update_log / updateLog / log / changelog / desc  更新说明
 *   - url / download_url / downloadUrl / download / link / path  下载地址
 *   - force / force_update / forceUpdate  是否强制更新
 * 下载地址可以是绝对 URL，也可以是相对 update.json 所在目录的文件名（如 latest.yml 里的包名）。
 *
 * 与原 Expo 版逻辑一致，只是把 Alert / Linking 换成 Electron 的 dialog / shell。
 * 桌面端不做静默自动安装，只提示并交给系统浏览器下载。
 */

import { app, dialog, net, shell, Notification } from 'electron'

/** 远程 windows 段的原始结构（字段名可能随时增补，因此全部可选） */
interface WindowsUpdateConfig {
  version?: string
  update_log?: string
  updateLog?: string
  log?: string
  changelog?: string
  desc?: string
  url?: string
  download_url?: string
  downloadUrl?: string
  download?: string
  link?: string
  path?: string
  force?: boolean
  force_update?: boolean
  forceUpdate?: boolean
}

interface UpdateResponse {
  windows?: WindowsUpdateConfig
  android?: WindowsUpdateConfig
  ios?: WindowsUpdateConfig
}

const UPDATE_URL = 'https://mstat.top/bgm_downloader/update.json'

export interface UpdateResult {
  hasUpdate: boolean
  /** 当前本地版本号 */
  current?: string
  latest?: string
  log?: string
  url?: string
  force?: boolean
  /** 检查失败时的错误信息（网络异常、配置缺失等） */
  error?: string
}

/** 取第一个非空字符串字段 */
function pickString(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

/** 取第一个布尔字段，兼容 1/0、"true"/"false" 之类的写法 */
function pickBoolean(...values: (boolean | number | string | undefined)[]): boolean {
  for (const value of values) {
    if (value === true || value === 1 || value === 'true' || value === '1') return true
  }
  return false
}

/**
 * 严格解析版本号（支持 5.0.8 / v5.0.8 / 5.0.8-beta.1 / 5.0.8+build7）。
 * 只要任一侧解析不出数字，就返回 null 交给字符串比较兜底。
 */
function parseVersion(raw: string): number[] | null {
  const match = /^v?(\d+(?:\.\d+)*)/i.exec(raw.trim())
  if (!match) return null
  return match[1].split('.').map((part) => Number.parseInt(part, 10))
}

/** 逐段比较版本号：a > b 返回 1，a < b 返回 -1，相等返回 0 */
export function compareVersion(a: string, b: string): number {
  const parsedA = parseVersion(a)
  const parsedB = parseVersion(b)
  if (!parsedA || !parsedB) {
    // 无法解析时退化为字符串比较，避免误报“已是最新”
    return a === b ? 0 : a > b ? 1 : -1
  }

  const length = Math.max(parsedA.length, parsedB.length)
  for (let i = 0; i < length; i += 1) {
    const left = parsedA[i] ?? 0
    const right = parsedB[i] ?? 0
    if (left !== right) return left > right ? 1 : -1
  }
  return 0
}

/** 下载地址允许相对 update.json 所在目录，统一转成绝对 URL */
function resolveDownloadUrl(raw: string | undefined, base: string): string | undefined {
  if (!raw) return undefined
  if (/^[a-z][a-z\d+.-]*:/i.test(raw)) return raw
  try {
    return new URL(raw, base).toString()
  } catch {
    return undefined
  }
}

/**
 * 查询更新信息。
 *
 * 只认远程配置的 windows 段：之前“缺失时退回 android”的做法会让桌面端拿到安卓包地址，
 * 现在 windows 段已独立维护，缺失即视为配置尚未发布，静默跳过。
 *
 * @param display 是否直接弹出原生对话框；启动时静默检查应传 false，把结果交给调用方处理
 */
export async function checkUpdate(display = false): Promise<UpdateResult> {
  const current = app.getVersion()

  try {
    // 加时间戳规避 CDN 缓存；用 net.fetch 走 Chromium 证书栈，避免个别环境根证书缺失
    const res = await net.fetch(`${UPDATE_URL}?token=${Date.now()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as UpdateResponse

    const config = data.windows
    if (!config) return { hasUpdate: false, current, error: '远程配置中没有 windows 段' }

    const latest = pickString(config.version)
    if (!latest) return { hasUpdate: false, current, error: '远程 windows 配置缺少 version 字段' }

    // 线上版本不比本地新（相等或更旧）就不提示，避免回滚包把新版本“降级”
    if (compareVersion(latest, current) <= 0) return { hasUpdate: false, current, latest }

    const result: UpdateResult = {
      hasUpdate: true,
      current,
      latest,
      log: pickString(config.update_log, config.updateLog, config.log, config.changelog, config.desc),
      url: resolveDownloadUrl(
        pickString(config.url, config.download_url, config.downloadUrl, config.download, config.link, config.path),
        UPDATE_URL
      ),
      force: pickBoolean(config.force, config.force_update, config.forceUpdate)
    }

    if (display) await showUpdateDialog(result)
    return result
  } catch (e) {
    console.log('[UpdateService] 检查更新失败:', e)
    const error = e instanceof Error ? e.message : String(e)
    if (display) {
      await dialog.showMessageBox({
        type: 'warning',
        title: '检查更新失败',
        message: '检查更新失败',
        detail: `请检查网络连接后重试。\n\n${error}`,
        buttons: ['确定'],
        noLink: true
      })
    }
    return { hasUpdate: false, current, error }
  }
}

/** 弹出更新提示；强制更新时不给取消按钮 */
export async function showUpdateDialog(result: UpdateResult) {
  if (!result.hasUpdate) return

  // 远程配置可能暂时只有版本号没有下载地址：此时只提示，不提供无效的“立即更新”
  const downloadable = !!result.url
  const buttons = downloadable
    ? result.force
      ? ['立即更新', '退出']
      : ['稍后再说', '立即更新']
    : ['知道了']

  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: `发现新版本 ${result.latest}`,
    message: `发现新版本 ${result.latest}`,
    detail: downloadable
      ? (result.log ?? '')
      : [result.log, '下载地址尚未发布，请稍后到官网获取最新版本。'].filter(Boolean).join('\n\n'),
    buttons,
    defaultId: downloadable && result.force ? 0 : buttons.length - 1,
    cancelId: 0,
    noLink: true
  })

  const confirmed = downloadable && (result.force ? response === 0 : response === 1)
  if (confirmed && result.url) {
    await shell.openExternal(result.url)
  }
}

/** 系统通知（启动静默检查发现新版本时使用） */
export function notifyUpdate(result: UpdateResult) {
  if (!result.hasUpdate) return
  if (Notification.isSupported()) {
    new Notification({
      title: '番剧下载 有新版本',
      body: `最新版本 ${result.latest}（当前 ${result.current}），可在「设置 → 关于软件」中查看。`
    }).show()
  }
}
