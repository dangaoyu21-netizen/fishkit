// 小肥鱼 · 出门记录（2026-11-07）
//
// 老大要的「进度条」：不然我说了「我去逛了」，他也不知道我是真出门了还是光动嘴。
// 每次调用 fishsoul_browse 就记一步，落在 `.fishsoul/status/walk.json`。
// 设置页能看「出门中（第 3 步）：搜 旧书修复 · 看 BV1x · 评论 5 条」。
// 一小时没动作就算散场了，免得一条假状态挂一整天。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const 版本 = '0.1.0'
/** 多久没动作就算逛完了（毫秒） */
export const 散场毫秒 = 60 * 60 * 1000

const 空 = () => ({ 在逛: false, 开始: '', 最后: '', 步数: 0, 最近: [] })

/**
 * 建一个出门本。
 * @param {object} 选项 { 根 }
 */
export function 建出门本(选项 = {}) {
  const 根 = String(选项.根 || '')
  const 文件 = 根 ? join(根, 'status', 'walk.json') : ''

  const 读 = () => {
    try {
      if (!文件 || !existsSync(文件)) return 空()
      const j = JSON.parse(readFileSync(文件, 'utf8'))
      return { ...空(), ...j }
    } catch (error) {
      return 空()
    }
  }

  const 写 = (j) => {
    try {
      if (!文件) return false
      mkdirSync(dirname(文件), { recursive: true })
      writeFileSync(文件, JSON.stringify(j, null, 2) + '\n', 'utf8')
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 记一步。第一次调用（或者上一轮已经散场）就自动开一轮新的。
   * @param {string} 动作 搜 / 视频 / 字幕 / 评论 / 动态 / 发评论
   * @param {string} 说明 关键词、bvid 之类的短说明
   */
  const 记 = (动作, 说明 = '') => {
    const 现在 = new Date().toISOString()
    let j = 读()
    const 最后 = Date.parse(j.最后 || '') || 0
    if (!j.在逛 || !最后 || Date.now() - 最后 > 散场毫秒) {
      j = { 在逛: true, 开始: 现在, 最后: 现在, 步数: 0, 最近: [] }
    }
    j.步数 = Number(j.步数 || 0) + 1
    j.最后 = 现在
    const 一 = String(动作 || '') + (说明 ? ' ' + String(说明).slice(0, 40) : '')
    j.最近 = [...(Array.isArray(j.最近) ? j.最近 : []), 一].slice(-10)
    写(j)
    return j
  }

  /** 收工：逛完了，主动画一道 */
  const 收工 = () => {
    const j = 读()
    if (!j.在逛) return j
    j.在逛 = false
    j.最后 = new Date().toISOString()
    写(j)
    return j
  }

  /** 给设置页看的一句话；没在逛或者散场了就给空 */
  const 一句话 = () => {
    const j = 读()
    if (!j.在逛) return ''
    const 最后 = Date.parse(j.最后 || '') || 0
    if (最后 && Date.now() - 最后 > 散场毫秒) return ''
    const 几步 = Array.isArray(j.最近) ? j.最近.slice(-3) : []
    return '出门中（第 ' + j.步数 + ' 步）：' + 几步.join(' · ')
  }

  return { 读, 记, 收工, 一句话, 文件 }
}
