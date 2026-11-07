/**
 * @file 源列表页：列出所有已启用的可搜索站点，点击后在内嵌浏览器中打开。
 * 对应原 App 的 app/(tabs)/source.tsx。
 */

import { useEffect, useState } from 'react'
import type { SourceItem } from '@shared/types'
import { useNavigation } from '../navigation'
import { loadSources, SOURCES_USER_AGENT } from '../services/sources'
import { fallbackIcon, sourceIconUrl } from '../utils/icons'

export function SourceScreen() {
  const [items, setItems] = useState<SourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const { push } = useNavigation()

  useEffect(() => {
    loadSources()
      .then((list) => setItems(list.filter((item) => item.enabled)))
      .catch((e) => console.error('读取站点列表失败:', e))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="page">
        <div className="center-state">
          <span className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="list">
        {items.map((item) => (
          <button
            key={item.id}
            className="source-card"
            onClick={() =>
              push({
                name: 'webview',
                url: item.url,
                type: 'sources',
                userAgent: SOURCES_USER_AGENT,
                title: item.name
              })
            }
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
      </div>
    </div>
  )
}
