// 小肥鱼 · 按天归纳（开发板）
//
// 2026-11-16 老大定的：同一段时间聊了好几回，散着记会分不清前后，所以要按天归到一起。
// 这一版只做「骨架」：把最近几天的事件按天归类，给整理时当线索用。
// 「先…再…最后…」那种真正的归纳，还是等模型整理的时候写（写进 episodes.jsonl 的「归纳」字段）。
//
// 落盘：.fishsoul/memory/episodes.jsonl
//   一行一天：{ "日": "2026-11-16", "条们": ["事一", "事二"], "归纳": "" }
//   「归纳」留空——等哪天整理时想写就写，不写也不影响。

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

export const 版本 = '0.1.0'
/** 整理时看最近几天 */
export const 默认天数 = 3
/** 每天最多列几条（多了变噪音） */
export const 每天上限 = 8

const 读JSONL = (路径) => {
  try {
    if (!existsSync(路径)) return []
    const 出 = []
    for (const 行 of readFileSync(路径, 'utf8').split('\n')) {
      if (!行.trim()) continue
      try { 出.push(JSON.parse(行)) } catch (error) {}
    }
    return 出
  } catch (error) {
    return []
  }
}

/** 一个时间戳 → 本地日期（YYYY-MM-DD） */
export const 日期 = (时间) => {
  const d = new Date(String(时间 || ''))
  if (Number.isNaN(d.getTime())) return ''
  const 补 = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + 补(d.getMonth() + 1) + '-' + 补(d.getDate())
}

/**
 * 把事件按天分组。
 * @param {Array} 事件们 至少要 { time, summary }
 * @returns {Map<string, string[]>}
 */
export function 按天分组(事件们) {
  const 天们 = new Map()
  for (const e of 事件们 || []) {
    const 日 = 日期(e && e.time)
    const 原 = String((e && e.summary) || '').trim()
    // 系统注入（「（没人找你…」）不是「事」，别混进归纳里
    if (!日 || !原 || 原.startsWith('（') || 原.startsWith('(')) continue
    const 文 = 原.length > 36 ? 原.slice(0, 36) + '…' : 原
    if (!天们.has(日)) 天们.set(日, [])
    const 们 = 天们.get(日)
    if (们.length < 每天上限 && !们.includes(文)) 们.push(文)
  }
  return 天们
}

/**
 * 建一个归纳本。
 * @param {object} 选项 { 根, 记账 }
 */
export function 建归纳(选项 = {}) {
  const 根 = String(选项.根 || '')
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  const 文件 = 根 ? join(根, 'memory', 'episodes.jsonl') : ''

  /** 读全部 */
  const 全部 = () => (根 ? 读JSONL(文件) : [])

  /**
   * 最近几天的事，给整理当线索。
   * @param {number} 天数 默认三天
   * @returns {string} 一句一段的文本，没东西就空串
   */
  const 最近几天 = (天数 = 默认天数) => {
    const 事件们 = 根 ? 读JSONL(join(根, 'memory', 'events.jsonl')) : []
    if (!事件们.length) return ''
    const 天们 = 按天分组(事件们)
    const 排序天 = [...天们.keys()].sort().reverse().slice(0, Math.max(1, 天数))
    if (!排序天.length) return ''
    const 行们 = []
    for (const 日 of 排序天) {
      const 们 = 天们.get(日) || []
      if (!们.length) continue
      行们.push(日 + '：' + 们.slice(0, 5).join('；'))
    }
    if (!行们.length) return ''
    return '最近这几天的事（要合零碎就照这个来，记得带顺序）：\n' + 行们.join('\n')
  }

  /**
   * 写一天的归纳（覆盖而不是追加——同一天只留一条归纳）。
   * @param {object} 参数 { 日, 归纳, 条们 }
   */
  const 写归纳 = (参数 = {}) => {
    if (!根) return false
    const 日 = String(参数.日 || 日期(Date.now()))
    const 归纳 = String(参数.归纳 || '').trim()
    if (!日 || !归纳) return false
    try {
      const 现有 = 全部()
      const 位 = 现有.findIndex((x) => x && x.日 === 日)
      const 条 = {
        日,
        条们: Array.isArray(参数.条们) ? 参数.条们.slice(0, 每天上限) : (位 >= 0 ? 现有[位].条们 || [] : []),
        归纳: 归纳.slice(0, 800),
      }
      if (位 >= 0) 现有[位] = 条
      else 现有.push(条)
      现有.sort((a, b) => String(a.日).localeCompare(String(b.日)))
      mkdirSync(join(文件, '..'), { recursive: true })
      writeFileSync(文件, 现有.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8')
      记账('归纳写了 ' + 日)
      return true
    } catch (error) {
      记账('归纳没写成：' + String((error && error.message) || error))
      return false
    }
  }

  return { 全部, 最近几天, 写归纳 }
}

/**
 * 读档案各目录的 L0 摘要（`.abstract.md` 第一句）。
 * 2026-11-16 学 OpenViking：先看摘要，再决定进不进去翻。
 * @param {string} 根 档案根
 * @returns {string} 一句一段的概览，没有就空串
 */
export function 读目录摘要(根) {
  const 名们 = ['memory', 'persona', 'mood', 'behavior', 'style', 'attitude', 'status', 'docs']
  const 行们 = []
  for (const 名 of 名们) {
    try {
      const p = join(String(根 || ''), 名, '.abstract.md')
      if (!existsSync(p)) continue
      let 文 = readFileSync(p, 'utf8').replace(/^\uFEFF/, '')
      // 去掉「# 这里是什么」那种标题，只留正文第一行
      const 行 = 文.split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('#'))
      if (行.length) 行们.push(名 + '：' + 行[0])
    } catch (error) {}
  }
  if (!行们.length) return ''
  return '档案里都有什么（先看这个，要细节再去翻）：\n' + 行们.join('\n')
}
