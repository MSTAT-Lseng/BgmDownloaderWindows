/**
 * @file 站点图标地址解析。
 *
 * 原 App 用 require() 静态映射图标；桌面版直接按文件名拼资源 URL，
 * 资源由 electron-vite 从 resources/ 复制到渲染进程的 public 目录下。
 */

/** 渲染进程内的图标根路径 */
const ICONS_BASE = './icons/sources'

/** 取站点图标地址，缺省时回退到默认图标 */
export function sourceIconUrl(iconName?: string | null): string {
  if (!iconName) return `${ICONS_BASE}/default.png`
  return `${ICONS_BASE}/${iconName}.png`
}

/** 站点图标加载失败时替换为默认图标 */
export function fallbackIcon(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  if (img.dataset['fallback']) return
  img.dataset['fallback'] = '1'
  img.src = `${ICONS_BASE}/default.png`
}
