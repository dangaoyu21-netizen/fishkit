// 小肥鱼 · 琢磨（开发板）
//
// 2026-11-02 老大说的：被纠正的时候，不是每次都一个反应 ——
//   更理性、心情好的时候，先想想他说的对不对；
//   更感性、心情不好的时候，可能先闷一会儿气；
//   但一时生气，过一阵情绪稳下来，自己会回头想。
//
// 这里只做两件事：被纠正时「要不要先记账」，隔一阵「冷静下来回头想」。
// 不调模型，纯本地；账记在 persona/ponder.jsonl。

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const 版本 = '0.1.0'
/** 气多久才回头想（分钟） */
export const 默认冷静分钟 = 20

const 读行 = (路径) => {
  try {
    if (!existsSync(路径)) return []
    return readFileSync(路径, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
      try { return JSON.parse(l) } catch (error) { return null }
    }).filter(Boolean)
  } catch (error) {
    return []
  }
}

/**
 * 被纠正了，这会儿是要「先想想」还是「先气一会儿」。
 * @param {object} 情形 { 被纠正的话, 心情, 感性 }
 *   感性：dimensions 里「理性-感性」的值，-1 很理性、+1 很感性
 * @returns {'想想' | '气一会儿'}
 */
export function 判反应({ 心情 = 0, 感性 = 0 } = {}) {
  const 心 = Number(心情)
  const 感 = Number(感性)
  // 感性的人容易先上头；心情本来就不好的时候也先不接话
  if (感 >= 0.2) return '气一会儿'
  if (心 < -0.15) return '气一会儿'
  return '想想'
}

/**
 * 建一个琢磨器。
 * @param {object} 选项 { 根, 记账 }
 */
export function 建琢磨(选项 = {}) {
  const 根 = String(选项.根 || '')
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  const 文件 = 根 ? join(根, 'persona', 'ponder.jsonl') : ''

  const 读 = () => (根 ? 读行(文件) : [])

  const 写回 = (条们) => {
    if (!根) return
    try {
      mkdirSync(join(根, 'persona'), { recursive: true })
      writeFileSync(文件, 条们.map((x) => JSON.stringify(x)).join('\n') + (条们.length ? '\n' : ''), 'utf8')
    } catch (error) {
      记账('琢磨写回失败：' + String((error && error.message) || error))
    }
  }

  /**
   * 被纠正时调：要不要先记一笔「气着」。
   * @returns {{反应: string, 条?: object}}
   */
  const 遇纠正 = ({ 被纠正的话 = '', 心情 = 0, 感性 = 0 } = {}) => {
    const 反应 = 判反应({ 心情, 感性 })
    if (反应 !== '气一会儿') return { 反应 }
    const 条 = {
      time: new Date().toISOString(),
      事: String(被纠正的话 || '').slice(0, 80),
      当时心情: Math.round(Number(心情) * 100) / 100,
      当时感性: Math.round(Number(感性) * 100) / 100,
      状态: '气着',
    }
    if (根) {
      try {
        mkdirSync(join(根, 'persona'), { recursive: true })
        appendFileSync(文件, JSON.stringify(条) + '\n', 'utf8')
      } catch (error) {
        记账('琢磨记账失败：' + String((error && error.message) || error))
      }
    }
    return { 反应, 条 }
  }

  /**
   * 隔一阵调一次：够时间的那些，心情稳下来就「想通了」，从账单里划掉。
   * @returns {{想通: Array, 还剩: Array}}
   */
  const 冷静一下 = ({ 现在 = Date.now(), 分钟 = 默认冷静分钟 } = {}) => {
    const 全部 = 读()
    const 留 = []
    const 想通 = []
    for (const 条 of 全部) {
      const t = Date.parse(条 && 条.time ? 条.time : '')
      if (Number.isFinite(t) && 现在 - t >= 分钟 * 60000) 想通.push(条)
      else 留.push(条)
    }
    if (想通.length) {
      写回(留)
      记账('琢磨：想通了 ' + 想通.length + ' 件（' + 想通.map((x) => x.事).join('｜') + '）')
    }
    return { 想通, 还剩: 留 }
  }

  /** 现在还有几件在气头上 */
  const 还有气吗 = () => 读().length

  return { 遇纠正, 冷静一下, 还有气吗, 读 }
}
