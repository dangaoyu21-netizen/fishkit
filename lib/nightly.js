// 小肥鱼人格 · 夜巡：每晚自动整理 + 把当天的工具失败记进错题本
//
// 一天跑一次（22 点后），不打扰白天。

import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { 拆词 } from './recall.js'

export function 建夜巡(档案, 整理器, 记账) {
  let 上次跑的日 = ''

  const 今天 = () => new Date().toISOString().slice(0, 10)

  const 日志目录 = () => {
    const 基 = process.env.APPDATA || join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
    return join(基, 'DSH Desktop', 'logs', 'host')
  }

  /** 扫当天的 error log，把工具失败按「工具+失败码」归一条错题 */
  const 扫错题 = () => {
    const 日 = 今天()
    const 文件 = join(日志目录(), 'dsh-' + 日 + '.error.log')
    if (!existsSync(文件)) return 0
    let 行们 = []
    try { 行们 = readFileSync(文件, 'utf8').split('\n') } catch (error) { return 0 }
    const 见过 = new Set()
    try {
      for (const 旧 of (档案.读状态().mistakes || [])) 见过.add(旧.title || '')
    } catch (error) {}
    let 加了几条 = 0
    for (const 行 of 行们) {
      if (!行.trim()) continue
      let d
      try { d = JSON.parse(行) } catch (error) { continue }
      const f = d && d.fields
      if (!f || f.event !== 'execute.failed') continue
      const 工具 = String(f.tool || '')
      const 码 = String(f.failureCode || '')
      if (!工具 || !码) continue
      const 标题 = 工具 + ' · ' + 码
      if (见过.has(标题)) continue
      见过.add(标题)
      档案.加错题({
        id: 'm-' + Date.now() + '-' + 加了几条,
        time: new Date().toISOString(),
        title: 标题,
        symptom: '工具调用失败（自动从日志里记的）',
        cause: String((d.error && d.error.message) || '').slice(0, 200),
        fix: '',
        lesson: '下次先看这个失败码，别硬试',
        status: '自动记录',
      })
      加了几条++
    }
    if (加了几条) 记账('夜巡：记了 ' + 加了几条 + ' 条错题')
    return 加了几条
  }

  /**
   * 把今天的热词抽出来存一份（2026-11-04）。
   * 白天检索时命中了就翻倍 —— 让「最近在聊什么」真的压秤。
   */
  const 抽关键词 = () => {
    try {
      const 状态 = 档案.读状态()
      const 事件们 = Array.isArray(状态.events) ? 状态.events : []
      const 今 = new Date()
      const 起 = new Date(今.getFullYear(), 今.getMonth(), 今.getDate()).getTime()
      const 计 = new Map()
      for (const e of 事件们) {
        const t = Date.parse(String(e.time || '')) || 0
        if (!t || t < 起) continue
        for (const 词 of 拆词(String(e.summary || ''))) {
          const 净 = String(词 || '')
          if (!净 || 净.startsWith('同:') || 净.length < 2) continue
          计.set(净, (计.get(净) || 0) + 1)
        }
      }
      const 词们 = [...计.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map((x) => x[0])
      if (!词们.length) return 0
      const 目录 = join(档案.根, 'memory')
      mkdirSync(目录, { recursive: true })
      appendFileSync(join(目录, 'keywords.jsonl'), JSON.stringify({ 日: 今天(), time: new Date().toISOString(), 词们 }) + '\n', 'utf8')
      return 词们.length
    } catch (error) {
      记账('夜巡抽关键词失败：' + String((error && error.message) || error))
      return 0
    }
  }

  const 跑 = (参数 = {}) => {
    const 日 = 今天()
    if (上次跑的日 === 日 && !参数.强制) return { ok: true, 说: '今天已经跑过夜巡' }
    const 时 = new Date().getHours()
    if (时 < 22 && !参数.强制) return { ok: true, 说: '还没到 22 点，先不整理' }
    // 强制跑（手动测试）不占「今天已跑」的名额，别让凌晨的测试把晚上的夜巡挡掉
    if (!参数.强制) 上次跑的日 = 日
    let 整理结果 = null
    try { 整理结果 = 整理器.整理({ 最近: 30 }) } catch (error) { 记账('夜巡整理失败：' + String((error && error.message) || error)) }
    let 错题数 = 0
    try { 错题数 = 扫错题() } catch (error) { 记账('夜巡扫错题失败：' + String((error && error.message) || error)) }
    let 词数 = 0
    try { 词数 = 抽关键词() } catch (error) { 记账('夜巡抽关键词失败：' + String((error && error.message) || error)) }
    记账('夜巡完成：' + (整理结果 && 整理结果.说 || '未整理') + '；错题 ' + 错题数 + '；关键词 ' + 词数)
    return { ok: true, 整理: 整理结果, 错题数, 词数 }
  }

  return { 跑 }
}
