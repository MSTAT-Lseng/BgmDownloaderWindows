/**
 * @file 更多搜索页：列出未做接口适配的站点，供用户手动跳转检索。
 * 对应原 App 的 app/pages/more_search.tsx。
 */

import { useEffect, useState } from 'react'
import type { SourceItem } from '@shared/types'
import { useNavigation } from '../navigation'
import { loadSources } from '../services/sources'
import { fallbackIcon, sourceIconUrl } from '../utils/icons'

export function MoreSearchScreen() {
  const [items, setItems] = useState<SourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const { push } = useNavigation()

  useEffect(() => {
    loadSources()
      // 只展示已启用但没有做接口适配的站点
      .then((list) => setItems(list.filter((item) => item.adaptation === false && item.enabled === true)))
      .catch((e) => console.error('读取站点列表失败:', e))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <div className="list">
        {loading ? (
          <div className="center-state">
            <span className="spinner" />
          </div>
        ) : items.length === 0 ? (
          <p className="empty-text">暂无可手动检索的站点</p>
        ) : (
          <>
            <p className="page-hint">以下站点未适配聚合搜索，点击后在内置浏览器中手动检索。</p>
            {items.map((item) => (
              <button
                key={item.id}
                className="source-card"
                onClick={() => push({ name: 'webview', url: item.url, type: 'player', title: item.name })}
                title={item.url}
              >
                <img
                  className="source-card__icon"
                  src={sourceIconUrl(item.icon)}
                  alt=""
                  onError={fallbackIcon}
                />
                <div className="source-card__info">
                  <p className="source-card__name">{item.name}</p>
                  {item.desc ? <p className="source-card__desc">{item.desc}</p> : null}
                  <p className="source-card__url">{item.url}</p>
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
