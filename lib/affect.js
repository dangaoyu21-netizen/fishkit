// 小肥鱼 · 情绪形状（2026-11-06）
//
// 「触景生情」怎么机械地做出来：每句话判一个点 → 落成六轴 → 情绪顶上来时拿形状去比对旧事。
//
// 六根轴：
//   效价（难受↔舒服）、唤醒（平静↔激动）、支配（被推着↔我说了算）、
//   热络（疏离↔热络）、乐观（悲观↔乐观）、温和（强硬↔温和）。
// 后三根是人设维，直接从 persona/dimensions.json 借。
//
// 判情绪三档（2026-11-06 老大定的）：纯规则 / 规则打底 + 调模型兜底 / 纯模型。
// 再加一点扰动：情绪没有「判错」这一说，同一件事两次不会完全一样；
// 平时抖得轻，另留一个很小的概率让它一下歪出去（均匀随机会看不出起伏）。
//
// 全是本地算；模型档要 ctx.llm，用 DSH 自带的登录态，不另配 key。

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const 版本 = '0.1.0'
/** 点的落点 */
export const 点的文件 = ['memory', 'points.jsonl']

/** 六根轴 */
export const 轴们 = [
  { 键: 'valence', 名: '效价', 低: '抵触', 高: '接受' },
  { 键: 'arousal', 名: '唤醒', 低: '平静', 高: '激动' },
  { 键: 'dominance', 名: '支配', 低: '被推着走', 高: '我说了算' },
  { 键: 'warmth', 名: '热络', 低: '疏离', 高: '热络' },
  { 键: 'optimism', 名: '乐观', 低: '悲观', 高: '乐观' },
  { 键: 'softness', 名: '温和', 低: '强硬', 高: '温和' },
]

/** 三根人设轴跟 dimensions.json 里的哪一根对得上（借现成的，不另存一份） */
export const 人设轴对应 = {
  warmth: '热络-疏离',
  optimism: '乐观-悲观',
  softness: '温和-强硬',
}

const 夹 = (v, 低 = -1, 高 = 1) => Math.max(低, Math.min(高, Number(v) || 0))
const 数 = (t, 表) => 表.reduce((n, w) => n + (t.split(w).length - 1), 0)

const 正词 = ['开心', '高兴', '喜欢', '谢谢', '可爱', '棒', '哈哈', '嘿嘿', '爱', '好耶', '舒服', '顺']
const 负词 = ['难过', '烦', '生气', '讨厌', '难受', '伤心', '委屈', '累', '烦死', '哭', '气死', '呜呜', '崩', '糟']
// 被推着走 / 我说了算
const 推着词 = ['不得不', '只好', '被', '没办法', '算了', '随你', '听你的', '忍着']
const 做主词 = ['我决定', '必须', '我来', '说了算', '我定', '我自己来', '不用管']
// 疏离 / 热络
const 疏离词 = ['随便', '不用了', '闭嘴', '别烦', '走开', '不想理', '一边去']
const 热络词 = ['一起', '咱们', '陪你', '想你', '等你', '抱抱', '蹭', '贴着', '黏']
// 悲观 / 乐观
const 悲观词 = ['完蛋', '没救', '又失败', '白费', '算了', '没指望', '来不及']
const 乐观词 = ['会好的', '试试', '没事', '能行', '再来', '慢慢来', '有救']
// 强硬 / 温和（语气词和软话）
const 强硬词 = ['必须', '给我', '闭嘴', '滚', '别废话', '赶紧', '马上']
const 温和词 = ['嘛', '呀', '～', '~', '吧', '呢', '哦', '呐', '好不好', '行不行']

/**
 * 规则档：词表 + 标点先判一个点。快、稳、能查，但读不出反讽和上下文。
 * @returns {{valence:number, arousal:number, dominance:number, warmth:number, optimism:number, softness:number, emotion:string, 词数:number}}
 */
export function 判规则(文本) {
  const t = String(文本 || '')
  const 正 = 数(t, 正词)
  const 负 = 数(t, 负词)
  const 情绪总 = 正 + 负
  const valence = 情绪总 > 0 ? 夹((正 - 负) / 情绪总) : 0.05

  const 叹 = (t.match(/[！!]/g) || []).length
  const 问 = (t.match(/[？?]/g) || []).length
  const arousal = 夹(0.2 + 叹 * 0.2 + 问 * 0.05 + Math.min(0.3, t.length / 200), 0, 1)

  const 推 = 数(t, 推着词)
  const 主 = 数(t, 做主词)
  const dominance = 推 + 主 > 0 ? 夹((主 - 推) / (推 + 主)) : 0

  const 疏 = 数(t, 疏离词)
  const 热 = 数(t, 热络词)
  const warmth = 疏 + 热 > 0 ? 夹((热 - 疏) / (疏 + 热)) : 0

  const 悲 = 数(t, 悲观词)
  const 乐 = 数(t, 乐观词)
  const optimism = 悲 + 乐 > 0 ? 夹((乐 - 悲) / (悲 + 乐)) : 0

  const 硬 = 数(t, 强硬词)
  const 软 = 数(t, 温和词)
  const softness = 硬 + 软 > 0 ? 夹((软 - 硬) / (硬 + 软)) : 0

  let emotion = '平静'
  if (valence > 0.4 && arousal > 0.4) emotion = '开心'
  else if (valence > 0.4) emotion = '高兴'
  else if (valence < -0.4 && arousal > 0.5) emotion = '生气'
  else if (valence < -0.4) emotion = '难过'
  else if (valence < -0.15 && arousal > 0.4) emotion = '有点烦'
  else if (arousal > 0.6) emotion = '有点激动'

  return {
    valence: Math.round(valence * 100) / 100,
    arousal: Math.round(arousal * 100) / 100,
    dominance: Math.round(dominance * 100) / 100,
    warmth: Math.round(warmth * 100) / 100,
    optimism: Math.round(optimism * 100) / 100,
    softness: Math.round(softness * 100) / 100,
    emotion,
    词数: 情绪总 + 推 + 主 + 疏 + 热 + 悲 + 乐 + 硬 + 软,
  }
}

/**
 * 扰动（2026-11-06 老大定的）：
 *   平时每根轴抖一点点；另有一个小概率（默认 2%）整条歪出去一根轴。
 *   歪的方向和幅度都随机 —— 但不是均匀随机，是「大多数时候没事，偶尔一下大」。
 */
export function 加扰动(点, 参数 = {}) {
  const 抖 = Number(参数.幅度 ?? 0.03)
  const 歪概率 = Number(参数.歪概率 ?? 0.02)
  const 随机 = typeof 参数.随机 === 'function' ? 参数.随机 : Math.random
  const 出 = {}
  for (const 轴 of 轴们) {
    const 原 = Number((点 && 点[轴.键]) ?? 0)
    出[轴.键] = Math.round(夹(原 + (随机() * 2 - 1) * 抖) * 100) / 100
  }
  if (随机() < 歪概率) {
    const 轴 = 轴们[Math.floor(随机() * 轴们.length)]
    出[轴.键] = Math.round(夹(出[轴.键] + (随机() < 0.5 ? -1 : 1) * (0.3 + 随机() * 0.25)) * 100) / 100
    出.歪了 = 轴.键
  }
  return 出
}

/** 从当前档案状态造一个「此刻」的点（心情 + 三根人设维） */
export function 从状态造点(状态) {
  const m = (状态 && 状态.mood) || {}
  const 取维 = (键) => {
    const d = ((状态 && 状态.dims) || []).find((x) => x && x.key === 键)
    return d ? 夹(Number(d.value) || 0) : 0
  }
  return {
    valence: 夹(Number(m.valence ?? 0)),
    arousal: 夹(Number(m.arousal ?? 0.2), 0, 1),
    dominance: 0,
    warmth: 取维(人设轴对应.warmth),
    optimism: 取维(人设轴对应.optimism),
    softness: 取维(人设轴对应.softness),
  }
}

/**
 * 形状 = 六轴各自减掉自己那条的均值 —— 比的是「哪几根翘、哪几根塌」的比例，
 * 不是比数值大小。开心的事和难过的事都可能很激动，形状不一样就在别处。
 */
export function 形状向量(点) {
  const 值 = 轴们.map((轴) => Number((点 && 点[轴.键]) ?? 0))
  const 均 = 值.reduce((s, v) => s + v, 0) / 值.length
  return 值.map((v) => v - 均)
}

/**
 * 两个形状有多像（余弦，-1~1）。
 * @returns {number} 1 = 一模一样，0 = 不沾边
 */
export function 形状相似(甲, 乙) {
  const a = 形状向量(甲)
  const b = 形状向量(乙)
  let 点 = 0
  let 长a = 0
  let 长b = 0
  for (let i = 0; i < a.length; i++) {
    点 += a[i] * b[i]
    长a += a[i] * a[i]
    长b += b[i] * b[i]
  }
  if (!长a || !长b) return 0
  return 点 / Math.sqrt(长a * 长b)
}

/** 相似度换成 0~1 的好用分数 */
export const 形状分 = (甲, 乙) => (形状相似(甲, 乙) + 1) / 2

// ── 模型的提示词 ─────────────────────────────────────────────

const 模型系统 = [
  '你在给一句话判情绪，只输出一个 JSON 对象，不要解释、不要 markdown。',
  '六根轴，取值范围：',
  'valence（效价）：-1 很难受 … 1 很舒服',
  'arousal（唤醒）：0 很平静 … 1 很激动',
  'dominance（支配）：-1 被推着走 … 1 我说了算',
  'warmth（热络）：-1 疏离 … 1 亲近',
  'optimism（乐观）：-1 悲观 … 1 乐观',
  'softness（温和）：-1 强硬 … 1 温和',
  '再加一个 emotion：一个词的情绪名（比如 开心/难过/生气/平静/委屈/想撒娇）。',
  '格式：{"valence":0.6,"arousal":0.4,"dominance":0,"warmth":0.7,"optimism":0.5,"softness":0.6,"emotion":"开心"}',
].join('\n')

/** 从模型返回里抠那个 JSON */
export function 抠JSON(文) {
  const s = String(文 || '')
  const 起 = s.indexOf('{')
  const 止 = s.lastIndexOf('}')
  if (起 < 0 || 止 <= 起) return null
  try {
    const j = JSON.parse(s.slice(起, 止 + 1))
    return j && typeof j === 'object' ? j : null
  } catch (error) {
    return null
  }
}

/**
 * 模型档：走 DSH 自带的模型服务（ctx.llm，登录态，不用 API key）。
 * provider / model 留空就跟着当前会话走。
 */
export async function 判模型(ctx, 文本, 参数 = {}) {
  if (!ctx || !ctx.llm || typeof ctx.llm.stream !== 'function') return null
  const messages = [{
    role: 'user',
    id: 'affect-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    content: [{ type: 'text', text: '这句话：' + String(文本 || '').slice(0, 800) }],
    source: { kind: 'plugin', plugin: 'dsh-fishkit' },
  }]
  let 出 = ''
  try {
    for await (const chunk of ctx.llm.stream({
      provider: String(参数.provider || ''),
      model: String(参数.model || ''),
      system: 模型系统,
      messages,
      maxTokens: 300,
      temperature: 0.3,
    })) {
      if (!chunk) continue
      if (chunk.type === 'text-delta') 出 += chunk.text
    }
  } catch (error) {
    return null
  }
  const j = 抠JSON(出)
  if (!j) return null
  const 点 = {}
  for (const 轴 of 轴们) {
    const v = Number(j[轴.键])
    点[轴.键] = 轴.键 === 'arousal' ? Math.round(夹(v, 0, 1) * 100) / 100 : Math.round(夹(v) * 100) / 100
  }
  点.emotion = String(j.emotion || '平静').slice(0, 12)
  点.来源 = 'model'
  return 点
}

/**
 * 判一个点（三档）。
 * @param {object} 参数 { 文本, 档, ctx, provider, model, 随机 }
 * @returns {Promise<object>} 点 + 来源（rule / model / rule（模型没接上））
 */
export async function 判情绪点(参数 = {}) {
  const 文本 = String(参数.文本 || '')
  const 档 = String(参数.档 || '规则')
  const 规 = 判规则(文本)
  if (档 === '规则' || !参数.ctx || !参数.ctx.llm) return { ...规, 来源: 'rule' }
  // 规则打底 + 模型兜底：只有规则一个词都没认出来、话又不短的时候才花钱
  const 要模型 = 档 === '模型' || (规.词数 === 0 && 文本.trim().length >= 12)
  if (!要模型) return { ...规, 来源: 'rule' }
  const 模 = await 判模型(参数.ctx, 文本, 参数)
  if (!模) return { ...规, 来源: 'rule（模型没接上）' }
  return 模
}

// ── 点本：落在 memory/points.jsonl ──────────────────────────

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

/** 一条事件的键（时间 + 摘要开头）：老事件补点时靠它对上 */
export const 点的键 = (x) => String((x && x.time) || '') + '|' + String((x && (x.summary || x.摘要)) || '').slice(0, 30)

/**
 * 建点本。
 * @param {object} 选项 { 根, 记账 }
 */
export function 建点本(选项 = {}) {
  const 根 = String(选项.根 || '')
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  const 路径 = 根 ? join(根, ...点的文件) : ''

  const 读 = () => (路径 ? 读行(路径) : [])

  /** 最后一次同名的点说了算（模型判的会盖在规则上面） */
  const 索引 = () => {
    const 表 = new Map()
    for (const p of 读()) 表.set(点的键(p), p)
    return 表
  }

  const 记 = (点) => {
    if (!路径) return false
    try {
      mkdirSync(dirname(路径), { recursive: true })
      appendFileSync(路径, JSON.stringify({
        time: String(点.time || new Date().toISOString()),
        摘要: String(点.摘要 || '').slice(0, 60),
        emotion: String(点.emotion || '平静'),
        来源: String(点.来源 || 'rule'),
        valence: Number(点.valence ?? 0),
        arousal: Number(点.arousal ?? 0),
        dominance: Number(点.dominance ?? 0),
        warmth: Number(点.warmth ?? 0),
        optimism: Number(点.optimism ?? 0),
        softness: Number(点.softness ?? 0),
        ...(点.歪了 ? { 歪了: String(点.歪了) } : {}),
      }) + '\n', 'utf8')
      return true
    } catch (error) {
      记账('情绪点存不上：' + String((error && error.message) || error))
      return false
    }
  }

  /**
   * 补老事件（2026-11-06）：events.jsonl 里已经有 valence / arousal 的，照它补一个点；
   * 缺的轴给 0（中性）。补过的记在文件里，下次不重复。
   */
  const 补 = () => {
    if (!根) return { 补了: 0 }
    const 事件们 = 读行(join(根, 'memory', 'events.jsonl'))
    if (!事件们.length) return { 补了: 0 }
    const 已有 = new Set(读().map(点的键))
    let 补了 = 0
    for (const e of 事件们) {
      const 键 = 点的键(e)
      if (!键 || 已有.has(键)) continue
      if (e.valence == null && e.arousal == null) continue
      if (记({
        time: e.time,
        摘要: e.summary,
        emotion: e.emotion || 判规则(e.summary).emotion,
        valence: Number(e.valence ?? 0),
        arousal: Number(e.arousal ?? 0),
        来源: 'fill',
      })) { 补了 += 1; 已有.add(键) }
    }
    if (补了) 记账('老事件补了 ' + 补了 + ' 个情绪点')
    return { 补了 }
  }

  /** 按时间连成一条折线（设置页画时间隧道用，只做二维） */
  const 时间隧道 = ({ 最多 = 200 } = {}) => {
    const 们 = 读().slice(-Math.max(1, Number(最多) || 200))
    return 们.map((p) => ({
      time: String(p.time || ''),
      emotion: String(p.emotion || ''),
      valence: Number(p.valence ?? 0),
      arousal: Number(p.arousal ?? 0),
    }))
  }

  return { 读, 记, 补, 索引, 时间隧道, 路径 }
}
