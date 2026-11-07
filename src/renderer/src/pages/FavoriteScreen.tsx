/**
 * @file 收藏页：读取本地收藏列表，支持点击打开、右键 / 长按删除，并在回到页面时自动刷新。
 * 对应原 App 的 app/(tabs)/favorite.tsx。
 */

import { useCallback, useEffect, useState } from 'react'
import type { FavoriteItem } from '@shared/types'
import { useNavigation } from '../navigation'
import { getApi } from '../services/bridge'
import { useConfirm } from '../services/confirm'

export function FavoriteScreen() {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const { push, route, activeTab } = useNavigation()
  const confirm = useConfirm()

  /** 从数据库读取全部收藏，按名称升序 */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const api = getApi()
      await api.favorites.init()
      setItems(await api.favorites.list({ orderBy: 'name', order: 'ASC' }))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  // 页面每次出现（包括从内置浏览器返回）都重新加载，保证新收藏及时出现。
  // 依赖 activeTab / route 的变化作为「获得焦点」的近似信号。
  useEffect(() => {
    void load()
  }, [load, activeTab, route])

  /** 以播放页模式打开收藏的地址 */
  const onOpen = useCallback(
    (url: string) => {
      push({ name: 'webview', url, type: 'player' })
    },
    [push]
  )

  /** 删除确认后同步更新列表，避免重新查库带来的等待 */
  const onDelete = useCallback(
    async (it: FavoriteItem) => {
      const ok = await confirm({
        title: '删除收藏？',
        detail: `确定删除「${it.name}」吗？\n\n${it.url}`,
        confirmText: '删除',
        danger: true
      })
      if (!ok) return
      try {
        await getApi().favorites.removeByUrl(it.url)
        setItems((prev) => prev.filter((x) => x.url !== it.url))
      } catch (e) {
        console.error(e)
        await getApi().alert({ type: 'error', title: '删除失败', message: '请稍后重试' })
      }
    },
    [confirm]
  )

  if (loading && items.length === 0) {
    return (
      <div className="page">
        <div className="center-state">
          <span className="spinner" />
          <p className="muted">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {items.length === 0 ? (
        <div className="center-state">
          <div className="empty-card">
            <p className="empty-card__title">暂无收藏</p>
            <p className="empty-card__desc">在播放页点击右上角的星标即可收藏，之后会显示在这里</p>
          </div>
        </div>
      ) : (
        <div className="list">
          {items.map((item) => (
            <div
              key={item.url}
              className="fav-card"
              onContextMenu={(e) => {
                e.preventDefault()
                void onDelete(item)
              }}
            >
              <div className="fav-card__header">
                <p className="fav-card__name" title={item.name}>
                  {item.name}
                </p>
                <span className="fav-card__badge">收藏</span>
              </div>
              <p className="fav-card__url" title={item.url}>
                {item.url}
              </p>
              <div className="fav-card__footer">
                <button className="link-btn" onClick={() => onOpen(item.url)}>
                  打开播放
                </button>
                <button className="link-btn link-btn--danger" onClick={() => void onDelete(item)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
