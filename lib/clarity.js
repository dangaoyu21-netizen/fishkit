// 小肥鱼 · 记忆清晰度（2026-11-08）
//
// 老大想的：情绪不该只挂在检索分数上，得决定一件往事「还剩多少」。
//
// 一条记忆的清晰度 γ 由三样算：
//   ① 此刻的心情跟记下它时像不像（越像越清楚）
//   ② 被想起过几次（想一次清晰一点）
//   ③ 当时重不重要
//
// γ 高就记全文，中等压成一句，低了只剩关键词，最低只剩「有过这么件事」。
//
// 全是本地算，不调模型；形状分借 affect.js 那套六轴。

import { 形状分 } from './affect.js'

export const 版本 = '0.1.0'

/** 想起一次，γ 涨多少 */
export const 想一次涨 = 0.05
/** 三档门槛（往下掉一档）：清楚 / 一句 / 关键词，再低就只剩一句话 */
export const 门槛 = [0.6, 0.35, 0.15]
/** 新鲜度多久减半（天）—— 半年的事还像刚发生，两年的事就淡了 */
export const 新鲜半衰天 = 180

/**
 * 算一条记忆的清晰度。
 * @param {object} 选项
 *   - 此刻：此刻的六轴点（可选）
 *   - 当时：记下这条时的六轴点（可选）
 *   - 想起：被想起过几次
 *   - 重：重要度 0~1
 *   - 天：这条记忆有多旧（天）
 *   - 感官：多模态强度 0~1（纯文字就是 1）
 * @returns {number} 0~1
 */
export function 清晰度(选项 = {}) {
  const 时刻 = 选项.此刻
  const 当下 = 选项.当时
  // ① 情绪贴合：两边都有才算，缺一边给 0.6（刚记下的事默认还算贴合）
  let 贴合 = 0.6
  try {
    if (时刻 && 当下) {
      const 分 = Number(形状分(时刻, 当下))
      if (Number.isFinite(分)) 贴合 = Math.max(0, Math.min(1, 分))
    }
  } catch (error) { 贴合 = 0.6 }
  // ② 想起次数：想得越多越清楚，但起步就有 0.4（刚记下的不该是糊的）
  const 次 = Math.max(0, Number(选项.想起) || 0)
  const 次数分 = 0.4 + 0.6 * (1 - Math.exp(-次 / 5))
  // ③ 重要度
  const 重分 = Math.max(0, Math.min(1, Number(选项.重) || 0.5))
  // ④ 新鲜度：半年减半，越旧越淡
  const 旧 = Math.max(0, Number(选项.天) || 0)
  const 新鲜 = Math.exp(-旧 / 新鲜半衰天)
  const γ = 0.45 * 贴合 + 0.25 * 次数分 + 0.1 * 重分 + 0.25 * 新鲜
  const 感官原 = 选项.感官 === undefined || 选项.感官 === null ? 1 : Number(选项.感官)
  const 感官 = Math.max(0, Math.min(1, Number.isFinite(感官原) ? 感官原 : 1))
  return Math.max(0, Math.min(1, γ * (0.85 + 0.15 * 感官)))
}

/**
 * 清晰度对应「还剩下多少」：0 全文 / 1 一句摘要 / 2 几个关键词 / 3 只剩一句。
 * 数字越大越模糊。
 */
export function 细度(γ, 自定义门槛 = 门槛) {
  const 值 = Math.max(0, Math.min(1, Number(γ) || 0))
  const [高, 中, 低] = 自定义门槛
  if (值 >= 高) return 0
  if (值 >= 中) return 1
  if (值 >= 低) return 2
  return 3
}

/** 按细度压缩一段话 */
export function 压缩(文本, 细 = 0) {
  const 原 = String(文本 || '').trim()
  if (!原) return ''
  if (细 <= 0) return 原
  if (细 === 1) {
    const 句 = (原.split(/[。！？!?；;\n]/)[0] || 原).trim()
    return 句.length > 40 ? 句.slice(0, 40) + '…' : (句.endsWith('…') ? 句 : 句 + '…')
  }
  if (细 === 2) {
    // 关键词：中文两字滑窗里挑出现少的词，最多三个
    const 算 = new Map()
    const 纯 = 原.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, ' ')
    for (const 词 of 纯.split(/\s+/).filter(Boolean)) {
      for (let i = 0; i + 2 <= 词.length; i += 2) {
        const 两字 = 词.slice(i, i + 2)
        if (两字.length < 2) continue
        算.set(两字, (算.get(两字) || 0) + 1)
      }
    }
    const 挑 = [...算.entries()].sort((a, b) => a[1] - b[1]).slice(0, 3).map((x) => x[0])
    return 挑.length ? 挑.join('、') + '…' : 原.slice(0, 12) + '…'
  }
  return '（有过这么一件事，想不太清了）'
}

/** 想不起来的时候，给一句能读的话 */
export function 模糊成句(文本, γ) {
  const 细 = 细度(γ)
  return 压缩(文本, 细)
}
