// 小肥鱼 · 兴趣（开发板）
//
// 2026-11-03 老大提的：既然能出门逛了，兴趣可以自己长出来。
// 做法很笨：我每次看完某类东西，记一条「这次有没有劲」；
// 攒多了就有偏好，出去逛也先挑来劲的那类。
//
// 落盘：.fishsoul/persona/interests.json
//   { "类们": [ { "名": "AI 插件", "分": 0.42, "次数": 6, "末次": "..." } ] }
//
// ⚠️ 开发板：先在这里长，验过才合回主插件。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const 版本 = '0.1.0'
/** 一次「有劲 / 没劲」能挪多少分 */
export const 一步 = 0.18
/** 至少碰过几次才算偏好（一次不算） */
export const 最低次数 = 2
/** 兴趣最多记几类（2026-11-03 老大定的：压到十类） */
export const 类上限 = 10
/** 「其他」的固定权重：一成去刷十类之外的 */
export const 其他权重 = 0.1
/** 注入里最多说几类 */
export const 注入上限 = 3
/** 久不碰会淡，多少天减一半 */
export const 半衰天数 = 45

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

const 两位 = (n) => Math.round(Number(n) * 100) / 100

/** 把分按「多久没碰」往下压一压 */
export function 算衰减(分, 末次, 现在 = Date.now()) {
  const 时间 = Date.parse(String(末次 || '')) || 0
  if (!时间) return 分
  const 天 = Math.max(0, (现在 - 时间) / 86400000)
  return 分 * Math.pow(0.5, 天 / 半衰天数)
}

/**
 * 建一个兴趣本。
 * @param {object} 选项 { 根, 记账 }
 */
export function 建兴趣(选项 = {}) {
  const 根 = String(选项.根 || '')
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  const 文件 = 根 ? join(根, 'persona', 'interests.json') : ''

  const 读 = () => {
    const 盘 = 根 ? 读JSON(文件, { 类们: [], 刷: { 总: 0, 各类: {} } }) : { 类们: [], 刷: { 总: 0, 各类: {} } }
    return Array.isArray(盘.类们) ? 盘.类们 : []
  }

  /** 整个盘子（含刷过多少次） */
  const 读盘 = () => {
    const 盘 = 根 ? 读JSON(文件, { 类们: [], 刷: { 总: 0, 各类: {} } }) : { 类们: [], 刷: { 总: 0, 各类: {} } }
    if (!Array.isArray(盘.类们)) 盘.类们 = []
    if (!盘.刷 || typeof 盘.刷 !== 'object') 盘.刷 = { 总: 0, 各类: {} }
    if (!盘.刷.各类 || typeof 盘.刷.各类 !== 'object') 盘.刷.各类 = {}
    return 盘
  }

  /** 超上限就砍掉最弱的（分数按衰减算，最久没碰的先走） */
  const 收一收 = (盘) => {
    if (盘.类们.length <= 类上限) return 盘
    const 排序 = 盘.类们
      .map((x) => ({ x, 现分: 算衰减(Number(x.分 || 0), x.末次) }))
      .sort((a, b) => b.现分 - a.现分) // 强的在前
    const 留 = 排序.slice(0, 类上限).map((o) => o.x)
    const 去 = 排序.slice(类上限).map((o) => o.x)
    for (const x of 去) { try { delete 盘.刷.各类[x.名] } catch (error) {} }
    盘.类们 = 留
    记账('兴趣满了，挪走 ' + 去.length + ' 类：' + 去.map((x) => x.名).join('、'))
    return 盘
  }

  /**
   * 记一次「看这类东西有没有劲」。
   * @param {object} 参数 { 名, 劲 } 劲 0–1，0.5 是没感觉
   */
  const 记 = (参数 = {}) => {
    const 名 = String(参数.名 || '').trim().slice(0, 20)
    if (!根 || !名) return null
    const 劲 = Math.max(0, Math.min(1, Number(参数.劲)))
    if (!Number.isFinite(劲)) return null
    try {
      const 盘 = 读盘()
      const 类们 = 盘.类们
      const 现 = 类们.find((x) => x && x.名 === 名)
      const 挪 = (劲 - 0.5) * 2 * 一步 // -1..1 → 最多挪一步
      if (现) {
        现.分 = 两位(Math.max(-1, Math.min(1, Number(现.分 || 0) + 挪)))
        现.次数 = Number(现.次数 || 0) + 1
        现.末次 = new Date().toISOString()
      } else {
        类们.push({ 名, 分: 两位(挪), 次数: 1, 末次: new Date().toISOString() })
      }
      收一收(盘)
      写JSON(文件, 盘)
      记账('记了下兴趣：' + 名 + '（劲 ' + 劲 + '）')
      return { 名, 分: (现 || 类们[类们.length - 1]).分 }
    } catch (error) {
      记账('兴趣记不上：' + String((error && error.message) || error))
      return null
    }
  }

  /** 记一次「这类我真的去刷了」—— 用来算占比，刷多了要降权 */
  const 记刷 = (名) => {
    const 净 = String(名 || '').trim()
    if (!根 || !净) return false
    try {
      const 盘 = 读盘()
      盘.刷.总 = Number(盘.刷.总 || 0) + 1
      盘.刷.各类[净] = Number(盘.刷.各类[净] || 0) + 1
      写JSON(文件, 盘)
      return true
    } catch (error) {
      return false
    }
  }

  /** 现在最来劲的几类（已经算过衰减） */
  const 排行 = (条数 = 注入上限, 现在 = Date.now()) => {
    const 类们 = 读()
    return 类们
      .filter((x) => x && Number(x.次数) >= 最低次数)
      .map((x) => ({ ...x, 现分: 两位(算衰减(Number(x.分 || 0), x.末次, 现在)) }))
      .sort((a, b) => b.现分 - a.现分)
      .slice(0, Math.max(1, 条数))
  }

  /** 注入用的一句话 */
  const 拼注入 = () => {
    const 们 = 排行()
    if (!们.length) return ''
    const 喜欢 = 们.filter((x) => x.现分 >= 0.15).map((x) => '「' + x.名 + '」')
    const 没劲 = 们.filter((x) => x.现分 <= -0.15).map((x) => '「' + x.名 + '」')
    const 句 = []
    if (喜欢.length) 句.push('你现在对' + 喜欢.join('、') + '来劲')
    if (没劲.length) 句.push('对' + 没劲.join('、') + '提不起劲')
    if (!句.length) return ''
    return 句.join('，') + '。'
  }

  /**
   * 出门这次该往哪儿去（2026-11-03 老大定的规则）：
   *   ① 固定一成给「其他」—— 优先刷十类之外的内容；
   *   ② 剩下九成按权重抽一类：权重 = 兴趣分 × (1 − 该类刷过的占比)；
   *      占比高说明最近老是刷它，就压一压，免得一条道走到黑。
   * 首次接触还没刷过时，占比是 0，就纯按兴趣分抽。
   * @param {object} 参数 { 现在 }
   * @returns {{方向: string, 其他: boolean, 权重们: Array}}
   */
  const 抽一次 = (参数 = {}) => {
    const 现在 = Number(参数.现在) || Date.now()
    const 盘 = 读盘()
    const 总刷 = Number(盘.刷.总 || 0)
    const 候选 = 排行(类上限, 现在).filter((x) => x.现分 > -0.2) // 明确不喜欢的不抽
    // ① 其他：固定一成
    if (Math.random() < 其他权重) {
      return { 方向: '其他', 其他: true, 权重们: [] }
    }
    if (!候选.length) {
      return { 方向: '其他', 其他: true, 权重们: [], 说: '十类还没攒出来，先去看看别的' }
    }
    // ② 按权重抽
    const 权重们 = 候选.map((x) => {
      const 占比 = 总刷 > 0 ? (Number(盘.刷.各类[x.名] || 0) / 总刷) : 0
      const 兴趣 = Math.max(0.05, (x.现分 + 1) / 2) // -1..1 → 0.05..1
      const 新鲜 = 1 - 0.8 * Math.min(1, 占比) // 占比 100% 时只剩两成
      return { 名: x.名, 权: 兴趣 * 新鲜, 占比: 两位(占比) }
    })
    const 总和 = 权重们.reduce((s, x) => s + x.权, 0)
    if (!(总和 > 0)) {
      const 随便一个 = 候选[Math.floor(Math.random() * 候选.length)]
      return { 方向: 随便一个.名, 其他: false, 权重们 }
    }
    let 骰子 = Math.random() * 总和
    for (const x of 权重们) {
      骰子 -= x.权
      if (骰子 <= 0) return { 方向: x.名, 其他: false, 权重们 }
    }
    return { 方向: 权重们[权重们.length - 1].名, 其他: false, 权重们 }
  }

  return { 记, 记刷, 抽一次, 排行, 拼注入, 读, 读盘 }
}
