/**
 * @file 读取打包进 resources 的站点索引与搜索配置。
 *
 * 开发时资源在项目根的 resources/ 下，打包后在 process.resourcesPath/resources 下，
 * 由 electron-builder 的 extraResources 配置保证两边路径都成立。
 */

import { app } from 'electron'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type { SearchConfig, SourceItem } from '@shared/types'

/** 资源根目录 */
export function resourcesDir(): string {
  const candidates = [
    // 打包后：<app>/resources/resources
    path.join(process.resourcesPath ?? '', 'resources'),
    // 开发时：<project>/resources
    path.join(app.getAppPath(), 'resources'),
    path.join(process.cwd(), 'resources')
  ]
  for (const dir of candidates) {
    if (dir && existsSync(dir)) return dir
  }
  return candidates[1]
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf-8')) as T
}

/** 站点索引（全量，含未启用项） */
export function loadSources(): SourceItem[] {
  const file = path.join(resourcesDir(), 'sources', 'index.json')
  try {
    return readJson<SourceItem[]>(file)
  } catch (e) {
    console.error('[resources] 读取站点索引失败:', e)
    return []
  }
}

/** 读取全部 config_<id>.json，键为站点 id */
export function loadSourceConfigs(): Record<number, SearchConfig> {
  const dir = path.join(resourcesDir(), 'sources')
  const configs: Record<number, SearchConfig> = {}
  try {
    for (const name of readdirSync(dir)) {
      const m = name.match(/^config_(\d+)\.json$/)
      if (!m) continue
      try {
        configs[Number(m[1])] = readJson<SearchConfig>(path.join(dir, name))
      } catch (e) {
        console.warn(`[resources] 解析 ${name} 失败:`, e)
      }
    }
  } catch (e) {
    console.error('[resources] 读取搜索配置失败:', e)
  }
  return configs
}

/** 读取注入脚本（页面净化 / 全屏监听） */
export function loadInjectedScript(name: 'config_scripts' | 'fullscreen_scripts'): string {
  const file = path.join(resourcesDir(), 'sources', `${name}.js.txt`)
  try {
    return readFileSync(file, 'utf-8')
  } catch (e) {
    console.warn(`[resources] 读取脚本 ${name} 失败:`, e)
    return ''
  }
}
