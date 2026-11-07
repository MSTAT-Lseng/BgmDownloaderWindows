/**
 * @file 站点数据与聚合搜索。
 *
 * 与原 Expo 版 search.tsx 中的解析逻辑一一对应：按各站点 config_<id>.json
 * 里的正则抓取结果，只是把「渲染进程 fetch」换成「主进程 fetchText」以绕开 CORS。
 */

import type { SearchConfig, SourceItem } from '@shared/types'
import { getApi } from './bridge'

/** 单条搜索结果 */
export interface SearchResult {
  id: string
  title: string
  image: string
  url: string
  sourceName: string
}

/** 按站点分组后的搜索结果；moreUrl 为「查看全部」跳转地址 */
export interface GroupedResult {
  sourceName: string
  sourceUrl: string
  moreUrl: string
  data: SearchResult[]
  /** 站点图标文件名（不含扩展名） */
  icon: string
}

/** 聚合搜索默认 UA：伪装成桌面 Chrome */
export const SEARCH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

/** 次元城（cycani）移动端 UA，部分站点按 UA 下发不同页面 */
export const CYCANI_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

/** 站点列表页跳转内置浏览器时附带的 UA */
export const SOURCES_USER_AGENT = CYCANI_USER_AGENT

// 稀饭动漫（xifanacg），其 Supabase 接口需要 apikey 鉴权
const XIFANACG_API_KEY = 'sb_publishable_OBIVAWACIX6lPXrO98_z24_HcsmalkA'
const isXifanacgUrl = (url: string) => url.includes('xifanacg')

const GIRIGIRILOVE_HOST = 'https://ani.girigirilove.com'
const isGirigiriloveUrl = (url: string) => url.includes('girigirilove')

export const isCycaniUrl = (url: string) => url.includes('cycani.org')

/** 把配置里的 {q} 占位符替换为搜索词，支持嵌套对象与数组 */
function fillKeyword(value: unknown, keyword: string): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{q\}/g, keyword)
  }
  if (Array.isArray(value)) {
    return value.map((item) => fillKeyword(item, keyword))
  }
  if (value && typeof value === 'object') {
    const filled: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      filled[key] = fillKeyword(item, keyword)
    }
    return filled
  }
  return value
}

/** 从 girigirilove 的各种结果链接中提取 vod_id，取不到时返回空串 */
function extractGirigiriloveVodId(url: string): string {
  if (!url) return ''
  const patterns = [
    /\/detail\/([A-Za-z0-9_-]+?)(?:\.html)?(?:[/?#]|$)/, // /detail/123
    /[?&](?:vod_id|id)=([A-Za-z0-9_-]+)/, // ?vod_id=123 / ?id=123
    /\/(\d+)(?:\.html)?(?:[/?#]|$)/ // /xxx/123.html 或 /xxx/123/
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return ''
}

/** 还原 JSON 接口返回的转义字符（如封面地址里的 \\u0026） */
function decodeJsonEscapes(value: string): string {
  if (!value || !value.includes('\\')) return value
  try {
    return JSON.parse(`"${value}"`)
  } catch {
    return value
  }
}

/** 按配置里的 item_regex 和字段下标，把响应文本解析成结果列表 */
function parseHtml(
  html: string,
  config: SearchConfig['search_config'],
  sourceName: string,
  host: string
): SearchResult[] {
  const { item_regex, fields, details_format } = config
  const list: SearchResult[] = []

  // 加 g 标志才能逐个匹配所有条目
  let regex: RegExp
  try {
    regex = new RegExp(item_regex, 'g')
  } catch (e) {
    console.warn(`${sourceName} 的正则无效:`, e)
    return list
  }

  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    // 零宽匹配保护，避免死循环
    if (match[0] === '') {
      regex.lastIndex += 1
      continue
    }

    let image = decodeJsonEscapes(match[fields.image.match_index] || '')
    const url = match[fields.url.match_index] || ''
    let title = decodeJsonEscapes(match[fields.title.match_index] || '')

    // 部分站点的标题值里混有 span 标签，需要剥掉
    if (title.includes('<span')) {
      title = title.replace(/<\/?span[^>]*>/g, '')
    }

    // 相对路径的封面要补上站点域名
    if (image.startsWith('/')) {
      image = host + image
    }

    // 百度封面链接里的 &amp; 要还原成 &
    if (image.includes('baidu.com')) {
      image = image.replace(/&amp;/g, '&')
    }

    if (title && url) {
      const rawUrl = url.trim()
      let finalUrl = details_format.replace('{host}', host).replace('{result}', rawUrl)

      // girigirilove 的条目不直接跳原链接，统一改写为站内详情页地址
      if (isGirigiriloveUrl(host)) {
        const vodId = extractGirigiriloveVodId(rawUrl) || extractGirigiriloveVodId(finalUrl)
        if (vodId) {
          finalUrl = `${GIRIGIRILOVE_HOST}/detail/${vodId}`
        }
      }

      list.push({
        id: `${sourceName}-${url}`, // 用站点名 + 原始地址拼一个临时唯一 ID
        title: title.trim(),
        image: image.trim(),
        url: finalUrl,
        sourceName
      })
    }
  }

  return list
}

/** 站点与配置缓存，避免每次搜索都走一次 IPC */
let sourcesCache: SourceItem[] | null = null
let configsCache: Record<number, SearchConfig> | null = null

/** 读取全量站点（含未启用项） */
export async function loadSources(): Promise<SourceItem[]> {
  if (!sourcesCache) sourcesCache = await getApi().getSources()
  return sourcesCache
}

/** 读取全部站点搜索配置 */
export async function loadSourceConfigs(): Promise<Record<number, SearchConfig>> {
  if (!configsCache) configsCache = await getApi().getSourceConfigs()
  return configsCache
}

/** 单个站点的搜索任务；超时或异常时返回 null */
async function searchOne(
  source: SourceItem,
  config: SearchConfig,
  keyword: string,
  timeoutSeconds: number
): Promise<GroupedResult | null> {
  const { search_config } = config
  const { cookie } = search_config

  const searchUrl = search_config.url
    .replace('{q}', encodeURIComponent(keyword))
    .replace('{host}', source.url)

  const isXifanacg = isXifanacgUrl(source.url)

  // 「查看全部」地址：girigirilove / 次元城 / 稀饭动漫各有自己的站内搜索页，其余沿用搜索地址
  const moreUrl = isGirigiriloveUrl(source.url)
    ? `${GIRIGIRILOVE_HOST}/search?q=${encodeURIComponent(keyword)}`
    : isCycaniUrl(source.url)
      ? `${source.url.replace(/\/+$/, '')}/category?q=${encodeURIComponent(keyword)}`
      : isXifanacg
        ? `https://next.xifanacg.com/search?q=${encodeURIComponent(keyword)}`
        : searchUrl

  // 只有配置里声明了 body 才发 POST（如稀饭动漫的 Supabase 接口）
  const requestBody = search_config.body ? JSON.stringify(fillKeyword(search_config.body, keyword)) : undefined

  const headers: Record<string, string> = {
    'User-Agent': SEARCH_USER_AGENT,
    Priority: 'u=3, i',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    ...(cookie ? { Cookie: cookie } : {}),
    // 次元城的搜索接口要求携带 x-app-name
    ...(isCycaniUrl(source.url) ? { 'x-app-name': 'cyc_web' } : {}),
    ...(isXifanacg
      ? {
          apikey: XIFANACG_API_KEY,
          authorization: `Bearer ${XIFANACG_API_KEY}`,
          'Content-Type': 'application/json'
        }
      : {})
  }

  try {
    const res = await getApi().fetchText({
      url: searchUrl,
      method: search_config.method || 'GET',
      headers,
      body: requestBody,
      timeout: timeoutSeconds
    })

    const data = parseHtml(res.text, search_config, source.name, source.url)
    if (data.length === 0) return null

    return { sourceName: source.name, sourceUrl: source.url, moreUrl, data, icon: source.icon }
  } catch (err) {
    const e = err as Error & { message?: string }
    // IPC 抛出的错误信息里带 Error invoking remote method 前缀，这里做一次提取
    const message = String(e?.message ?? err)
    if (message.includes('TIMEOUT') || e?.name === 'TimeoutError') {
      console.warn(`${source.name} 搜索超时`)
      throw Object.assign(new Error('TIMEOUT'), { sourceName: source.name })
    }
    console.error(`${source.name} 搜索失败:`, err)
    return null
  }
}

/**
 * 并发搜索所有已适配站点，拿到一个就回调一个。
 *
 * @param onResult 每有一个站点返回结果就触发一次（用于「拿到一个就展示一个」的交互）
 * @param onTimeout 超时的站点名回调，用于 Toast 提示
 */
export async function aggregateSearch(
  keyword: string,
  timeoutSeconds: number,
  onResult: (result: GroupedResult) => void,
  onTimeout?: (sourceName: string) => void
): Promise<void> {
  const [sources, configs] = await Promise.all([loadSources(), loadSourceConfigs()])
  const activeSources = sources.filter((s) => s.enabled && s.adaptation)

  const tasks = activeSources.map(async (source) => {
    const config = configs[source.id]
    if (!config) return

    try {
      const result = await searchOne(source, config, keyword, timeoutSeconds)
      if (result) onResult(result)
    } catch (e) {
      const err = e as Error & { sourceName?: string }
      if (err.message === 'TIMEOUT') onTimeout?.(err.sourceName ?? source.name)
    }
  })

  await Promise.allSettled(tasks)
}
