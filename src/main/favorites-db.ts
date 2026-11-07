/**
 * @file 收藏的本地存储（SQLite / better-sqlite3）。
 *
 * 由原 Expo 版的 expo-sqlite 迁移而来，表结构与语义保持一致，
 * 便于后续迁移旧数据。所有方法都是同步的，IPC 层再包成 Promise。
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import type { FavoriteItem, FavoriteListOptions } from '@shared/types'

const TABLE = 'favorites'

/** 校验必填字段，空白值直接抛错，避免脏数据落库 */
function assertNonEmpty(v: string, field: string) {
  if (!v || !v.trim()) throw new Error(`${field}不能为空`)
}

/** 统一去除首尾空白 */
function norm(s: string) {
  return (s ?? '').trim()
}

let db: Database.Database | null = null

/** 获取（并懒初始化）数据库连接 */
function getDb(): Database.Database {
  if (db) return db

  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const dbPath = path.join(dir, 'app.db')

  db = new Database(dbPath)
  // WAL 让读写互不阻塞，与原 Expo 版保持一致
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      name TEXT NOT NULL,
      url  TEXT NOT NULL UNIQUE
    );
    CREATE INDEX IF NOT EXISTS idx_${TABLE}_name ON ${TABLE}(name);
  `)
  return db
}

/** 关闭数据库连接（退出前调用，确保 WAL 落盘） */
export function closeFavoritesDb() {
  if (!db) return
  try {
    db.close()
  } catch {
    /* 忽略关闭异常 */
  }
  db = null
}

export const favoritesDb = {
  init() {
    getDb()
  },

  /** 按 url 冲突时只更新名称 */
  upsert(item: FavoriteItem) {
    const name = norm(item.name)
    const url = norm(item.url)
    assertNonEmpty(name, 'name')
    assertNonEmpty(url, 'url')

    getDb()
      .prepare(
        `INSERT INTO ${TABLE} (name, url) VALUES (?, ?)
         ON CONFLICT(url) DO UPDATE SET name = excluded.name;`
      )
      .run(name, url)
  },

  /** 判断该 url 是否已收藏 */
  exists(url: string) {
    const u = norm(url)
    assertNonEmpty(u, 'url')
    const row = getDb().prepare(`SELECT COUNT(1) AS cnt FROM ${TABLE} WHERE url = ?;`).get(u) as
      | { cnt: number }
      | undefined
    return (row?.cnt ?? 0) > 0
  },

  /** 分页列出收藏；关键字同时匹配名称与 url，排序字段走白名单 */
  list(opts: FavoriteListOptions = {}): FavoriteItem[] {
    const { limit = 200, offset = 0, keyword, orderBy = 'name', order = 'ASC' } = opts
    const safeOrderBy = orderBy === 'url' ? 'url' : 'name'
    const safeOrder = order === 'DESC' ? 'DESC' : 'ASC'
    const database = getDb()

    if (keyword && keyword.trim()) {
      const kw = `%${keyword.trim()}%`
      return database
        .prepare(
          `SELECT name, url FROM ${TABLE}
           WHERE name LIKE ? OR url LIKE ?
           ORDER BY ${safeOrderBy} ${safeOrder}
           LIMIT ? OFFSET ?;`
        )
        .all(kw, kw, limit, offset) as FavoriteItem[]
    }

    return database
      .prepare(
        `SELECT name, url FROM ${TABLE}
         ORDER BY ${safeOrderBy} ${safeOrder}
         LIMIT ? OFFSET ?;`
      )
      .all(limit, offset) as FavoriteItem[]
  },

  /** 按 url 删除一条收藏 */
  removeByUrl(url: string) {
    const u = norm(url)
    assertNonEmpty(u, 'url')
    getDb().prepare(`DELETE FROM ${TABLE} WHERE url = ?;`).run(u)
  }
}
