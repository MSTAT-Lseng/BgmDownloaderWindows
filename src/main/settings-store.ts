/**
 * @file 轻量的键值设置存储，替代原 Expo 版的 AsyncStorage。
 *
 * 设置项很少（搜索超时、提示开关），直接存成 userData/settings.json 即可，
 * 不必引入额外的依赖。
 */

import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

let cache: Record<string, string> | null = null

function filePath() {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return path.join(dir, 'settings.json')
}

function load(): Record<string, string> {
  if (cache) return cache
  try {
    const raw = readFileSync(filePath(), 'utf-8')
    const parsed = JSON.parse(raw)
    cache = parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    cache = {}
  }
  return cache
}

function persist() {
  try {
    writeFileSync(filePath(), JSON.stringify(cache ?? {}, null, 2), 'utf-8')
  } catch (e) {
    console.warn('[settings] 写入失败:', e)
  }
}

export const settingsStore = {
  get(key: string): string | null {
    const value = load()[key]
    return value === undefined ? null : String(value)
  },

  set(key: string, value: string) {
    load()[key] = String(value)
    persist()
  }
}
