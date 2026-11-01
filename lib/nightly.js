// 小肥鱼人格 · 夜巡：每晚自动整理 + 把当天的工具失败记进错题本
//
// 一天跑一次（22 点后），不打扰白天。

import { existsSync, readFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

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
    记账('夜巡完成：' + (整理结果 && 整理结果.说 || '未整理') + '；错题 ' + 错题数)
    return { ok: true, 整理: 整理结果, 错题数 }
  }

  return { 跑 }
}
