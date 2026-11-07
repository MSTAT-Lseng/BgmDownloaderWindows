/**
 * @file 设置存取：搜索超时时间与「更多搜索」提示开关。
 *
 * 原 Expo 版用 AsyncStorage，这里改走主进程的 settings.json，读写接口保持一致。
 */

import { getApi } from './bridge'

const KEY_SEARCH_TIMEOUT = 'search_timeout'
const DEFAULT_SEARCH_TIMEOUT = 5

const KEY_MORE_SEARCH_ALERT = 'more_search_alert'
const DEFAULT_MORE_SEARCH_ALERT = true

/** 可选超时秒数 */
export const TIMEOUT_OPTIONS = [3, 5, 8, 10, 15, 20]

/** 读取搜索超时秒数；未设置或读取失败时返回默认值 5 */
export async function getSearchTimeout(): Promise<number> {
  try {
    const value = await getApi().settings.get(KEY_SEARCH_TIMEOUT)
    return value !== null && value !== '' ? Number(value) : DEFAULT_SEARCH_TIMEOUT
  } catch (e) {
    console.warn('getSearchTimeout error', e)
    return DEFAULT_SEARCH_TIMEOUT
  }
}

/** 写入搜索超时秒数；写入失败只打日志 */
export async function setSearchTimeout(timeout: number): Promise<void> {
  try {
    await getApi().settings.set(KEY_SEARCH_TIMEOUT, String(timeout))
  } catch (e) {
    console.warn('setSearchTimeout error', e)
  }
}

/** 读取「更多搜索」提示开关；默认开启 */
export async function getMoreSearchAlert(): Promise<boolean> {
  try {
    const value = await getApi().settings.get(KEY_MORE_SEARCH_ALERT)
    return value !== null ? value === 'true' : DEFAULT_MORE_SEARCH_ALERT
  } catch (e) {
    console.warn('getMoreSearchAlert', e)
    return DEFAULT_MORE_SEARCH_ALERT
  }
}

/** 写入「更多搜索」提示开关 */
export async function setMoreSearchAlert(status: boolean): Promise<void> {
  try {
    await getApi().settings.set(KEY_MORE_SEARCH_ALERT, String(status))
  } catch (e) {
    console.warn('setMoreSearchAlert', e)
  }
}
