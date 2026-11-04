// 小肥鱼 · 每个会话的「主动出门方向」（开发板）
//
// 2026-11-03 老大提的：
//   每个会话单独控制要不要主动出门、往哪个方向出门。
//   下拉内容：无 / 跟随全局 / 平台名（动态取平台账号里的）。
//   「跟随全局」= 听平台账号那边勾上的那些；选了它，单独选平台的那个框就灰掉。
//
// 落点：behavior/sessions.json
//   { "会话": { "<sid>": "跟随全局" | "无" | "B站" },
//     "已知": [ { "id": "<sid>", "名": "会话名", "最后见": "..." } ] }
//
// ⚠️ 开发板：先在这里长，验过才合回主插件。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const 版本 = '0.1.0'
/** 没单独设过就用这个 */
export const 默认方向 = '跟随全局'
/** 「不出门」 */
export const 无 = '无'
/** 听全局的勾选 */
export const 跟随全局 = '跟随全局'
/** 每个会话默认都开「主动找事做」（2026-11-04 老大定的：每行前面一个开关，默认开） */
export const 默认开着 = true

const 读JSON = (路径, 兜底) => {
  try {
    if (!existsSync(路径)) return 兜底
    const 原 = readFileSync(路径, 'utf8')
    return 原.trim() ? JSON.parse(原) : 兜底
  } catch (error) {
    return 兜底
  }
}

const 写JSON = (路径, 值) => {
  mkdirSync(join(路径, '..'), { recursive: true })
  writeFileSync(路径, JSON.stringify(值, null, 2) + '\n', 'utf8')
}

/**
 * 建一个会话方向本。
 * @param {object} 选项 { 根, 记账 }
 */
export function 建会话本(选项 = {}) {
  const 根 = String(选项.根 || '')
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  const 文件 = 根 ? join(根, 'behavior', 'sessions.json') : ''

  const 读 = () => 读JSON(文件, { 会话: {}, 已知: [] })

  /** 某个会话的方向（没设过 = 跟随全局） */
  const 方向 = (sid) => {
    const 盘 = 读()
    const v = (盘.会话 && 盘.会话[sid]) || 默认方向
    return v
  }

  /** 改某个会话的方向；给 无 / 跟随全局 / 平台名 */
  const 设方向 = (sid, 值) => {
    if (!根 || !sid) return false
    try {
      const 盘 = 读()
      盘.会话 = { ...(盘.会话 || {}), [sid]: String(值 || 默认方向) }
      写JSON(文件, 盘)
      记账('会话 ' + String(sid).slice(-6) + ' 的出门方向改成：' + 值)
      return true
    } catch (error) {
      记账('会话方向存不上：' + String((error && error.message) || error))
      return false
    }
  }

  /** 这间会话开不开「主动找事做」（没设过 = 开） */
  const 开着 = (sid) => {
    const 盘 = 读()
    return !(盘.关闭 || []).map(String).includes(String(sid))
  }

  /** 开关某间会话的「主动找事做」；值 true = 开 */
  const 设开着 = (sid, 值) => {
    if (!根 || !sid) return false
    try {
      const 盘 = 读()
      const 关 = new Set((盘.关闭 || []).map(String))
      if (值) 关.delete(String(sid))
      else 关.add(String(sid))
      盘.关闭 = [...关]
      写JSON(文件, 盘)
      记账('会话 ' + String(sid).slice(-6) + ' 的主动找事做：' + (值 ? '开' : '关'))
      return true
    } catch (error) {
      记账('会话开关存不上：' + String((error && error.message) || error))
      return false
    }
  }

  /** 记下现在有哪些会话活着（id + 名字），给设置页列出来用 */
  const 记会话们 = (们) => {
    if (!根) return false
    try {
      const 盘 = 读()
      const 表 = new Map((盘.已知 || []).map((x) => [x.id, x]))
      const 现在 = new Date().toISOString()
      for (const a of 们 || []) {
        const sid = String((a && a.id) || '')
        if (!sid) continue
        表.set(sid, { id: sid, 名: String((a && (a.title || a.name)) || sid.slice(-6)), 最后见: 现在 })
      }
      盘.已知 = [...表.values()].slice(-20)
      写JSON(文件, 盘)
      return true
    } catch (error) {
      return false
    }
  }

  /** 设置页要看的那一份：会话 + 它现在的方向 + 开没开 */
  const 一览 = () => {
    const 盘 = 读()
    const 关 = new Set((盘.关闭 || []).map(String))
    return (盘.已知 || []).map((x) => ({
      ...x,
      方向: (盘.会话 && 盘.会话[x.id]) || 默认方向,
      开着: !关.has(String(x.id)),
    }))
  }

  return { 方向, 设方向, 开着, 设开着, 记会话们, 一览, 读 }
}
