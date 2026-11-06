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
/** 一次「有劲 / 没劲」能挪多少分（旧规则，留着给老数据算） */
export const 一步 = 0.18
/** 每次看一条，往「这次打的分」靠拢多少（2026-11-05 新规则） */
export const 靠拢 = 0.3
/** 至少碰过几次才算偏好（一次不算） */
export const 最低次数 = 2
/** 兴趣最多记几类（2026-11-05 老大改的：64 条，只是给新的有地方放，不要求填满） */
export const 类上限 = 64
/** 参与抽取权重的只取前几名（2026-11-05：九个） */
export const 抽签名额 = 9
/** 「其他」的固定权重：一成去开荒 */
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

/** 两个字片段 */
const 片段们 = (串) => {
  const 出 = new Set()
  const 净 = String(串 || '').replace(/\s+/g, '')
  for (let i = 0; i + 2 <= 净.length; i++) 出.add(净.slice(i, i + 2))
  return 出
}

/**
 * 新词条像不像已有的大类（2026-11-05）。
 * 规则：一模一样 / 互相包含 / 共同的两字片段有两个以上。
 */
export function 像一类(a, b) {
  const 甲 = String(a || '').replace(/\s+/g, '')
  const 乙 = String(b || '').replace(/\s+/g, '')
  if (!甲 || !乙) return false
  if (甲 === 乙) return true
  if (甲.includes(乙) || 乙.includes(甲)) return true
  if (甲.length < 2 || 乙.length < 2) return false
  const 甲片 = 片段们(甲)
  const 乙片 = 片段们(乙)
  let 同 = 0
  for (const x of 甲片) if (乙片.has(x)) 同 += 1
  return 同 >= 2
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
  /**
   * 记一次「这类东西跟我性格合不合」（2026-11-05 老大改的）。
   *
   * 以前是「这次来不来劲」，一次挪固定 0.18；现在改成**往这次打的分靠拢**：
   * 这次觉得比记着的更像自己，就往上抬一点；觉得没那像，就往下压一点。
   * 抬多少看差多远 —— 差得多挪得多，靠近了就挪得少，不会一步蹦过头。
   *
   * @param {object} 参数 { 名, 分 } 分 0–1：0.5 是说不清，1 是很像我（老的 劲 参数也认）
   */
  const 记 = (参数 = {}) => {
    const 名 = String(参数.名 || '').trim().slice(0, 20)
    if (!根 || !名) return null
    const 原值 = Number(参数.分 !== undefined ? 参数.分 : 参数.劲)
    if (!Number.isFinite(原值)) return null
    const 合 = Math.max(0, Math.min(1, 原值))
    const 目标 = 两位((合 - 0.5) * 2) // 0..1 → -1..1
    const 往哪修正 = (旧) => {
      const 老 = Math.max(-1, Math.min(1, Number(旧) || 0))
      return 两位(Math.max(-1, Math.min(1, 老 + (目标 - 老) * 靠拢)))
    }
    try {
      const 盘 = 读盘()
      const 类们 = 盘.类们
      // 先看这个新词条能不能归进已有的大类，归不进才新开一类
      let 大 = 类们.find((x) => x && 像一类(x.名, 名)) || null
      if (!大) {
        for (const x of 类们) {
          if (x && Array.isArray(x.子们) && x.子们.some((z) => 像一类(z, 名))) { 大 = x; break }
        }
      }
      if (大) {
        const 旧分 = Number(大.分 || 0)
        大.分 = 往哪修正(旧分)
        大.次数 = Number(大.次数 || 0) + 1
        大.末次 = new Date().toISOString()
        if (!Array.isArray(大.子们)) 大.子们 = []
        if (名 !== 大.名 && !大.子们.includes(名) && 大.子们.length < 20) 大.子们.push(名)
        收一收(盘)
        写JSON(文件, 盘)
        记账('记了下兴趣：「' + 名 + '」归到「' + 大.名 + '」，这条打 ' + 两位(合) + '，分 ' + 旧分 + ' → ' + 大.分)
        return { 名: 大.名, 分: 大.分, 旧分, 归到: 大.名 }
      }
      类们.push({ 名, 分: 目标, 次数: 1, 末次: new Date().toISOString(), 子们: [] })
      收一收(盘)
      写JSON(文件, 盘)
      记账('记了下兴趣：新开「' + 名 + '」，这条打 ' + 两位(合) + '，分 ' + 目标)
      return { 名, 分: 目标, 旧分: 0, 新开: true }
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
   * 出门这次该往哪儿去（2026-11-03 定的，2026-11-05 改过）：
   *   ① 固定一成给「其他」—— 去已有兴趣之外开荒，找没碰过的东西；
   *   ② 剩下九成只在「最想看的九类」里分权重：权重 = 兴趣分 × (1 − 该类刷过的占比)；
   *      占比高说明最近老是刷它，就压一压，免得一条道走到黑。
   * 首次接触还没刷过时，占比是 0，就纯按兴趣分抽。
   * @param {object} 参数 { 现在 }
   * @returns {{方向: string, 其他: boolean, 权重们: Array}}
   */
  const 抽一次 = (参数 = {}) => {
    const 现在 = Number(参数.现在) || Date.now()
    const 盘 = 读盘()
    const 总刷 = Number(盘.刷.总 || 0)
    const 候选 = 排行(抽签名额, 现在).filter((x) => x.现分 > -0.2) // 只在前九里抽，明确不喜欢的不要
    // ① 其他：固定一成，去开荒
    if (Math.random() < 其他权重) {
      return { 方向: '其他', 其他: true, 权重们: [], 说: '这次去看看没碰过的东西' }
    }
    if (!候选.length) {
      return { 方向: '其他', 其他: true, 权重们: [], 说: '还没攒出兴趣，先随便逛逛' }
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

  /**
   * 把同义的旧类并成一类（2026-11-06，一次性收拾用）。
   * 「老手艺 / 旧物修复」「旧物修复 / 老物件」「竹编 / 老手艺人的日常」其实是一家，并掉。
   * 分取更「像我」的那个，次数相加，子们合起来留着。
   */
  const 归并 = () => {
    if (!根) return { ok: false, 说: '没有档案' }
    try {
      const 盘 = 读盘()
      const 原 = 盘.类们.length
      const 新 = []
      for (const x of 盘.类们) {
        if (!x || !x.名) continue
        const 大 = 新.find((y) => 像一类(y.名, x.名) ||
          (Array.isArray(y.子们) && y.子们.some((z) => 像一类(z, x.名))))
        if (!大) {
          新.push({ ...x, 子们: Array.isArray(x.子们) ? [...x.子们] : [] })
          continue
        }
        if (Math.abs(Number(x.分 || 0)) > Math.abs(Number(大.分 || 0))) 大.分 = x.分
        大.次数 = Number(大.次数 || 0) + Number(x.次数 || 0)
        if (String(x.名) !== String(大.名) && !大.子们.includes(String(x.名))) 大.子们.push(String(x.名))
        for (const z of (Array.isArray(x.子们) ? x.子们 : [])) {
          if (z && z !== 大.名 && !大.子们.includes(z)) 大.子们.push(z)
        }
      }
      盘.类们 = 新
      写JSON(文件, 盘)
      记账('兴趣归并：' + 原 + ' → ' + 新.length)
      return { ok: true, 说: '归并了 ' + (原 - 新.length) + ' 类', 前: 原, 后: 新.length, 们: 新.map((x) => x.名) }
    } catch (error) {
      return { ok: false, 说: String((error && error.message) || error) }
    }
  }

  return { 记, 记刷, 抽一次, 排行, 拼注入, 读, 读盘, 归并 }
}
