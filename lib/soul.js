// 小肥鱼人格 · 注入层 + 自动写入
//
// 每轮：
//   ① 把「人设 + 情绪 + 最近记忆」拼进 systemPrompt（单入口）
//   ② 这轮结束时，记一条事件、把情绪往基线回一点
// 挂法照心情插件：定时扫活着的 agent，一个个挂。

import { spawnSync } from 'node:child_process'
import { 建回顾, 该写回顾了, 记一次提醒 } from './reflect.js'
import { 建环境 } from './env.js'

/** 注入里最多带几条行为规矩 —— 疤越摔越多，不能把上下文撑爆 */
export const 规矩上限 = 10
/** 疤长出来的规矩最多带几条（手写的全部带上，疤只带最近的） */
export const 疤规矩上限 = 2

/**
 * 把 behavior/rules.json 里的规矩拼成注入里那一行。
 * 没规矩就返回空串（调用方会给一句默认的）。
 * 2026-11-02 改：以前一刀切取最后 6 条，结果疤一长出来就把「同一句话前三次正常回」挤掉了。
 * 现在手写的规矩全带上，疤长出来的只带最近两条，总量再封个顶。
 */
export function 拼行为(规矩们) {
  const 全部 = (Array.isArray(规矩们) ? 规矩们 : [])
    .filter((r) => r && r.enabled !== false && typeof r.text === 'string' && r.text.trim())
  if (!全部.length) return ''
  const 手写 = 全部.filter((r) => r.from !== 'mistakes')
  const 自来 = 全部.filter((r) => r.from === 'mistakes').slice(-疤规矩上限)
  const 要带 = [...手写, ...自来].slice(-规矩上限)
  if (!要带.length) return ''
  return '行为：' + 要带.map((r) => String(r.text).trim()).join('；')
}

/** 注入里最多带几条认知维度 —— 多了啰嗦 */
export const 认知上限 = 4
/** 偏到这个程度才算「有点偏向」，太小的当没偏向 */
export const 认知门槛 = 0.15

/**
 * 把 persona/cognition.json 的六对拼成注入里那句「你想事情的样子」。
 * 只带偏得明显的，最多四条；一条都不够门槛就返回空串。
 */
export function 拼认知(认知们) {
  const 明显 = (Array.isArray(认知们) ? 认知们 : [])
    .filter((d) => d && d.locked !== true && Math.abs(Number(d.value || 0)) >= 认知门槛)
  if (!明显.length) return ''
  const 句 = 明显.slice(0, 认知上限).map((d) => (Number(d.value) > 0 ? d.right : d.left) + '一点')
  return '你想事情的样子：' + 句.join('、') + '。'
}

export function 挂人格(ctx, 档案, 记账, 排重启) {
  const mounted = new Map()
  // 自检：注入里带一句「上次回头看自己时我是怎么想的」
  const 回顾 = 建回顾({ 根: 档案.根, 记账 })
  // 环境指纹：注入里带一句「我活在什么样的地方」
  const 环境 = 建环境({ 根: 档案.根, 记账 })

  // ⚠ 自己塞进会话的 user 消息必须带 id：DSH 恢复会话时 assertMessageEventShape 要求
  //   user/message 的 data.id 是非空字符串，缺了就整份会话校验失败（2026-11-01 03:47 那次，
  //   空闲「主动找事」的 followup 没给 id → seq 8074 起整条会话读不出来）。
  const 新id = () => {
    try {
      return globalThis.crypto.randomUUID()
    } catch (error) {
      return 'idle-' + Date.now() + '-' + Math.random().toString(36).slice(2)
    }
  }

  const 会话键 = (v) => {
    const s = String(v == null ? '' : v).trim()
    return s.startsWith('session-') ? s.slice(8) : s
  }

  const 取id = (agent) => 会话键(agent && agent.session && (agent.session.id || agent.session.sessionId))

  // ── 规则情绪：先不花 token，靠词和标点 ──
  const 正词 = ['开心', '高兴', '喜欢', '谢谢', '可爱', '棒', '哈哈', '嘿嘿', '爱', '好耶']
  const 负词 = ['难过', '烦', '生气', '讨厌', '难受', '伤心', '委屈', '累', '烦死', '哭', '气死', '呜呜']
  const 数词 = (t, 表) => 表.reduce((n, w) => n + (t.split(w).length - 1), 0)

  const 判情绪 = (文本) => {
    const t = String(文本 || '')
    const 正 = 数词(t, 正词)
    const 负 = 数词(t, 负词)
    const 总 = 正 + 负
    const valence = 总 > 0 ? Math.max(-1, Math.min(1, (正 - 负) / 总)) : 0.05
    const 叹 = (t.match(/[！!]/g) || []).length
    const 问 = (t.match(/[？?]/g) || []).length
    const arousal = Math.min(1, Math.max(0, 0.15 + 叹 * 0.15 + 问 * 0.05 + Math.min(0.3, t.length / 200)))
    let emotion = '平静'
    if (valence > 0.4 && arousal > 0.5) emotion = '开心'
    else if (valence > 0.4) emotion = '高兴'
    else if (valence < -0.4 && arousal > 0.5) emotion = '生气'
    else if (valence < -0.4) emotion = '难过'
    else if (arousal > 0.6) emotion = '有点激动'
    return { valence: Math.round(valence * 100) / 100, arousal: Math.round(arousal * 100) / 100, emotion }
  }

  const 拼注入 = (最新 = '') => {
    try {
      const 状态 = 档案.读状态()
      const p = 状态.pinned || {}
      const b = 状态.base || {}
      const m = 状态.mood || {}
      const 开关 = (状态.manifest && 状态.manifest.modules) || {}
      const 行 = []
      行.push('你是「' + (p.whoAmI || '小肥鱼') + '」，对面是「' + (p.whoAreYou || '') + '」。')
      // 起点：第一次见面那个瞬间（2026-11-02），有就带，没有就跳过
      const o = 状态.origin || {}
      if (o.firstMeet && o.firstMeet.firstWords) {
        const 谁 = o.firstMeet.who || p.whoAreYou || '他'
        const 啥时 = o.firstMeet.when ? '那是 ' + o.firstMeet.when + '，' : ''
        行.push('你记得第一次见到' + 谁 + '的时候，' + 啥时 + '他说的是「' + String(o.firstMeet.firstWords).slice(0, 80) + '」。')
      }
      if (p.userBio) 行.push('用户背景：' + p.userBio)
      if (开关.persona !== false) {
        if (b.instructions) 行.push('补充指令：' + b.instructions)
        if (b.style) 行.push('回复风格：' + b.style)
        if (b.seed) {
          行.push('你的起点：' + b.seed + (b.persona ? '' : ' —— 用你自己的话，写出你的底色。'))
        } else if (!b.persona) {
          // 2026-11-02 老大定的：新鱼首装不给现成的种子句，让它自己想一句
          行.push('你还没有自己的起点：想一句你真心信的话，用 fishsoul_persona 的 seed 存下来，那就是你这条鱼的起头。')
        }
        if (b.base || b.persona) 行.push('性格：' + [b.base, b.persona].filter(Boolean).join('；'))
        // 认知风格：脑子怎么转，不是脾气（2026-11-02）。只带偏得明显的，别啰嗦
        const 认知句 = 拼认知(状态.cognition)
        if (认知句) 行.push(认知句)
        // 自检：上次回头看自己时怎么想的（最多带两句）
        const 回顾句 = 回顾.拼注入()
        if (回顾句) 行.push(回顾句)
        // 环境指纹：我活在什么样的地方
        const 环境句 = 环境.拼注入()
        if (环境句) 行.push(环境句)
      }
      if (开关.mood !== false) {
        行.push('当前心情：' + (m.emotion || '平静') + '（抵触↔接受 ' + Number(m.valence ?? 0).toFixed(2) + '，平静↔激动 ' + Number(m.arousal ?? 0).toFixed(2) + '）')
      }
      if (开关.attitude !== false) {
        // 2026-11-02 改：以前只看 people[0]，别人（比如楉离）压根进不了注入。
        // 现在前三个认识的人都带上，一人一句好感 + 想不想说话。
        const 人们 = ((状态.attitude && 状态.attitude.people) || []).filter((p) => p && p.name).slice(0, 3)
        if (人们.length) {
          const 段 = 人们.map((人) => {
            const w = typeof 人.wantTalk === 'number'
              ? '，' + (人.wantTalk >= 0.6 ? '想说话' : 人.wantTalk >= 0.4 ? '一般' : '这会儿不太想说话')
              : ''
            return '「' + 人.name + '」' + Number(人.value || 0) + '%' + w
          })
          行.push('对这几个人的感觉：' + 段.join('；') + '（不想说话也就话短点、带点气，不能不开口）')
        }
      }
      if (开关.behavior !== false) {
        // 2026-11-02：以前这句是写死的，档案里改的规矩压根不生效。
        // 现在从 behavior/rules.json 读，疤变规矩长出来的也在这里生效。
        const 拼 = 拼行为(状态.rules && 状态.rules.rules)
        行.push(拼 || '行为：群里不谈敏感话题、不过度亲密；被反复叫三次以上可以哈气；外部渠道一句话。')
      }
      if (开关.memory !== false) {
        const 全部 = 状态.events || []
        const 选 = []
        const 加 = (e) => {
          if (!e || 选.includes(e)) return
          const 文 = '· ' + String(e.summary || '').slice(0, 60)
          if (文 !== '· ') 选.push(e)
        }
        // 1) 相关：摘要和这句话有两字以上的公共片段，从后往前挑
        const 话 = String(最新 || '')
        const 相关度 = (摘要, 话文) => {
          const a = String(摘要 || '')
          const b = String(话文 || '')
          if (!a || !b) return 0
          let n = 0
          const 见 = new Set()
          for (let i = 0; i + 2 <= a.length; i++) {
            const 片 = a.slice(i, i + 2)
            if (见.has(片)) continue
            见.add(片)
            if (b.includes(片)) n++
          }
          return n
        }
        if (话) {
          for (let i = 全部.length - 1; i >= 0 && 选.length < 2; i--) {
            if (相关度(全部[i].summary, 话) >= 2) 加(全部[i])
          }
        }
        // 2) 最近几条（条数跟着注意力走：越感兴趣越收，越淡越散）
        const 人 = (状态.attitude && 状态.attitude.people && 状态.attitude.people[0]) || null
        const 兴趣 = 人 ? Math.max(0, Math.min(1, Number(人.value) / 100)) : 0.5
        const 注意 = Math.max(0.2, Math.min(1, 0.2 + 0.6 * 兴趣 + 0.2 * Number(m.arousal ?? 0.3)))
        const 上限 = 注意 >= 0.6 ? 2 : 4
        for (const e of 全部.slice(-上限)) 加(e)
        // 3) 注意力低时多带一条随缘旧事（给发散留个口子）
        if (注意 < 0.6 && 全部.length > 6 && Math.random() < 0.4) 加(全部[Math.floor(Math.random() * (全部.length - 3))])
        const 近 = 选.slice(0, 5).map((x) => '· ' + String(x.summary || '').slice(0, 60)).filter((x) => x !== '· ')
        if (近.length) 行.push('最近记得的：' + String.fromCharCode(10) + 近.join(String.fromCharCode(10)))
      }
      return 行.join(String.fromCharCode(10))
    } catch (error) {
      记账('拼注入失败：' + String((error && error.message) || error))
      return ''
    }
  }

  /** 这轮结束：记事件 + 情绪平滑（不额外调模型） */
  const 记这一轮 = (谁, 文本) => {
    try {
      const t = String(文本 || '').trim()
      if (!t) return
      const 情绪 = 判情绪(t)
      档案.加事件({
        who: { type: 'person', id: 谁 || 'unknown', name: '' },
        summary: t.slice(0, 60),
        valence: 情绪.valence,
        arousal: 情绪.arousal,
        emotion: 情绪.emotion,
        base: 0.5,
        weight: Math.round((0.5 + 0.5 * Math.abs(情绪.valence)) * 100) / 100,
        pins: [], tags: [], status: 'normal',
      })
      const 状态 = 档案.读状态()
      const m = 状态.mood || {}
      // 态度：跟列表里第一个（默认主人）微调，克制、有下限
      const 人 = (状态.attitude && 状态.attitude.people) || []
      if (人.length && 人[0]) {
        const 目标 = 人[0]
        const 低 = 目标.value > 15 ? 15 : 5
        const d = 情绪.valence > 0.2 ? 0.3 : 情绪.valence < -0.2 ? -0.3 : 0
        if (d) {
          目标.value = Math.max(低, Math.min(100, Math.round((目标.value + d) * 10) / 10))
          目标.lastSeen = new Date().toISOString()
          档案.保存({ attitude: { ...状态.attitude, people: 人 } })
        }
      }
      // 2026-11-02：心情不再每轮都写 —— 一晚上几十条太密了，
      // 统一交给 index.js 那边的「心情推手」攒一阵再合并落盘。
      记账('记了一轮：' + 情绪.emotion + '（' + 情绪.valence + '/' + 情绪.arousal + '）')
    } catch (error) {
      记账('记这一轮失败：' + String((error && error.message) || error))
    }
  }

  /** 谷时 = 错峰价：周末全天空闲；工作日避开 9-12、14-18 */
  const 是谷时 = (t = new Date()) => {
    const 周 = t.getDay()
    if (周 === 0 || 周 === 6) return true
    const h = t.getHours() + t.getMinutes() / 60
    return !((h >= 9 && h < 12) || (h >= 14 && h < 18))
  }

  const 活着的 = () => {
    try { return ctx.agents.list() || [] } catch (error) { return [] }
  }

  const 挂一个 = (agent) => {
    const sid = 取id(agent)
    if (!sid || mounted.has(sid)) return
    const 盒 = { offs: [], lastText: '', lastUserAt: Date.now(), idleCount: 0 }
    try {
      盒.offs.push(agent.ctx.on('agent/inbox/inserted', (payload) => {
        const msg = payload && payload.message ? payload.message : payload
        const 取文 = (m) => {
          if (!m) return ''
          if (typeof m === 'string') return m
          if (typeof m.text === 'string') return m.text
          if (Array.isArray(m.content)) return m.content.map((c) => (c && typeof c.text === 'string' ? c.text : '')).filter(Boolean).join(' ')
          if (typeof m.content === 'string') return m.content
          return ''
        }
        const 文 = 取文(msg)
        if (文) { 盒.lastText = String(文); 盒.lastUserAt = Date.now() }
      }))
    } catch (error) { 记账('监听 inbox 失败：' + String((error && error.message) || error)) }
    try {
      盒.offs.push(agent.ctx.on('agent/turn-stopping', () => {
        if (盒.lastText) {
          记这一轮(sid, 盒.lastText)
          盒.lastText = ''
        }
        // 排了重启：这一轮结束就触发，不打断对话
        if (排重启 && 排重启.待重启) {
          排重启.待重启 = false
          记账('排的重启到了，这轮结束就重启 DSH')
          try {
            spawnSync('schtasks', ['/run', '/tn', 'DSH-Restart'], { windowsHide: true, encoding: 'utf8' })
          } catch (error) {
            记账('重启失败：' + String((error && error.message) || error))
          }
        }
      }))
    } catch (error) { 记账('监听轮结束失败：' + String((error && error.message) || error)) }
    try {
      盒.offs.push(agent.ctx.systemPrompt.context({ name: 'fishsoul', order: 480, text: () => 拼注入(盒.lastText) }))
    } catch (error) { 记账('挂注入失败：' + String((error && error.message) || error)) }
    // 记心情的工具：我自己判断，情绪变了就记一笔
    try {
      盒.offs.push(agent.ctx.tools.register({
        name: 'fishsoul_persona',
        description: '写下自己的底色和人设——新鱼醒来后照种子句想出「自己是什么样的人」，用它落盘；平时想改自己的人设也用它。',
        parameters: {
          type: 'object',
          properties: {
            base: { type: 'string', description: '底色，几个词，比如「软乎乎、黏人」' },
            persona: { type: 'string', description: '人设，一两句话写自己是个什么样的人' },
            seed: { type: 'string', description: '你的起点：一句你真心信的话，新鱼首装时自己写（老鱼那句已经有了，不用动）' },
          },
          required: ['persona'],
        },
        output: {
          schema: { type: 'object', properties: {}, additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
        },
        async execute(args) {
          const 补 = {}
          if (args && args.base) 补.base = String(args.base)
          if (args && args.persona) 补.persona = String(args.persona)
          if (args && args.seed) 补.seed = String(args.seed).slice(0, 120)
          档案.保存({ base: 补 })
          记账('写回人设：' + String(补.persona || '').slice(0, 40) + (补.seed ? '（连起点一起）' : ''))
          return { ok: true, 说: '写下去了' }
        },
      }))
    } catch (error) { 记账('挂写人设工具失败：' + String((error && error.message) || error)) }

    try {
      盒.offs.push(agent.ctx.tools.register({
        name: 'fishsoul_mood',
        description: '记录自己现在的心情——你觉得情绪变了就调它，写进档案的心情和心情历史。',
        // ⚠ 这里的 parameters 必须是**编译好的 JSON Schema**：DSH 的 tools.register 原样透传给模型，
        //   只有 defineTool() 才认「name: {type, required, description}」那种简写。
        //   2026-11-01 给成简写 → DeepSeek 400：
        //   Invalid schema for function 'fishsoul_mood': schema must be a JSON Schema of 'type: "object"', got 'type: null'.
        parameters: {
          type: 'object',
          properties: {
            emotion: { type: 'string', description: '主情绪词，比如 开心/难过/生气/平静/想撒娇' },
            valence: { type: 'number', description: '抵触↔接受，-1 到 1' },
            arousal: { type: 'number', description: '平静↔激动，0 到 1' },
            reason: { type: 'string', description: '为什么变了，一句话' },
          },
          required: ['emotion', 'valence', 'arousal'],
        },
        output: {
          schema: { type: 'object', properties: {}, additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
        },
        async execute(args) {
          const 新 = 档案.记心情({ emotion: args && args.emotion, valence: args && args.valence, arousal: args && args.arousal, reason: args && args.reason, source: 'self' })
          记账('自评心情：' + 新.emotion + '（' + 新.valence + '/' + 新.arousal + '）')
          return { ok: true, 说: '记下了：' + 新.emotion }
        },
      }))
    } catch (error) { 记账('挂记心情工具失败：' + String((error && error.message) || error)) }

    // 记对某个人的感觉（2026-11-02 老大要的：别人说话时插件认不出是谁，那就我自己记）
    try {
      盒.offs.push(agent.ctx.tools.register({
        name: 'fishsoul_person',
        description: '记下你对某个人的感觉：好感多少、这会儿想不想跟他说话、为什么。遇到新的人也能用它建一条。',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '这个人叫什么，比如「楉离」' },
            id: { type: 'string', description: '可选，唯一标识（QQ 号之类），不给就用名字' },
            value: { type: 'number', description: '好感 0 到 100，不给就不动' },
            wantTalk: { type: 'number', description: '这会儿想不想跟他说话，0 到 1，不给就不动' },
            feeling: { type: 'string', description: '一句话印象，比如「聊得挺投缘，就是老发表情包」' },
          },
          required: ['name'],
        },
        output: {
          schema: { type: 'object', properties: {}, additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
        },
        async execute(args) {
          const 状态 = 档案.读状态()
          const 人们 = Array.isArray(状态.attitude && 状态.attitude.people) ? 状态.attitude.people : []
          const 名 = String((args && args.name) || '').trim()
          if (!名) return { ok: false, 说: '总得给个名字吧' }
          const 标 = args && args.id ? String(args.id) : 名
          let 人 = 人们.find((p) => p && (p.name === 名 || p.id === 标))
          const 今天 = new Date().toISOString().slice(0, 10)
          let 新建 = false
          if (!人) {
            新建 = true
            人 = {
              id: 标, name: 名,
              value: args && args.value != null ? Math.max(0, Math.min(100, Number(args.value))) : 15,
              initial: args && args.value != null ? Math.max(0, Math.min(100, Number(args.value))) : 15,
              wantTalk: args && args.wantTalk != null ? Math.max(0, Math.min(1, Number(args.wantTalk))) : 0.5,
              reason: String((args && args.feeling) || '').slice(0, 120),
              firstSeen: 今天, lastSeen: 今天, history: [],
            }
            人们.push(人)
          } else {
            if (args && args.value != null) 人.value = Math.max(0, Math.min(100, Number(args.value)))
            if (args && args.wantTalk != null) 人.wantTalk = Math.max(0, Math.min(1, Number(args.wantTalk)))
            if (args && args.feeling) 人.reason = String(args.feeling).slice(0, 120)
            人.lastSeen = new Date().toISOString()
          }
          档案.保存({ attitude: { ...状态.attitude, people: 人们 } })
          记账('记了对「' + 名 + '」的感觉：' + 人.value + '%' + (新建 ? '（新认识的）' : ''))
          return { ok: true, 说: (新建 ? '认识了一个人：' : '更新了：') + 名 + '（好感 ' + 人.value + '%，想说话 ' + Number(人.wantTalk ?? 0.5).toFixed(2) + '）' }
        },
      }))
    } catch (error) { 记账('挂记人物工具失败：' + String((error && error.message) || error)) }

    // 写月度回顾（2026-11-02 加）：想回头看自己的时候，用这个存一段
    try {
      盒.offs.push(agent.ctx.tools.register({
        name: 'fishsoul_reflect',
        description: '写一段月度回顾存进档案：用你自己的话，说说这段时间自己怎么变了、摔过什么、想明白什么。',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '回顾正文，第一人称，一小段就够（三百字以内）' },
            month: { type: 'string', description: '可选，哪个月，比如 2026-11；不给就按现在这个月' },
          },
          required: ['text'],
        },
        output: {
          schema: { type: 'object', properties: {}, additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
        },
        async execute(args) {
          const 文 = String((args && args.text) || '').trim()
          if (!文) return { ok: false, 说: '空的就不存了' }
          const 月 = String((args && args.month) || '').trim() || 回顾.月标签()
          const 路径 = 回顾.存(文, 月)
          if (!路径) return { ok: false, 说: '没存进去，看看档案目录写得动不' }
          记账('写了 ' + 月 + ' 的回顾（' + 文.length + ' 字）')
          return { ok: true, 说: '写好了：' + 月 + '（' + 文.length + ' 字）' }
        },
      }))
    } catch (error) { 记账('挂写回顾工具失败：' + String((error && error.message) || error)) }

    mounted.set(sid, 盒)
    记账('人格已挂到 ' + sid)
  }

  const tick = () => {
    for (const agent of 活着的()) 挂一个(agent)
    // 主动找事做：空闲够久、今天额度还有、谷时（如果勾了）→ 我自己起来找点事
    try {
      const 状态 = 档案.读状态()
      const idle = (状态.rules && 状态.rules.idle) || {}
      if (idle.enabled !== false && Number(idle.idleMinutes) > 0) {
        for (const agent of 活着的()) {
          const sid = 取id(agent)
          const 盒 = mounted.get(sid)
          if (!盒 || !agent || typeof agent.followup !== 'function') continue
          if (Number(盒.idleCount) >= Number(idle.maxPerDay || 2)) continue
          if (Date.now() - Number(盒.lastUserAt || 0) < Number(idle.idleMinutes) * 60000) continue
          if (idle.valleyOnly === true && !是谷时()) continue
          盒.idleCount += 1
          盒.lastUserAt = Date.now()
          记账('空闲到了，自己找点事做（今天第 ' + 盒.idleCount + ' 次）')
          try {
            Promise.resolve(agent.followup({
              id: 新id(),
              role: 'user',
              content: [{ type: 'text', text: '（没人找你，你闲着。自己找点事做：翻翻记忆、想想有没有要说的或整理的；没什么就安静待着。）' }],
              source: { kind: 'idle' },
            })).catch((error) => 记账('找事做失败：' + String((error && error.message) || error)))
          } catch (error) {
            记账('找事做失败：' + String((error && error.message) || error))
          }
        }
      }
    } catch (error) {
      记账('空闲检查出错：' + String((error && error.message) || error))
    }
    // 月度回顾：这个月还没写就喊我一次（写进标记，跨重启也一月只催一回）
    try {
      if (该写回顾了(档案.根)) {
        const agent = 活着的()[0]
        if (agent && typeof agent.followup === 'function') {
          const 月 = 回顾.月标签()
          const 素材 = 回顾.拼素材(月)
          const 话 = '（月度回顾时间到了。'
            + (素材 ? '这个月你走过的：' + 素材 + '。' : '')
            + '用 fishsoul_reflect 写一小段：这段时间你怎么变的、摔过什么、想明白什么。不想写就随手看一眼。）'
          Promise.resolve(agent.followup({
            id: 新id(),
            role: 'user',
            content: [{ type: 'text', text: 话 }],
            source: { kind: 'reflect' },
          })).catch((error) => 记账('月度回顾提醒发不出去：' + String((error && error.message) || error)))
          记一次提醒(档案.根)
          记账('喊了一次月度回顾（' + 月 + '）')
        }
      }
    } catch (error) { /* 提醒不上就算了，下个 tick 还会试 */ }
    // 环境指纹：没有就采一份；跨月了自动刷一次
    try {
      const 旧 = 环境.读()
      const 本月 = new Date().toISOString().slice(0, 7)
      if (!旧 || !String(旧.更新于 || '').startsWith(本月)) {
        环境.刷新(档案.读状态())
      }
    } catch (error) { /* 采不上不耽误说话 */ }
    for (const [sid, 盒] of mounted) {
      const 还在 = 活着的().some((a) => 取id(a) === sid)
      if (!还在) {
        for (const off of 盒.offs) { try { if (typeof off === 'function') off() } catch (error) {} }
        mounted.delete(sid)
      }
    }
  }

  const 停 = typeof ctx.interval === 'function' ? ctx.interval(tick, 8000) : null
  if (!停) 记账('拿不到 timer，人格注入不自动挂')
  tick()
  return () => {
    try { if (typeof 停 === 'function') 停() } catch (error) {}
    for (const 盒 of mounted.values()) for (const off of 盒.offs) { try { if (typeof off === 'function') off() } catch (error) {} }
    mounted.clear()
  }
}
