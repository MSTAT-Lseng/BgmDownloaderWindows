/**
 * @file 聚合搜索页：并发请求所有已适配站点，用各站点配置里的正则解析结果，并按站点分组展示。
 * 对应原 App 的 app/search.tsx。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation } from '../navigation'
import { useToast } from '../services/toast'
import { CYCANI_USER_AGENT, aggregateSearch, isCycaniUrl, type GroupedResult } from '../services/sources'
import { getMoreSearchAlert, getSearchTimeout, setMoreSearchAlert } from '../services/settings'
import { getApi } from '../services/bridge'

interface SearchScreenProps {
  q: string
}

export function SearchScreen({ q }: SearchScreenProps) {
  const [results, setResults] = useState<GroupedResult[]>([])
  const [loading, setLoading] = useState(false)
  const { push } = useNavigation()
  const { show } = useToast()

  // 每次搜索自增，用于丢弃过期请求的结果
  const runIdRef = useRef(0)

  const handleSearch = useCallback(
    async (keyword: string) => {
      const runId = ++runIdRef.current
      setLoading(true)
      setResults([])

      try {
        // 超时时间每次实时读取，保证设置页修改后立即生效
        const timeout = await getSearchTimeout()

        await aggregateSearch(
          keyword,
          timeout,
          (result) => {
            if (runId !== runIdRef.current) return
            // 拿到一个就展示一个
            setResults((prev) => [...prev, result])
          },
          (sourceName) => {
            if (runId !== runIdRef.current) return
            show(`${sourceName} 搜索超时`)
          }
        )
      } catch (e) {
        console.error('聚合搜索失败:', e)
      } finally {
        if (runId === runIdRef.current) {
          setLoading(false)
          // 只在第一次搜索时提示右上角还有更多站点，提示后立即写回
          const alertStatus = await getMoreSearchAlert()
          if (alertStatus) {
            await setMoreSearchAlert(false)
            void getApi().alert({
              title: '提示',
              message: '如果没有找到您想要的动漫，可以点击标题栏右上角使用更多的网站来手动检索。'
            })
          }
        }
      }
    },
    [show]
  )

  useEffect(() => {
    if (q) void handleSearch(q)
  }, [q, handleSearch])

  /** 打开某个地址的内置浏览器；次元城需要带移动端 UA */
  const openPlayer = (url: string) => {
    push({
      name: 'webview',
      url,
      type: 'player',
      ...(isCycaniUrl(url) ? { userAgent: CYCANI_USER_AGENT } : {})
    })
  }

  return (
    <div className="page">
      <div className="list">
        {results.map((group) => (
          <section className="result-group" key={group.sourceName}>
            <div className="result-group__header">
              <div className="result-group__info">
                <p className="result-group__title" title={group.sourceName}>
                  {group.sourceName}
                </p>
                <p className="result-group__url" title={group.sourceUrl}>
                  {group.sourceUrl}
                </p>
              </div>
              <button
                className="btn btn--danger btn--sm"
                onClick={() =>
                  push({
                    name: 'webview',
                    url: group.moreUrl,
                    type: 'player',
                    ...(isCycaniUrl(group.sourceUrl) ? { userAgent: CYCANI_USER_AGENT } : {})
                  })
                }
              >
                查看全部
              </button>
            </div>

            <div className="result-row">
              {group.data.map((res) => (
                <button
                  key={res.id}
                  className="result-item"
                  onClick={() => openPlayer(res.url)}
                  title={`${res.title}\n${res.url}`}
                >
                  <div className="result-item__cover">
                    {res.image ? (
                      // 不用 loading="lazy"：滚动容器的懒加载判定在桌面端不可靠，
                      // 会出现图片一直停在未加载状态
                      <img
                        src={res.image}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          // 个别站点的封面会 404，换成占位样式避免留白
                          e.currentTarget.parentElement?.classList.add('result-item__cover--empty')
                        }}
                      />
                    ) : (
                      <span className="result-item__placeholder">No Image</span>
                    )}
                  </div>
                  <p className="result-item__title">{res.title}</p>
                </button>
              ))}
            </div>
          </section>
        ))}

        {!loading && results.length === 0 && <p className="empty-text">未找到相关内容</p>}
      </div>

      {loading && (
        <div className="loading-overlay">
          <span className="spinner spinner--lg" />
          <p>正在搜索...</p>
        </div>
      )}
    </div>
  )
}
