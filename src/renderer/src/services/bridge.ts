/**
 * @file preload 暴露接口的访问入口。
 *
 * 用函数而不是直接引用 window.api，方便在缺少 preload（例如误用浏览器打开页面）
 * 时给出明确错误，而不是在模块初始化阶段就崩溃。
 */

import type { RendererApi } from '@shared/types'

export function getApi(): RendererApi {
  if (typeof window === 'undefined' || !window.api) {
    throw new Error('Electron 桥接未就绪：请通过桌面应用启动，而不是浏览器。')
  }
  return window.api
}

/** 判断当前是否运行在 Electron 中 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.api
}
