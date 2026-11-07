/**
 * @file 渲染进程全局类型声明。
 */

import type { RendererApi } from '../../shared/types'

declare global {
  interface Window {
    api: RendererApi
  }
}

export {}
