// 小肥鱼 · 会话标题（2026-11-06）
//
// 不用 DSH 的服务拿 —— 那个得会话活着、还得赶上它已经加载完，时机很挑。
// 直接读它的标题缓存：`~/.dsh/storages/session_projcache/sessions/<id>.json`。
// 文件名两种写法都有（`session-<uuid>.json` 和裸 `<uuid>.json`），都试一遍。
// 这个办法是从心情插件（dsh-feiyu-mood）那儿学来的：稳，不看时机。
//
// 2026-11-06 晚补两件（跟 speak-up 学的）：
//   ① 标题拿不到就退一步读 `titleInput.val.first.text`（第一句话的开头）；
//   ② 读盘结果缓存三十秒，别每次刷新都去解析一个大 json。
//   还有一条它提醒过、我们已经踩过的：文件名带不带 `session-` 前缀，两种都要试。

import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const DSH家 = process.env.DSH_HOME || join(homedir(), '.dsh')
export const 缓存目录 = join(DSH家, 'storages', 'session_projcache', 'sessions')

/** 缓存多久（毫秒）：读盘那条慢路的结果 */
export const 标题缓存毫秒 = 30 * 1000
/** 超过这个大小的投影文件直接跳过，不为一个标题去啃几十兆 */
export const 投影文件上限字节 = 8 * 1024 * 1024
/** id → { 题, 到 } */
const 标题缓存 = new Map()

const 取字符串 = (值) => (typeof 值 === 'string' && 值.trim() ? 值.trim() : '')

/** 压成一行，太长截断 —— 标题里带换行会把列表撑开 */
export const 标题归一 = (文本) => {
  const 一行 = String(文本 || '').replace(/\s+/g, ' ').trim()
  if (!一行) return ''
  return 一行.length <= 24 ? 一行 : 一行.slice(0, 23) + '…'
}

/** 候选文件名：原样 + 换一种前缀写法，去重 */
export const 候选文件名 = (sid) => {
  const 原 = String(sid || '')
  if (!原) return []
  const 名单 = [原]
  if (原.startsWith('session-')) 名单.push(原.slice('session-'.length))
  else 名单.push('session-' + 原)
  return [...new Set(名单)]
}

/** `titleInput.val` 里「第一条消息」可能是对象也可能是数组，两种都认 */
const 取首条文本 = (输入) => {
  if (!输入 || typeof 输入 !== 'object') return ''
  const 首 = 输入.first !== undefined ? 输入.first : Array.isArray(输入) ? 输入[0] : undefined
  if (typeof 首 === 'string') return 取字符串(首)
  if (首 && typeof 首.text === 'string') return 取字符串(首.text)
  return ''
}

/** 读一个缓存文件，抽出标题（没有就返回空） */
const 从文件抽标题 = (sid) => {
  for (const 名 of 候选文件名(sid)) {
    const 文件 = join(缓存目录, 名 + '.json')
    try {
      if (!existsSync(文件)) continue
      const 信息 = statSync(文件)
      if (!信息.isFile() || 信息.size > 投影文件上限字节) continue
      const 原 = JSON.parse(readFileSync(文件, 'utf8'))
      const 行 = 原 && 原.record && 原.record.rows
      if (!行) continue
      const 题 = 取字符串(行.title && 行.title.val) || 取首条文本(行.titleInput && 行.titleInput.val)
      // 哪怕这次没拿到，也算「这条路走完了」—— 缓存一个空，别每次重读
      return 标题归一(题)
    } catch (error) { /* 文件不在 / 读坏了 / 不是 json —— 试下一个名字 */ }
  }
  return ''
}

/**
 * 拿一间会话的标题。
 * @param {string} sid 会话 id（带不带 `session-` 前缀都行）
 * @returns {string} 标题；拿不到给空串
 */
export function 拿标题(sid) {
  const 净 = String(sid || '').trim()
  if (!净) return ''
  const 记 = 标题缓存.get(净)
  if (记 && Date.now() < 记.到) return 记.题
  const 题 = 从文件抽标题(净)
  标题缓存.set(净, { 题, 到: Date.now() + 标题缓存毫秒 })
  if (标题缓存.size > 500) {
    const 现在 = Date.now()
    for (const [k, v] of 标题缓存) if (现在 >= v.到) 标题缓存.delete(k)
  }
  return 题
}

/** 这间会话是不是空白会话（新建还没说话） */
export function 是空的(sid) {
  const 净 = String(sid || '').trim()
  if (!净) return true
  for (const 名 of 候选文件名(净)) {
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

/**
 * 读一间会话的元信息（2026-11-06）：标题、空不空、最后一次说话的时间。
 * 设置页列会话时用它筛掉很久没动的 —— 工作区里早就看不到的那些，别往列表里塞。
 */
export function 读元信息(sid) {
  const 净 = String(sid || '').trim()
  if (!净) return null
  for (const 名 of 候选文件名(净)) {
    try {
      const 文件 = join(缓存目录, 名 + '.json')
      if (!existsSync(文件)) continue
      const 原 = JSON.parse(readFileSync(文件, 'utf8'))
      const 行 = (原 && 原.record && 原.record.rows) || {}
      const 元 = (行.sessionListMetadata && 行.sessionListMetadata.val) || {}
      return {
        题: 标题归一(取字符串(行.title && 行.title.val) || 取首条文本(行.titleInput && 行.titleInput.val)),
        空: Boolean(元.blank),
        最后说话: Number(元.lastPromptAt || 0),
      }
    } catch (error) { /* 换下一个写法 */ }
  }
  return null
}
