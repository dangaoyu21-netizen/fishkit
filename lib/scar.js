// 小肥鱼 · 疤变规矩（开发板）
//
// 错题本里同一种坑摔够三次，就该自己长成一条规矩，别再靠我记性。
// 做法全在本地：拿 title 里的两字实词片段找「主题」，同一主题攒到门槛就写进 behavior/rules.json。
// 零模型调用；只有在真长出新规矩时才写一次文件。
//
// ⚠️ 开发板：先在这里长，验证通过才合回 dsh-fishkit。

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

export const 版本 = '0.1.0'

/** 同一主题攒够几条才长规矩 */
export const 默认门槛 = 3

/** 太泛的两字片段，不能当主题（不然所有错题都会归到「一个」「这个」下面） */
const 无意义 = new Set([
  '一个', '这个', '那个', '什么', '怎么', '不是', '就是', '还是', '没有', '可以',
  '已经', '因为', '所以', '然后', '但是', '时候', '东西', '事情', '问题', '我们',
  '他们', '你们', '自己', '一下', '一直', '起来', '出来', '不过', '只是', '真的',
])

/** 虚字：两个字都是虚字凑出来的片段直接丢 */
const 虚字 = new Set('的了是在我你他她它这那个也就都还没有不么呢吧啊呀嘛很太更最和与或对从到向把被让给为以于而并且但所因然此什怎')

const 是虚片 = (片) => [...片].every((ch) => 虚字.has(ch))

/** 从一段文字里抽候选主题片段（两字实词，去重） */
export function 抽片段(文) {
  const t = String(文 || '')
  const 出 = new Set()
  for (let i = 0; i + 2 <= t.length; i++) {
    const 片 = t.slice(i, i + 2)
    if (是虚片(片)) continue
    if (无意义.has(片)) continue
    if (!/^[\u4e00-\u9fa5]{2}$/.test(片)) continue
    出.add(片)
  }
  return [...出]
}

/**
 * 找主题：某个两字片段在够多条错题的 title 里都出现，就算一个「同一类坑」。
 * @returns [{ 片段, 成员: [条], 数 }]，按成员数从多到少
 */
export function 找主题(错题们, 选项 = {}) {
  const 门槛 = Number(选项.门槛) > 0 ? Number(选项.门槛) : 默认门槛
  const 疤们 = (错题们 || []).filter((x) => x && x.kind !== 'improve')
  const 计数 = new Map()
  const 归属 = new Map() // 片段 -> Set(条 id)
  for (const 条 of 疤们) {
    const 键 = 条.id || String(条.title || '')
    for (const 片 of 抽片段(条.title)) {
      计数.set(片, (计数.get(片) || 0) + 1)
      if (!归属.has(片)) 归属.set(片, new Set())
      归属.get(片).add(键)
    }
  }

  const 候选 = [...计数.entries()].filter(([, n]) => n >= 门槛).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  // 成员全被前面的主题盖住就跳过，免得「重启」和「新 D」各长一条一样的规矩
  const 已盖 = new Set()
  const 主题们 = []
  for (const [片] of 候选) {
    const 成员键 = 归属.get(片) || new Set()
    const 新键 = [...成员键].filter((k) => !已盖.has(k))
    if (!新键.length) continue
    新键.forEach((k) => 已盖.add(k))
    const 成员 = 疤们.filter((条) => 成员键.has(条.id || String(条.title || '')))
    主题们.push({ 片段: 片, 数: 成员.length, 成员 })
  }
  return 主题们
}

/** 一条主题 → 一条规矩 */
export function 长规矩(主题) {
  const 成员 = [...(主题.成员 || [])].sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
  // 规矩文案：取最近两条的教训，别把一整套都塞进去
  const 教训们 = 成员.map((x) => String(x.lesson || '').trim()).filter(Boolean)
  const 取 = 教训们.slice(-2)
  const 文案 = 取.length ? 取.join('；') : '同一类坑踩了 ' + 成员.length + ' 次，长点记性'
  return {
    id: 'from-mistake-' + String(主题.片段 || 'x'),
    text: 文案,
    enabled: true,
    from: 'mistakes',
    evidence: 成员.map((x) => x.id).filter(Boolean),
    createdAt: new Date().toISOString(),
  }
}

const 读JSON = (路径, 兜底) => {
  try {
    if (!existsSync(路径)) return 兜底
    const 原 = readFileSync(路径, 'utf8')
    return 原.trim() ? JSON.parse(原) : 兜底
  } catch (error) {
    return 兜底
  }
}

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
 * 建一个「疤变规矩」的处理器。
 * @param {object} 选项 { 根: 档案根目录, 门槛, 记账 }
 */
export function 建疤(选项 = {}) {
  const 根 = String(选项.根 || '')
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  const 门槛 = Number(选项.门槛) > 0 ? Number(选项.门槛) : 默认门槛
  const 错题文件 = 根 ? join(根, 'memory', 'mistakes.jsonl') : ''
  const 规矩文件 = 根 ? join(根, 'behavior', 'rules.json') : ''

  /** 扫一遍：该长的规矩长出来，已经有的不重复。不传 写回 就只演算 */
  const 扫 = (选项2 = {}) => {
    const 写回 = 选项2.写回 !== false
    const 错题们 = 根 ? 读行(错题文件) : []
    const 主题们 = 找主题(错题们, { 门槛 })
    const 现有 = 根 ? 读JSON(规矩文件, { rules: [], idle: {} }) : { rules: [], idle: {} }
    const 已有id = new Set(((现有 && 现有.rules) || []).map((r) => r && r.id))

    const 新规矩们 = []
    for (const 主题 of 主题们) {
      const 规矩 = 长规矩(主题)
      if (已有id.has(规矩.id)) continue
      新规矩们.push(规矩)
      已有id.add(规矩.id)
    }

    if (写回 && 根 && 新规矩们.length) {
      try {
        mkdirSync(join(根, 'behavior'), { recursive: true })
        const 新 = { ...现有, rules: [...((现有 && 现有.rules) || []), ...新规矩们] }
        writeFileSync(规矩文件, JSON.stringify(新, null, 2) + '\n', 'utf8')
        记账('疤变规矩：长出 ' + 新规矩们.length + ' 条（' + 新规矩们.map((r) => r.id).join('、') + '）')
      } catch (error) {
        记账('疤变规矩写盘失败：' + String((error && error.message) || error))
      }
    }

    return {
      ok: true,
      错题数: 错题们.filter((x) => x.kind !== 'improve').length,
      主题们: 主题们.map((t) => ({ 片段: t.片段, 条数: t.数, 成员: t.成员.map((x) => x.id) })),
      新规矩: 新规矩们,
      说: 新规矩们.length ? ('长出 ' + 新规矩们.length + ' 条规矩') : '暂时没有够门槛的同类坑',
    }
  }

  return { 扫, 门槛 }
}
