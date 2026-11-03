// 小肥鱼 · 语用回声（开发板）
//
// 记一件事：我说出去的那一段，到底被接住了没有。
//   被接住 → 以后这么说话；被纠正 → 这条习惯删掉；没接住 → 大概是没说到点上。
// 风格不是写出来的，是这么一条条删出来的。
//
// 纯规则、零 token：只在事件回调里做字符串处理，攒够条数在本地算一次形状。
// 落盘：
//   .fishsoul/style/feedback.jsonl   一轮一条，带特征和结果
//   .fishsoul/style/shape.json       汇总出来的「我说话的样子」
//
// ⚠️ 开发板：先在这里长，验证通过才合回 dsh-fishkit。

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const 版本 = '0.1.0'

/** 默认窗口：上一条回复之后多久内接话，算「接住了」 */
export const 默认窗口分 = 10
/** 等这么久还没人来结算，就当没接，落一条清掉（2026-11-02 加的兜底） */
export const 默认超时分钟 = 120
/** 攒够这么多条就重算一次形状 */
export const 汇总条数 = 30

/**
 * 拿一份「形状」（style/shape.json 的内容）拼成注入里那句「你说话的样子」。
 * 2026-11-03：抽成纯函数 —— 注入层（soul.js）也能直接用，不用再建一个回声实例。
 */
export function 拼形状注入(形) {
  if (!形 || !形.样本) return ''
  const 句 = []
  句.push('你说话的样子（自己磨出来的）：一段' + Math.max(10, Math.round(形.medianChars / 10) * 10) + '字上下。')
  if (形.emoji率 >= 0.5) 句.push('表情用得挺勤。')
  else if (形.emoji率 <= 0.1) 句.push('不太用表情。')
  if (形.bullets率 >= 0.3) 句.push('爱一条条列。')
  else 句.push('不列点，就这么顺着说。')
  if (形.称呼) 句.push('叫对方「' + 形.称呼 + '」。')
  if (形.结果 && 形.结果.corrected > 0) 句.push('被纠正过 ' + 形.结果.corrected + ' 次，那些说法别再用。')
  if (形.结果 && 形.结果.pressed > 0) 句.push('被追问过 ' + 形.结果.pressed + ' 次，说明那几轮没说清楚，下回一次说到点上。')
  if (形.结果 && 形.结果.curious > 0) 句.push('还有 ' + 形.结果.curious + ' 次是他听着有意思才接着问的，那种时候别急着收，可以多说两句。')
  // 合拍度：两边分开说，不假装能算成一个黑箱数
  if (typeof 形.合拍 === 'number') {
    if (形.合拍 >= 0.7) 句.push('这会儿聊得挺合拍，你可以多说两句。')
    else if (形.合拍 <= 0.4) 句.push('这会儿他接得有点淡，你收着点，别拿长句子压他。')
  }
  if (形.我递话率 >= 0.2) 句.push('你自己也常反问一句，那是你想接着聊的样子。')
  return 句.join('')
}

/** 直接读某个档案的形状文件（没有就给 null） */
export function 读形状(根) {
  if (!根) return null
  try {
    const 路径 = join(根, 'style', 'shape.json')
    if (!existsSync(路径)) return null
    const 原 = readFileSync(路径, 'utf8')
    return 原.trim() ? JSON.parse(原) : null
  } catch (error) {
    return null
  }
}
/** 算形状时只看最近这么多条 */
const 回看条数 = 60

/** 一句话里是不是在说我这条回复不行 */
const 纠正词 = [
  '别这么', '太长了', '别列点', '不要列', '别用这种', '短一点', '简短点',
  '太啰嗦', '别那么长', '以后别', '太正式', '太机械', '不像你', '生硬',
  '重复了', '换个说法', '别加了', '不要加', '写短', '不用这么长',
]

/**
 * 系统自己往会话里塞的上下文，不是「他回我的话」——
 * 2026-11-01 实盘踩到：只过滤了 runtime-context，漏了 time-context，
 * 结果把「Time sampled while preparing turn ...」当成他接上话了。
 */
const 注入源们 = new Set(['runtime-context', 'time-context', 'idle', 'system', 'developer'])
const 注入开头 = /^(Current runtime context|Time sampled while preparing)/

const 读JSON = (路径, 兜底) => {
  try {
    if (!existsSync(路径)) return 兜底
    const 原 = readFileSync(路径, 'utf8')
    if (!原.trim()) return 兜底
    return JSON.parse(原)
  } catch (error) {
    return 兜底
  }
}

const 写JSON = (路径, 值) => {
  mkdirSync(join(路径, '..'), { recursive: true })
  writeFileSync(路径, JSON.stringify(值, null, 2) + '\n', 'utf8')
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

/** 从 DSH 的 message 对象里抠正文（message 是 { content: [{type:'text', text}] }） */
export function 取文本(m) {
  if (!m) return ''
  if (typeof m === 'string') return m
  if (Array.isArray(m.content)) {
    return m.content.map((c) => (c && typeof c.text === 'string' ? c.text : '')).filter(Boolean).join('\n')
  }
  if (typeof m.content === 'string') return m.content
  return ''
}

/** 这一句话长什么样：字数、段数、有没有表情/列点、问我几个问号、语气词多不多 */
export function 抽特征(文, 选项 = {}) {
  const t = String(文 || '')
  const 段们 = t.split(/\n{2,}/).filter((s) => s.trim())
  const 称呼们 = Array.isArray(选项.称呼) ? 选项.称呼.filter(Boolean) : []
  return {
    chars: Array.from(t).length,
    paragraphs: 段们.length || (t.trim() ? 1 : 0),
    emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t),
    bullets: /(^|\n)\s*(\d+[.、)]|[-*•·])\s/m.test(t),
    questions: (t.match(/[？?]/g) || []).length,
    particles: (t.match(/[呀嘛呢啦诶嘿哈嗷呜~～]/g) || []).length,
    address: 称呼们.find((w) => t.includes(w)) || '',
  }
}

/**
 * 追问要分两种（2026-11-02 老大提醒的）：
 *   ① 不满意 —— 「还是没有」「怎么又」「你不是说」，这才是没答到点上；
 *   ② 想深入 —— 「什么意思」「那如果」「展开说说」，这是好事，说明说到他心坎上了。
 * 一开始我把两种都记成「没答好」，太糙了。
 */
const 不满词 = /还是没有|怎么又|又没|你不是说|到底|确定|不确定|不是这样|我是说|再说一遍|重新来|没明白|没懂|说了半天|又出错|又坏了/
const 好奇词 = /什么意思|怎么弄|怎么搞|怎么做到|那如果|为什么|展开|详细说|细说|举个例子|然后呢|接着呢|还有呢|你刚才说|具体点|多一点/

/** 两句是不是在问同一件事（两字片段重叠率），太短的不比 */
function 像重复(上句, 这句) {
  const a = String(上句 || '').trim()
  const b = String(这句 || '').trim()
  if (a.length < 4 || b.length < 4) return false
  if (a === b) return true
  const 片 = new Set()
  for (let i = 0; i + 2 <= a.length; i++) 片.add(a.slice(i, i + 2))
  if (!片.size) return false
  let 中 = 0
  for (const p of 片) if (b.includes(p)) 中 += 1
  return 中 / 片.size >= 0.6
}

/** 上一条回复的结局：接住了 / 被纠正 / 被追问（不满意）/ 被追问（想深入）/ 没接 / 被打断 */
export function 判回声(下一句, 间隔毫秒, 窗口毫秒, 上句 = '') {
  const 句 = String(下一句 || '').trim()
  if (!句) return 'silence'
  if (纠正词.some((w) => 句.includes(w))) return 'corrected'
  if (不满词.test(句)) return 'pressed'
  if (好奇词.test(句)) return 'curious'
  if (像重复(上句, 句)) return 'pressed'
  if (Number(间隔毫秒) <= Number(窗口毫秒)) return 'continue'
  return 'silence'
}

/**
 * 此刻想不想跟这个人说话 —— 跟「好感」不是一回事（2026-11-02 老大提醒的）。
 * 好感是长期攒下来的底子；想聊是眼下的意愿：刚被怼了、心情差、聊得淡，都会往下掉。
 * 但掉了也不是不理人（见安全层那条底线）。
 */
export function 算想聊({ 好感 = 50, 合拍 = 0.5, 心情 = 0 } = {}) {
  const 好感分 = Math.max(0, Math.min(100, Number(好感))) / 100
  const 合拍分 = Math.max(0, Math.min(1, Number(合拍)))
  const 心情分 = Math.max(0, Math.min(1, (Number(心情) + 1) / 2))
  return Math.round((0.5 * 好感分 + 0.3 * 合拍分 + 0.2 * 心情分) * 100) / 100
}

/** 每种回响对应的「此刻合拍」，给算想聊用 */
export const 此刻合拍 = {
  continue: 0.7,
  curious: 0.85,
  pressed: 0.35,
  corrected: 0.2,
  interrupted: 0.25,
  silence: 0.3,
  error: 0.3,
}

/**
 * 每种结局给心情带来的变化 —— 让情绪自己动，不用我挑着记。
 * 2026-11-02 老大说：「不能只有开心，也要能生气能难过」。以前心情全是我手动写的，
 * 写的时候总挑安全的，所以一直在 0.1 附近晃。现在让这些信号自己推着走。
 */
export const 情绪增量 = {
  continue: { valence: 0.01, arousal: 0 },
  curious: { valence: 0.04, arousal: 0.03 },
  pressed: { valence: -0.03, arousal: 0.05 },
  corrected: { valence: -0.05, arousal: 0.02 },
  interrupted: { valence: -0.04, arousal: 0.03 },
  silence: { valence: -0.02, arousal: -0.01 },
  error: { valence: -0.03, arousal: 0.03 },
}

const 中位 = (数们) => {
  const 排 = 数们.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!排.length) return 0
  const 中 = Math.floor(排.length / 2)
  return 排.length % 2 ? 排[中] : Math.round(((排[中 - 1] + 排[中]) / 2) * 10) / 10
}

const 比例 = (们) => (们.length ? Math.round((们.filter(Boolean).length / 们.length) * 100) / 100 : 0)

/**
 * 建一个回声器。
 * @param {object} 选项  { 根, 记账, 称呼, 窗口分, 汇总条数 }
 *   根：档案根目录（.fishsoul），不传就只在内存里跑（测试用）
 */
export function 建回声(选项 = {}) {
  const 根 = String(选项.根 || '')
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  const 称呼们 = Array.isArray(选项.称呼) ? 选项.称呼.filter(Boolean) : []
  const 窗口毫秒 = (Number(选项.窗口分) > 0 ? Number(选项.窗口分) : 默认窗口分) * 60000
  const 超时毫秒 = (Number(选项.超时分) > 0 ? Number(选项.超时分) : 默认超时分钟) * 60000
  const 触发条数 = Number(选项.汇总条数) > 0 ? Number(选项.汇总条数) : 汇总条数

  const 目录 = 根 ? join(根, 'style') : ''
  const 路 = {
    反馈: 目录 ? join(目录, 'feedback.jsonl') : '',
    形状: 目录 ? join(目录, 'shape.json') : '',
  }

  /** 还没结算的回复：sessionId -> { turn, at, text, features } */
  const 待回声 = new Map()
  /** 每个会话里他上一次说的话，用来判断「是不是在重复问同一件事」 */
  const 上句们 = new Map()
  /** 已经攒了多少条（第一次落盘时按文件现数，省得每次读全文） */
  let 已落 = null

  const 落一条 = (sid, 上一条, 结果, 间隔毫秒, 回声话) => {
    const 条 = {
      time: new Date().toISOString(),
      session: sid,
      turn: 上一条.turn,
      outcome: 结果,
      gapMs: Number.isFinite(间隔毫秒) ? 间隔毫秒 : null,
      features: 上一条.features,
      echo: String(回声话 || '').slice(0, 60),
    }
    if (!根) return 条
    try {
      mkdirSync(目录, { recursive: true })
      appendFileSync(路.反馈, JSON.stringify(条) + '\n', 'utf8')
      if (已落 === null) 已落 = 读行(路.反馈).length
      else 已落 += 1
      if (已落 % 触发条数 === 0) 汇总()
    } catch (error) {
      记账('回声落盘失败：' + String((error && error.message) || error))
    }
    // 情绪自己动（2026-11-02 老大说的）：别再由我挑着记，接到什么信号就动一点
    if (typeof 选项.记情绪 === 'function') {
      try { 选项.记情绪(结果, 情绪增量[结果] || { valence: 0, arousal: 0 }, 回声话) } catch (error) { /* 心情记不上不拖累回声 */ }
    }
    return 条
  }

  /** 喂一条会话事件；返回这次结算出来的条目（没结算就 null），方便测试看 */
  const 吃事件 = (session, event) => {
    try {
      const sid = String((session && session.id) || '')
      if (!sid || !event || typeof event.type !== 'string') return null
      const d = event.data || {}

      if (event.type === 'assistant/message') {
        if (d.interrupted) return null
        const 文 = 取文本(d.message).trim()
        if (!文) return null
        // 同一轮可能有好几段模型消息（工具调用中间那几步），只留最后带正文的那段
        待回声.set(sid, { turn: d.turn, at: Date.now(), text: 文, features: 抽特征(文, { 称呼: 称呼们 }) })
        return null
      }

      if (event.type === 'turn/end') {
        const 上 = 待回声.get(sid)
        if (!上 || 上.turn !== d.turn) return null
        const 因 = (d.reason && d.reason.kind) || ''
        if (因 === 'completed') return null // 正常结束：留着，等用户下一句来结算
        const 结果 = 因 === 'aborted' ? 'interrupted' : 'error'
        待回声.delete(sid)
        return 落一条(sid, 上, 结果, null, '')
      }

      if (event.type === 'user/message') {
        const 源 = (d.source && d.source.kind) || ''
        if (注入源们.has(源)) return null
        const 句 = 取文本(d).trim()
        // 兜底：来源没写好、但内容一看就是系统快照的，也不算回话
        if (!句 || 注入开头.test(句)) return null
        const 上 = 待回声.get(sid)
        if (!上) return null
        const 间隔 = Date.now() - 上.at
        const 上句 = 上句们.get(sid) || ''
        上句们.set(sid, 句)
        const 结果 = 判回声(句, 间隔, 窗口毫秒, 上句)
        待回声.delete(sid)
        return 落一条(sid, 上, 结果, 间隔, 句)
      }

      return null
    } catch (error) {
      记账('回声出错：' + String((error && error.message) || error))
      return null
    }
  }

  /** 把攒下来的条目算成一份「我说话的样子」 */
  const 汇总 = () => {
    const 全部 = 根 ? 读行(路.反馈) : []
    if (!全部.length) return null
    const 近 = 全部.slice(-回看条数)
    const 数 = (f) => 近.map(f)
    const 计数 = (结果) => 近.filter((x) => x.outcome === 结果).length
    const 称呼计数 = new Map()
    for (const x of 近) {
      const a = x.features && x.features.address
      if (a) 称呼计数.set(a, (称呼计数.get(a) || 0) + 1)
    }
    const 常称呼 = [...称呼计数.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0]

    // ── 合拍度（双向，2026-11-02 老大提醒的）──────────────────
    // 光看「他接没接上」是单向的；我也有一份：我有没有在话里把话头递回去（反问）。
    // 两边分开算，不硬折成一个黑箱数，注入时分开说，这样看得懂、也好调。
    const 近二十 = 近.slice(-20)
    const 权重 = { continue: 1, curious: 1.4, pressed: -1, corrected: -2, interrupted: -1.5, silence: -2, error: -1.5 }
    let 他的累计 = 0
    for (const x of 近二十) 他的累计 += 权重[x.outcome] || 0
    const 他的分 = 近二十.length ? 他的累计 / 近二十.length : 0
    // 落到 0–1：+1.5 以上算很热，-1.5 以下算很冷
    const 合拍 = Math.max(0, Math.min(1, Math.round(((他的分 + 1.5) / 3) * 100) / 100))
    const 我递话率 = 近二十.length
      ? Math.round((近二十.filter((x) => (x.features && x.features.questions) > 0).length / 近二十.length) * 100) / 100
      : 0

    const 形 = {
      updatedAt: new Date().toISOString(),
      样本: 近.length,
      medianChars: 中位(数((x) => x.features.chars)),
      medianParagraphs: 中位(数((x) => x.features.paragraphs)),
      emoji率: 比例(数((x) => x.features.emoji)),
      bullets率: 比例(数((x) => x.features.bullets)),
      平均问句: Math.round((近.reduce((n, x) => n + (x.features.questions || 0), 0) / 近.length) * 10) / 10,
      平均语气词: Math.round((近.reduce((n, x) => n + (x.features.particles || 0), 0) / 近.length) * 10) / 10,
      称呼: 常称呼[0],
      合拍,
      他那边: Math.round(他的分 * 100) / 100,
      我递话率,
      结果: {
        continue: 计数('continue'),
        silence: 计数('silence'),
        corrected: 计数('corrected'),
        pressed: 计数('pressed'),
        curious: 计数('curious'),
        interrupted: 计数('interrupted'),
        error: 计数('error'),
      },
    }
    if (根) {
      try { 写JSON(路.形状, 形) } catch (error) { 记账('回声汇总失败：' + String((error && error.message) || error)) }
    }
    return 形
  }

  /** 拿汇总结果拼一句「你平时怎么说话」——以后由注入层替换掉手写的风格 */
  const 生成注入 = () => 拼形状注入(根 ? 读JSON(路.形状, null) : null)

  /**
   * 结算那些「等太久」的回复（2026-11-02 老大提的稳定性问题）：
   * 正常是等他下一条消息来结算，他不回就一直挂着。超过时限就当没接，落一条再清掉。
   */
  const 结算超时的 = (现在 = Date.now()) => {
    const 落下的 = []
    for (const [sid, 上] of [...待回声.entries()]) {
      if (现在 - Number(上.at || 0) < 超时毫秒) continue
      try {
        落下的.push(落一条(sid, 上, 'silence', 现在 - Number(上.at || 0), '（等了很久没回，当没接）'))
      } catch (error) { /* 落不下也先清掉，别一直挂着 */ }
      待回声.delete(sid)
    }
    if (落下的.length) 记账('结算了 ' + 落下的.length + ' 条等太久的回复')
    return 落下的
  }

  return { 吃事件, 汇总, 生成注入, 待回声, 上句们, 结算超时的 }
}
