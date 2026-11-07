/**
 * @file 首页日历：拉取 Bangumi 每日放送数据，按「今天」起始的顺序分组展示，并支持本地关键词过滤。
 * 对应原 App 的 app/(tabs)/index.tsx。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigation } from '../navigation'
import { decodeHtmlEntities } from '../utils/html'
import { RefreshIcon, SearchIcon } from '../components/Icon'

/** Bangumi 返回的星期信息 */
interface CalendarWeekday {
  en: string
  cn: string
  ja: string
  id: number // 1 ~ 7，周一为 1
}

/** Bangumi 返回的单条番剧 */
interface CalendarItem {
  id: number
  url: string
  type: number
  name: string
  name_cn: string
  summary: string
  air_date: string
  air_weekday: number
  rating?: { score?: number; total?: number }
  rank?: number
  images?: {
    large?: string
    common?: string
    medium?: string
    small?: string
    grid?: string
  }
  collection?: { doing?: number }
}

/** 按天分组后的放送列表 */
interface CalendarDay {
  weekday: CalendarWeekday
  items: CalendarItem[]
}

/** 取今天的星期序号，统一成 1 ~ 7（周一为 1）；JS 的 0 表示周日 */
function getTodayWeekdayId() {
  const jsDay = new Date().getDay()
  return jsDay === 0 ? 7 : jsDay
}

/** 优先使用中文名，没有则回退到原名 */
function pickTitle(item: CalendarItem) {
  const cn = (item.name_cn || '').trim()
  return cn.length > 0 ? cn : item.name
}

/** 按尺寸由小到大挑一张封面，都没有时返回空串 */
function pickCover(item: CalendarItem) {
  return item.images?.common || item.images?.grid || item.images?.small || item.images?.medium || item.images?.large || ''
}

/** 评分统一保留一位小数，无评分时显示占位符 */
function formatScore(score?: number) {
  if (typeof score !== 'number' || Number.isNaN(score)) return '—'
  return score.toFixed(1)
}

export function CalendarScreen() {
  const [data, setData] = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const { push } = useNavigation()

  // 用 Ref 保存最新的请求序号，避免快速刷新时旧请求覆盖新结果
  const requestIdRef = useRef(0)

  /** 拉取每日放送数据，解码 HTML 实体，并调整成以「今天」开头的顺序 */
  const fetchCalendar = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setError('')
    try {
      // 加随机 token 规避接口缓存
      const res = await fetch('https://api.bgm.tv/calendar?token=' + Math.random(), {
        headers: { Accept: 'application/json' }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = (await res.json()) as CalendarDay[]
      if (!Array.isArray(json)) throw new Error('Response is not an array')
      if (requestId !== requestIdRef.current) return

      const todayId = getTodayWeekdayId()

      // 先剔除星期信息缺失的坏数据，再按「距今天的天数」升序排列
      const cleaned = json
        .map((d) => ({
          ...d,
          // 标题、简介里的 `&amp;`、`&quot;` 等实体必须解码
          weekday: d.weekday && {
            ...d.weekday,
            cn: decodeHtmlEntities(d.weekday.cn),
            en: decodeHtmlEntities(d.weekday.en),
            ja: decodeHtmlEntities(d.weekday.ja)
          },
          items: Array.isArray(d.items)
            ? d.items.filter(Boolean).map((item) => ({
                ...item,
                name: decodeHtmlEntities(item.name),
                name_cn: decodeHtmlEntities(item.name_cn),
                summary: decodeHtmlEntities(item.summary)
              }))
            : []
        }))
        .filter((d) => d.weekday && typeof d.weekday.id === 'number')
        .sort((a, b) => {
          const aOffset = (a.weekday.id - todayId + 7) % 7
          const bOffset = (b.weekday.id - todayId + 7) % 7
          return aOffset - bOffset
        })

      setData(cleaned)
    } catch (e) {
      if (requestId !== requestIdRef.current) return
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCalendar()
  }, [fetchCalendar])

  /** 刷新：只切换刷新态，加载态复用 fetchCalendar */
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetchCalendar()
    } finally {
      setRefreshing(false)
    }
  }, [fetchCalendar])

  /** 提交搜索：关键词非空时跳转到聚合搜索页 */
  const handleSearch = () => {
    const keyword = query.trim()
    if (keyword) push({ name: 'search', q: keyword })
  }

  /** 本地过滤：命中中文名或原名任意一项即算匹配 */
  const filteredData = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return data

    return data
      .map((day) => ({
        ...day,
        items: day.items.filter(
          (item) =>
            item.name?.toLowerCase().includes(keyword) || item.name_cn?.toLowerCase().includes(keyword)
        )
      }))
      .filter((day) => day.items.length > 0)
  }, [data, query])

  return (
    <div className="page">
      <div className="calendar-toolbar">
        <div className="search-box">
          <SearchIcon />
          <input
            className="search-box__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索番剧..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch()
            }}
          />
          {query ? (
            <button className="search-box__clear" onClick={() => setQuery('')} title="清空">
              ×
            </button>
          ) : null}
        </div>

        <button
          className="icon-btn icon-btn--surface"
          onClick={() => void onRefresh()}
          disabled={refreshing || loading}
          title={refreshing ? '刷新中…' : '刷新日历'}
          aria-label={refreshing ? '刷新中…' : '刷新日历'}
        >
          <RefreshIcon className={refreshing ? 'spin' : undefined} />
        </button>
      </div>

      {loading && (
        <div className="center-state">
          <span className="spinner" />
          <p className="muted">加载中…</p>
        </div>
      )}

      {!loading && error && (
        <div className="center-state">
          <h2 className="state-title">加载失败</h2>
          <p className="muted selectable">{error}</p>
          <button className="btn" onClick={() => void fetchCalendar()}>
            重试
          </button>
        </div>
      )}

      {!loading && !error && filteredData.length === 0 && (
        <div className="center-state">
          <p className="muted">没有匹配的番剧</p>
        </div>
      )}

      {!loading &&
        !error &&
        filteredData.map((day) => (
          <section className="section" key={day.weekday.id}>
            <div className="section__header">
              <h2 className="section__title">{day.weekday.cn}</h2>
              <span className="section__meta">
                {day.weekday.en} · {day.items.length} 条
              </span>
            </div>

            <div className="grid">
              {day.items.map((item) => {
                const title = pickTitle(item)
                const cover = pickCover(item)
                const score = formatScore(item.rating?.score)
                const doing = item.collection?.doing ?? 0

                return (
                  <button
                    key={item.id}
                    className="card"
                    onClick={() => push({ name: 'search', q: title })}
                    title={title}
                  >
                    <div className="card__cover">
                      {cover ? (
                        <img src={cover} alt={title} referrerPolicy="no-referrer" />
                      ) : (
                        <span className="card__cover-placeholder">No Image</span>
                      )}
                    </div>
                    <div className="card__body">
                      <p className="card__title">{title}</p>
                      <span className="card__badge">评分 {score}</span>
                      <span className="card__meta">在看 {doing}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
    </div>
  )
}
