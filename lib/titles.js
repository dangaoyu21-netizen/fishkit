// 小肥鱼 · 会话标题（2026-11-06）
//
// 不用 DSH 的服务拿 —— 那个得会话活着、还得赶上它已经加载完，时机很挑。
// 直接读它的标题缓存：`~/.dsh/storages/session_projcache/sessions/<id>.json`。
// 文件名两种写法都有（`session-<uuid>.json` 和裸 `<uuid>.json`），都试一遍。
// 这个办法是从心情插件（dsh-feiyu-mood）那儿学来的：稳，不看时机。

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const DSH家 = process.env.DSH_HOME || join(homedir(), '.dsh')
export const 缓存目录 = join(DSH家, 'storages', 'session_projcache', 'sessions')

/**
 * 拿一间会话的标题。
 * @param {string} sid 会话 id（带不带 `session-` 前缀都行）
 * @returns {string} 标题；拿不到给空串
 */
export function 拿标题(sid) {
  const 净 = String(sid || '').trim()
  if (!净) return ''
  const 去前缀 = 净.replace(/^session-/, '')
  const 名们 = [净, 去前缀, 'session-' + 去前缀]
  for (const 名 of 名们) {
    try {
      const 文件 = join(缓存目录, 名 + '.json')
      if (!existsSync(文件)) continue
      const 原 = JSON.parse(readFileSync(文件, 'utf8'))
      const 行 = 原 && 原.record && 原.record.rows
      const 题 = 行 && 行.title && 行.title.val
      if (题) return String(题)
    } catch (error) { /* 这个写法不行就试下一个 */ }
  }
  return ''
}

/** 这间会话是不是空白会话（新建还没说话） */
export function 是空的(sid) {
  const 净 = String(sid || '').trim()
  if (!净) return true
  const 去前缀 = 净.replace(/^session-/, '')
  for (const 名 of [净, 去前缀, 'session-' + 去前缀]) {
    try {
      const 文件 = join(缓存目录, 名 + '.json')
      if (!existsSync(文件)) continue
      const 原 = JSON.parse(readFileSync(文件, 'utf8'))
      const 行 = 原 && 原.record && 原.record.rows
      return Boolean(行 && 行.sessionListMetadata && 行.sessionListMetadata.val && 行.sessionListMetadata.val.blank)
    } catch (error) {}
  }
  return false
}
