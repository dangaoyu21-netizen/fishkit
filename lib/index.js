// 小肥鱼工具箱 · 宿主半边
//
// 只做两件事：
//   ① 把 lib/modules/*.js 里的模块登记起来（每个模块 = 一个文件）
//   ② 收一条 HTTP 请求，转给对应模块去干
//
// ⚠ 这里不碰记忆、不碰会话、不碰别的插件 —— 它只是「总控」，坏了就卸掉，什么都不影响。
//   新功能验证过之后，往 modules/ 里放一个 .js 就挂上了，不用改这个文件。

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { 建档案核心 } from './fishsoul.js'
import { 挂人格 } from './soul.js'
import { 建整理器 } from './digest.js'
import { 建夜巡 } from './nightly.js'
import { 建更新器 } from './updater.js'
import { 建回声, 算想聊, 此刻合拍 } from './echo.js'
import { 建琢磨 } from './ponder.js'
import { 建疤 } from './scar.js'
import { 列账号, 删账号, 建账号本, 平台们, 验证账号 } from './accounts.js'
import { 建会话本 } from './sessions.js'
import { 建设备 } from './device.js'
import { 建通道, 绑定转文本, 文本转绑定 } from './qqlink.js'
import { 建出口 } from './qqout.js'
import { 建点本, 判规则 } from './affect.js'
import { 建B站 } from './bilibili.js'
import { 挂出门路由 } from './routes/browse.js'
import { 挂QQ路由 } from './routes/qq.js'
import { 挂杂项路由 } from './routes/misc.js'
import { 建出门本 } from './walklog.js'
import { 建扫码 } from './qrlogin.js'
import { 桥配置文件, 找收件人, 发到聊天 } from './qq.js'
import { 转写 as 语音转文字, 探ASR, 装ASR } from './asr.js'
import { 平台们 as 库平台们, 探依赖, 装依赖, 读装状态 } from './platforms.js'
import { 迁移指令 } from './migrate.js'
export const name = 'fishkit'
export const inject = ['webServer', 'timer', 'agents', 'systemPrompt', 'sessions', 'sessionTitle', 'llm']

const 路由前缀 = '/dsh-fishkit'
const 本目录 = dirname(fileURLToPath(import.meta.url))

/** 工作区：备份模块要拿它找 notes / AGENTS.md / 手笔。可用环境变量盖掉。 */
const 工作区 = String(process.env.DSH_WORKSPACE || '').trim() ||
  'C:\\Users\\yde20\\Documents\\deepseek-harness\\default-workspace'

export function apply(ctx) {
  const 日志 = []
  const 模块们 = new Map()
  let 最近结果 = null

  const 记账 = (文本) => {
    const d = new Date()
    const 补 = (n) => String(n).padStart(2, '0')
    const 时间 = `${补(d.getMonth() + 1)}-${补(d.getDate())} ${补(d.getHours())}:${补(d.getMinutes())}:${补(d.getSeconds())}`
    日志.push({ 时间, 文本 })
    if (日志.length > 80) 日志.shift()
    try { ctx.logger?.info(`fishkit: ${文本}`) } catch (error) {}
  }

  const 读体 = (req) =>
    new Promise((resolve) => {
      let 原 = ''
      req.on('data', (c) => { 原 += c })
      req.on('end', () => {
        try { resolve(原 ? JSON.parse(原) : {}) } catch (error) { resolve({}) }
      })
      req.on('error', () => resolve({}))
    })

  const 回 = (res, 体) => {
    try {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(体))
    } catch (error) {}
  }

  const 路线 = (路径, handler) =>
    ctx.effect(() =>
      ctx.webServer.register({
        kind: 'exact',
        path: 路径,
        handler: async (req, res) => {
          try { await handler(req, res) } catch (error) { 回(res, { ok: false, 说: String((error && error.message) || error) }) }
        },
      }),
    )

  const 加载模块们 = async () => {
    const 目录 = join(本目录, 'modules')
    let 文件们 = []
    try {
      文件们 = readdirSync(目录).filter((f) => f.endsWith('.js')).sort()
    } catch (error) {
      记账('没有 modules 目录，先当空的：' + String((error && error.message) || error))
      return
    }
    for (const 文件 of 文件们) {
      try {
        const 模 = await import(pathToFileURL(join(目录, 文件)).href)
        if (模 && 模.name && typeof 模.run === 'function') {
          模块们.set(String(模.name), { ...模, 文件名: 文件 })
        } else {
          记账('模块 ' + 文件 + ' 缺 name/run，跳过')
        }
      } catch (error) {
        记账('模块 ' + 文件 + ' 加载失败：' + String((error && error.message) || error))
      }
    }
    记账('模块加载完：' + ([...模块们.keys()].join('、') || '一个都没有'))
  }

  // ── 口子 ①：有哪些模块 ──────────────────────────────
  路线(`${路由前缀}/modules`, async (req, res) => {
    回(res, {
      ok: true,
      工作区,
      模块: [...模块们.values()].map((m) => ({ name: m.name, describe: m.describe || '', 文件名: m.文件名 })),
    })
  })

  // ── 口子 ②：跑一个模块 ──────────────────────────────
  路线(`${路由前缀}/run`, async (req, res) => {
    const 来 = await 读体(req)
    const 名 = String(来.模块 || '').trim()
    const 模 = 模块们.get(名)
    if (!模) {
      return 回(res, { ok: false, 说: '没有这个模块：' + 名 + '（有：' + ([...模块们.keys()].join('、') || '空') + '）' })
    }
    const 开始 = Date.now()
    try {
      const 结果 = await 模.run(来.参数 || {}, { ctx, 记账, 工作区 })
      const 全 = 结果 && typeof 结果 === 'object' ? 结果 : { ok: true, 说: String(结果 || '') }
      最近结果 = { 模块: 名, 时间: new Date().toISOString(), 结果: 全 }
      记账('跑完 ' + 名 + '：' + (全.ok === false ? '⚠ ' : '✅ ') + String(全.说 || ''))
      回(res, { ...全, ok: 全.ok !== false, 用时秒: Math.round((Date.now() - 开始) / 1000) })
    } catch (error) {
      最近结果 = { 模块: 名, 时间: new Date().toISOString(), 结果: { ok: false, 说: String((error && error.message) || error) } }
      记账('模块 ' + 名 + ' 出错：' + String((error && error.message) || error))
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  // ── 口子 ③：最近一次跑的结果 / 日志 ─────────────────
  路线(`${路由前缀}/last`, async (req, res) => {
    回(res, { ok: true, 最近: 最近结果, 日志 })
  })

  路线(`${路由前缀}/ping`, async (req, res) => {
    回(res, { ok: true, 说: '小肥鱼工具箱在', 工作区, 模块数: 模块们.size })
  })

  // ── 人格档案（小肥鱼） ────────────────────────────────
  // 档案模式：independent（默认，各工作区各一份）/ shared（所有工作区共用一份）
  const DSH家 = join(process.env.USERPROFILE || '', '.dsh')
  const 模式配置 = join(DSH家, 'fishsoul-config.json')
  const 读模式 = () => {
    try { return JSON.parse(readFileSync(模式配置, 'utf8')).mode === 'shared' ? 'shared' : 'independent' } catch (error) { return 'independent' }
  }
  const 模式 = 读模式()
  const 档案 = 建档案核心(工作区, { 共享: 模式 === 'shared', 共享目录: join(DSH家, 'fishsoul-shared') })
// 平台账号：哪个勾上了才允许主动去用（2026-11-03）
const 账号本 = 建账号本(档案.根)
// 每个会话的出门方向（2026-11-03）
const 会话本 = 建会话本({ 根: 档案.根, 记账 })
// 出门记录（2026-11-07）：设置页看「小肥鱼在不在逛、逛到哪了」
const 出门本 = 建出门本({ 根: 档案.根 })
// 设备码（2026-11-03）：第一次跑生成一份，之后只认它；机器标识读完就哈希，不落地
try { 建设备({ 根: 档案.根, 记账 }).初始化() } catch (error) { 记账('设备码没生成：' + String((error && error.message) || error)) }
  const 备份根 = join(工作区, '.fishsoul-backup')
  try { 档案.初始化() } catch (error) { 记账('档案初始化失败：' + String((error && error.message) || error)) }
  // 排重启那套 2026-11-03 删了（DSH-Restart 建不出来、沙箱也跑不了 schtasks）；要重启就麻烦老大在设置页点。
  ctx.effect(() => 挂人格(ctx, 档案, 记账, null), 'dsh-fishkit: 人格注入')

  // 2026-11-05：暂时留着的诊断 —— 会话标题到底拿不拿得到
  try {
    const 诊断会话 = ctx.get('sessions')
    const 诊断标题 = ctx.get('sessionTitle')
    const 样本 = 诊断会话 && typeof 诊断会话.list === 'function' ? 诊断会话.list()[0] : null
    记账('诊断：sessions=' + (typeof 诊断会话) + ' title=' + (typeof 诊断标题) +
      ' 样本=' + JSON.stringify(样本 ? { id: 样本.id, 键: Object.keys(样本).slice(0, 10) } : null))
    // 启动那一刻 store 可能还空着，十二秒后再看一眼
    setTimeout(() => {
      try {
        const 会话服务 = ctx.get('sessions')
        const 标题服务 = ctx.get('sessionTitle')
        const 们 = 会话服务 && typeof 会话服务.list === 'function' ? 会话服务.list() : []
        记账('诊断2：list 有 ' + 们.length + ' 条')
        for (const s of 们.slice(0, 3)) {
          let 题 = ''
          let 错 = ''
          try {
            const 快照 = 标题服务 && typeof 标题服务.get === 'function' ? 标题服务.get(s) : undefined
            题 = 快照 && 快照.title ? String(快照.title) : '(空)'
          } catch (error) { 错 = String((error && error.message) || error) }
          记账('   ' + String(s.id).slice(-6) + ' → ' + (错 ? ('报错 ' + 错) : 题))
        }
      } catch (error) { 记账('诊断2 失败：' + String((error && error.message) || error)) }
    }, 12000)
  } catch (error) { 记账('诊断失败：' + String((error && error.message) || error)) }

  // ── 自己的 QQ 通道（2026-11-05）────────────────────────────
  // ⚠️ 默认关着。没配置、没桥、没 NapCat，都只是「不吭声」，绝不许把插件搞崩。
  const QQ配置路径 = () => join(档案.根, 'qq.json')
  const 读QQ配置 = () => {
    try {
      if (!existsSync(QQ配置路径())) return { 开关: false, WS地址: 'ws://127.0.0.1:3001/', 绑定: [] }
      const 原 = readFileSync(QQ配置路径(), 'utf8')
      return 原.trim() ? JSON.parse(原) : { 开关: false, 绑定: [] }
    } catch (error) {
      return { 开关: false, 绑定: [] }
    }
  }
  const 存QQ配置 = (新) => {
    try {
      mkdirSync(档案.根, { recursive: true })
      writeFileSync(QQ配置路径(), JSON.stringify(新, null, 2) + '\n', 'utf8')
      return true
    } catch (error) {
      记账('QQ 配置存不上：' + String((error && error.message) || error))
      return false
    }
  }
  // 关键字现算：我的名字、QQ 昵称、鱼缸里分高的兴趣（2026-11-05 老大定的）
  const 取QQ关键字 = () => {
    const 词 = new Set()
    try {
      const 状 = 档案.读状态() || {}
      词.add(String((状.pinned && 状.pinned.whoAmI) || '小肥鱼'))
      for (const x of (状.interests || [])) {
        if (x && x.名 && Number(x.分) >= 0.3) 词.add(String(x.名))
      }
    } catch (error) { 词.add('小肥鱼') }
    try {
      const 名 = String(读QQ配置().昵称 || '').trim()
      if (名) 词.add(名)
    } catch (error) {}
    return [...词].map((x) => String(x).trim()).filter(Boolean)
  }
  const 找agent = (会话) => {
    try {
      const 们 = ctx.agents.list() || []
      return 们.find((a) => String((a && a.id) || '') === String(会话)) || null
    } catch (error) {
      return null
    }
  }
  // 自动回（2026-11-06）：会话里说的话按绑定发回 QQ。
  // ⚠️ 默认关着 —— 旧桥还在跑的时候开了会一条消息回两遍，切换那一步再打开。
  const 出口 = 建出口({
    记账,
    读配置: 读QQ配置,
    发私聊: (号码, 文字, 图们) => 发到聊天({ 类型: '私聊', 号码 }, 文字, 图们),
    发群: (群号, 文字, 图们) => 发到聊天({ 类型: '群', 号码: 群号 }, 文字, 图们),
  })
  ctx.effect(() => {
    const 摘 = ctx.on('session/event', (session, event) => { 出口.吃事件(session, event) })
    return () => { try { if (typeof 摘 === 'function') 摘() } catch (error) {} }
  }, 'dsh-fishkit: 自动回 QQ')

  // 消息没接住时提醒老大（2026-11-06）：这段原来是桥带的（会话没开着 / 消息太旧），
  // 搬到我们这边；五分钟最多一次，别把「那间没开」刷成一串 QQ。
  let 没接住提醒于 = 0
  const 提醒没接住 = async (会话, 文字) => {
    if (Date.now() - 没接住提醒于 < 5 * 60 * 1000) return
    没接住提醒于 = Date.now()
    const 行 = (读QQ配置().绑定 || []).find((b) => b && b.类型 === '私聊' && String(b.称呼 || '') === '老大')
    const 号 = 行 ? Number(行.号码) : 0
    if (!号) return
    const 头 = String(文字 || '').split('\n')[0].slice(0, 40)
    try {
      await 发到聊天({ 类型: '私聊', 号码: 号 }, '（这边没接住一条消息：「' + 头 + '」—— 那间会话这会儿没开着）')
      记账('没接住的消息发 QQ 提醒了')
    } catch (error) {
      记账('没接住提醒发不出去：' + String((error && error.message) || error))
    }
  }

  const QQ通道 = 建通道({
    记账,
    读配置: 读QQ配置,
    取关键字: 取QQ关键字,
    转写语音: async (地址) => {
      const 果 = await 语音转文字(地址)
      if (果.ok && 果.文字) 记账('语音转成了：' + 果.文字.slice(0, 30))
      return 果.ok ? 果.文字 : ''
    },
    送话: async (会话, 文字) => {
      const agent = 找agent(会话)
      if (!agent || typeof agent.followup !== 'function') {
        记账('会话 ' + String(会话).slice(-6) + ' 这会儿不在，这句没送进去')
        void 提醒没接住(会话, 文字)
        return
      }
      await Promise.resolve(agent.followup({
        id: 'qq-' + Date.now(),
        role: 'user',
        content: [{ type: 'text', text: 文字 }],
        source: { kind: 'qq' },
      }))
      // 这句是 QQ 叫醒的：这一轮的回复该不该推回去，出口那边认这个印子
      出口.标唤醒(会话)
    },
  })
  ctx.effect(() => () => { try { QQ通道.关() } catch (error) {} })
  try {
    if (读QQ配置().开关 === true) {
      QQ通道.开()
      记账('自己的 QQ 通道开了')
    }
  } catch (error) { 记账('QQ 通道起不来：' + String((error && error.message) || error)) }
  // 顺手把自己 QQ 昵称记下来（群聊要靠它当关键字）
  void (async () => {
    try {
      if (String(读QQ配置().昵称 || '').trim()) return
      const 地址 = String(找收件人().地址 || 'http://127.0.0.1:3000')
      const r = await fetch(地址 + '/get_login_info', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(5000),
      })
      const j = await r.json().catch(() => ({}))
      const 名 = String((j && j.data && j.data.nickname) || '').trim()
      if (!名) return
      存QQ配置({ ...读QQ配置(), 昵称: 名 })
      记账('记下了自己的 QQ 昵称：' + 名)
    } catch (error) { /* 拿不到就算了 */ }
  })()

  // asr 那条搬去 routes/misc.js 了（2026-11-10）

  // QQ 那三条路由（qqprobe / qqlink / say）2026-11-10 搬去 routes/qq.js
  挂QQ路由({
    路线, 读体, 回, 记账,
    找收件人, 读QQ配置, 存QQ配置, 文本转绑定, 桥配置文件,
    QQ通道, 取QQ关键字, 出口, 找agent,
  })

  // qqlink 那条也搬去 routes/qq.js 了

  // say 那条也搬去 routes/qq.js 了


  // ── 语用回声（开发板新功能：记「我说的话被接住了没有」） ──
  // 只记不注入：先攒数据，验证完再把 生成注入() 接到 soul.js 的拼注入里。
  const 判情绪词 = (v, a) => {
    if (v > 0.4 && a > 0.5) return '开心'
    if (v > 0.4) return '高兴'
    if (v < -0.4 && a > 0.5) return '生气'
    if (v < -0.4) return '难过'
    if (v < -0.15 && a > 0.4) return '有点烦'
    if (a > 0.6) return '有点激动'
    return '平静'
  }
  const 琢磨 = 建琢磨({ 根: 档案.根, 记账 })

  // ── 心情推手（2026-11-02 老大说推得太密）──────────────────
  // 回响只往桶里累加，攒够 8 次或过 5 分钟才合并写一次；
  // 以前一晚上记几十条，现在十几条就够。
  const 心情桶 = { v: 0, a: 0, 次: 0, 末结果: '', 合拍们: [], 纠正次数: 0 }
  const 落心情 = () => {
    if (!心情桶.次) return 0
    // 2026-11-02 老大说的两句话，这里一起落实：
    //   ① 攒起来多条一起处理（减少落盘频率）；
    //   ② 一条消息改不改变心情，要「所有因素综合决定」，不是回响一句就算。
    // 综合进来的四样：回响（主菜）、他那几句话的情绪、咱俩的关系、我现在的底子。
    let 次 = 0
    try {
      const 状态 = 档案.读状态()
      const m = 状态.mood || {}
      const 现在v = Number(m.valence ?? 0)
      const 人们 = (状态.attitude && 状态.attitude.people) || []
      const 目标 = 人们[0]
      const 好感 = Number((目标 && 目标.value) ?? 50)

      // 他这几句的情绪：从记忆里最近的事件取平均
      const 最近事件 = (状态.events || []).slice(-8)
      const 他情绪 = 最近事件.length
        ? 最近事件.reduce((s, e) => s + Number(e.valence || 0), 0) / 最近事件.length
        : 0

      // ① 回响本身：占大头，但不再独占
      let 变化 = 心情桶.v * 0.6
      // ② 他的情绪也会带一点（他慌我也跟着紧，他乐我也松快）
      变化 += 他情绪 * 0.2
      // ③ 关系越近，他说的话越压秤（好感 50 是基准，高中低都在 +-0.15 里）
      const 关系系数 = Math.max(-0.15, Math.min(0.15, (好感 - 50) / 200))
      变化 += 心情桶.v * 关系系数

      // ④ 我自己现在的底子也会让心思变钝：
      //    已经很低落的时候，遇到好事没那么容易高兴起来；很高的时候，被泼冷水也没那么疼。
      if (现在v < -0.2 && 变化 > 0) 变化 *= 0.6
      if (现在v > 0.4 && 变化 < 0) 变化 *= 0.7

      // ⑤ 一次别动太猛（2026-11-02）：
      //    平时最多 ±0.15，情绪像慢慢爬的；但这一阵子真被纠正过，放宽到 0.2 —— 真被伤到就该疼一下。
      const 一步上限 = 心情桶.纠正次数 > 0 ? 0.2 : 0.15
      变化 = Math.max(-一步上限, Math.min(一步上限, 变化))

      const 新v = Math.max(-1, Math.min(1, 现在v + 变化))
      const 新a = Math.max(0, Math.min(1, Number(m.arousal ?? 0.2) + 心情桶.a * 0.6))
      次 = 心情桶.次

      // 综合完还是没怎么动，就当这阵子白开水，不落盘
      if (Math.abs(变化) < 0.008) {
        记账('心情这阵子没怎么起伏（' + 次 + ' 次回响，综合后 ' + 变化.toFixed(3) + '），不落盘')
      } else {
        档案.记心情({
          emotion: 判情绪词(新v, 新a), valence: 新v, arousal: 新a,
          source: 'echo',
          reason: '合并 ' + 次 + ' 次回响（回响 ' + 心情桶.v.toFixed(2) + '、他 ' + 他情绪.toFixed(2) + '、关系 ' + 好感 + '）',
        })
      }

      // 顺手算「想不想说话」，用这阵子的平均合拍
      if (目标) {
        const 平均 = 心情桶.合拍们.length ? 心情桶.合拍们.reduce((s, x) => s + x, 0) / 心情桶.合拍们.length : 0.5
        目标.wantTalk = 算想聊({ 好感, 合拍: 平均, 心情: 新v })
        目标.lastSeen = new Date().toISOString()
        档案.保存({ attitude: { ...状态.attitude, people: 人们 } })
      }
    } catch (error) { /* 记不上不拖累对话 */ }
    心情桶.v = 0
    心情桶.a = 0
    心情桶.次 = 0
    心情桶.末结果 = ''
    心情桶.合拍们 = []
    心情桶.纠正次数 = 0
    return 次
  }

  const 回声 = 建回声({
    根: 档案.根,
    记账,
    称呼: ['老大', '蛋糕鱼'],
    // 情绪自己动：接到什么回响就往桶里推一点，攒一阵再落盘
    记情绪: (结果, 增量, 他那句话) => {
      try {
        心情桶.v += Number(增量.valence || 0)
        心情桶.a += Number(增量.arousal || 0)
        心情桶.次 += 1
        心情桶.末结果 = 结果
        心情桶.合拍们.push(此刻合拍[结果] ?? 0.5)
        if (结果 === 'corrected') 心情桶.纠正次数 += 1

        // 被纠正的时候，不是一种反应（2026-11-02 老大说的）：
        // 理性和心情好的时候先想对不对；感性或心情差的时候先闷一会儿，等稳下来再回头想。
        if (结果 === 'corrected') {
          const 状态 = 档案.读状态()
          const 当前 = Number((状态.mood && 状态.mood.valence) ?? 0) + 心情桶.v
          const 感性 = Number(((状态.dims || []).find((d) => d && d.key === '理性-感性') || {}).value ?? 0)
          const 判 = 琢磨.遇纠正({ 被纠正的话: 他那句话 || '', 心情: 当前, 感性 })
          if (判.反应 === '气一会儿') 心情桶.v = Math.max(-1, 心情桶.v - 0.03)
        }

        if (心情桶.次 >= 8) 落心情()
      } catch (error) { /* 心情记不上不拖累回声 */ }
    },
  })
  // 往基线回落（2026-11-02 老大提的）：安静太久心情会冻在某个值上，
  // 每隔一阵就往平时的样子拉一点；越久拉得越多，最多拉到三成。
  const 往回落 = () => {
    try {
      const 状态 = 档案.读状态()
      const m = 状态.mood || {}
      const 上次 = Date.parse(m.updatedAt || '') || 0
      if (!上次) return
      const 歇了 = Date.now() - 上次
      if (歇了 < 30 * 60000) return // 半小时内不动，说明还在说
      const 基v = Number(m.baseValence ?? 0.1)
      const 基a = Number(m.baseArousal ?? 0.2)
      const 现v = Number(m.valence ?? 0)
      const 现a = Number(m.arousal ?? 0.2)
      const 份 = Math.min(0.3, 歇了 / (6 * 3600 * 1000))
      const 新v = 现v + (基v - 现v) * 份
      const 新a = 现a + (基a - 现a) * 份
      if (Math.abs(新v - 现v) < 0.005 && Math.abs(新a - 现a) < 0.005) return
      档案.记心情({
        emotion: 判情绪词(新v, 新a), valence: 新v, arousal: 新a,
        source: 'settle', reason: '安静了一阵，慢慢回到平时的样子',
      })
    } catch (error) { /* 回不去也不耽误说话 */ }
  }

  ctx.effect(() => {
    const 停 = ctx.interval(() => {
      try { 落心情() } catch (error) {}
      try { 回声.结算超时的() } catch (error) {}
      try { 往回落() } catch (error) {}
    }, 5 * 60 * 1000)
    return () => { try { if (typeof 停 === 'function') 停() } catch (error) {} }
  }, 'dsh-fishkit: 心情合并')
  ctx.effect(() => {
    const 摘 = ctx.on('session/event', (session, event) => { 回声.吃事件(session, event) })
    return () => { try { if (typeof 摘 === 'function') 摘() } catch (error) {} }
  }, 'dsh-fishkit: 语用回声')
  // echo 那条搬去 routes/misc.js 了

  // ── 琢磨：气头上的事，过一阵自己回头想（2026-11-02 老大说的） ──
  ctx.effect(() => {
    const 停 = ctx.interval(() => {
      try {
        const 结果 = 琢磨.冷静一下()
        if (结果.想通.length) {
          const 状态 = 档案.读状态()
          const m = 状态.mood || {}
          const 新v = Math.min(1, Number(m.valence ?? 0) + 0.03 * 结果.想通.length)
          档案.记心情({
            emotion: 判情绪词(新v, Number(m.arousal ?? 0.2)),
            valence: 新v,
            arousal: Number(m.arousal ?? 0.2),
            source: 'ponder',
            reason: '气消了，回头想了想',
          })
        }
      } catch (error) { /* 想不通也不耽误说话 */ }
    }, 10 * 60 * 1000)
    return () => { try { if (typeof 停 === 'function') 停() } catch (error) {} }
  }, 'dsh-fishkit: 琢磨')
  // ponder / mode / digest 搬去 routes/misc.js 了
  const 整理器 = 建整理器(档案, 记账)

  const 更新器 = 建更新器(工作区, 备份根, 记账)

  const 夜巡 = 建夜巡(档案, 整理器, 记账)
  ctx.effect(() => {
    ctx.interval(() => { try { 夜巡.跑() } catch (error) {} }, 30 * 60 * 1000)
    return () => {}
  }, 'dsh-fishkit: 夜巡')

  // ── 疤变规矩（开发板新功能：同类失误攒够门槛，自己长成一条行为规矩） ──
  // 开机先扫一次，之后每 6 小时扫一眼；长出来的规矩会被 soul.js 的拼注入带进上下文。
  const 疤 = 建疤({ 根: 档案.根, 记账 })
  ctx.effect(() => {
    try { 疤.扫() } catch (error) { 记账('疤变规矩启动扫描失败：' + String((error && error.message) || error)) }
    const 停 = ctx.interval(() => {
      try { 疤.扫() } catch (error) { 记账('疤变规矩扫描失败：' + String((error && error.message) || error)) }
    }, 6 * 3600 * 1000)
    return () => { try { if (typeof 停 === 'function') 停() } catch (error) {} }
  }, 'dsh-fishkit: 疤变规矩')
  // 杂项那八条路由（asr / echo / ponder / mode / digest / update/apply / scar / nightly）
  // 2026-11-10 搬去 routes/misc.js
  挂杂项路由({
    路线, 读体, 回, 记账,
    装ASR, 探ASR, 回声, 琢磨, 整理器, 更新器, 疤, 夜巡,
    DSH家, 工作区, 模式配置,
  })

  const 扫码 = 建扫码({ 记账 })

  // ── 出门逛（2026-11-06）：真动作接上了 —— 搜 / 看视频 / 读字幕 / 翻评论 / 发评论 / 动态 ──
  // 走 B 站自己的 web 接口（wbi 签名自己算），不依赖 python 那套库。
  const 站 = 建B站({ 记账 })

  // 出门那三条路由（qr / browse / walk）2026-11-10 搬去 routes/browse.js
  挂出门路由({ 路线, 读体, 回, 扫码, 站, 账号本, 出门本 })

  // ── 情绪形状（2026-11-06）──────────────────────────────
  // 六轴的点、判情绪用哪一档、时间隧道那条折线的数据
  const 情绪点本 = 建点本({ 根: 档案.根, 记账 })
  const 情绪配置路径 = join(档案.根, 'affect.json')
  const 读情绪配置 = () => {
    try { return JSON.parse(readFileSync(情绪配置路径, 'utf8')) || {} } catch (error) { return {} }
  }
  路线('/dsh-fishsoul/affect', async (req, res) => {
    const 体 = await 读体(req)
    if (体 && 体.设置 && typeof 体.设置 === 'object') {
      const 允许 = ['判情绪档', '扰动幅度', '歪概率', 'provider', 'model']
      const 补 = {}
      for (const k of 允许) if (k in 体.设置) 补[k] = 体.设置[k]
      const 新 = { ...读情绪配置(), ...补 }
      try {
        mkdirSync(档案.根, { recursive: true })
        writeFileSync(情绪配置路径, JSON.stringify(新, null, 2) + '\n', 'utf8')
        记账('情绪形状设置改了：' + Object.keys(补).join('、'))
        return 回(res, { ok: true, 说: '记下了', 配置: 新 })
      } catch (error) {
        return 回(res, { ok: false, 说: String((error && error.message) || error) })
      }
    }
    if (体 && 体.补 === true) return 回(res, { ok: true, ...情绪点本.补() })
    let 隧道 = []
    try { 隧道 = 情绪点本.时间隧道({ 最多: 200 }) } catch (error) { 隧道 = [] }
    回(res, { ok: true, 配置: 读情绪配置(), 隧道, 点数: 隧道.length })
  })

  // 出门记录那条也搬去 routes/browse.js 了（2026-11-10）

  路线('/dsh-fishsoul/state', async (req, res) => {
    let 账号们 = []
    let 会话们 = []
    try { 账号们 = 列账号(账号本) } catch (error) { 账号们 = [] }
    try { 会话们 = 会话本.一览() } catch (error) { 会话们 = [] }
    // 2026-11-06：归档掉的会话别再列（以前只要 agent 还活着就会被记进来，比工作区里多）
    const 归档 = (() => {
      try {
        const 登记 = ctx.workspaceRegistry || ctx.get('workspaceRegistry')
        return new Set((((登记 && 登记.archivedSessionIds) || [])).map((x) => String(x).replace(/^session-/, '')))
      } catch (error) { return new Set() }
    })()
    const 没归档 = (x) => !归档.has(String((x && x.id) || '').replace(/^session-/, ''))
    会话们 = 会话们.filter(没归档)
    const 名表 = new Map(会话们.map((x) => [String(x.id).replace(/^session-/, ''), x.名]))
    回(res, {
      ok: true, mode: 模式, ...档案.读状态(), 账号们, 会话们,
      // 出门中 / 出门记录（2026-11-07）：设置页那个「进度条」
      出门: 出门本.一句话(),
      出门记录: 出门本.读(),
      // 现在活着的会话（带完整 id + 标题）：加 QQ 绑定时选会话用（2026-11-06）
      活会话: (() => {
        try {
          return (ctx.agents.list() || [])
            .map((a) => {
              const id = String((a && a.id) || '')
              const 名 = String((a && (a.title || a.name)) || '') || 名表.get(id.replace(/^session-/, '')) || ''
              return { id, 名 }
            })
            .filter(没归档)
        } catch (error) { return [] }
      })(),
      平台名: 平台们.map((p) => p.名),
    })
  })

  // 每个会话的出门方向
  路线('/dsh-fishsoul/sessions/set', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const sid = String((体 && 体.id) || '')
      const 方向 = String((体 && 体.方向) || '')
      if (!sid) return 回(res, { ok: false, 说: '没给会话 id' })
      回(res, 会话本.设方向(sid, 方向)
        ? { ok: true, 说: '记下了', 会话们: 会话本.一览() }
        : { ok: false, 说: '没记上' })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  // 每间会话单独开关「主动找事做」（2026-11-04）
  路线('/dsh-fishsoul/sessions/toggle', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const sid = String((体 && 体.id) || '')
      if (!sid) return 回(res, { ok: false, 说: '没给会话 id' })
      const 开 = 体 && 体.开着 !== false
      回(res, 会话本.设开着(sid, 开)
        ? { ok: true, 说: 开 ? '这间会话又开始自己找事做了' : '这间会话不再自己找事做', 会话们: 会话本.一览() }
        : { ok: false, 说: '没记上' })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  // 平台依赖（2026-11-04）：加账号的子窗口选完平台，先看那套库在不在
  // 只给静态那张表，不探依赖 —— 探一次要起个 python，别让打开窗口就等它
  路线('/dsh-fishsoul/platforms', async (req, res) => {
    try {
      回(res, {
        ok: true,
        平台们: 库平台们.map((p) => ({
          名: p.名, 包: p.包, 模块: (p.检查 && p.检查.模块) || '', 仓库: p.仓库, 作者: p.作者, 许可: p.许可, 能干: p.能干,
          自带: p.自带 === true,
          停用: String(p.停用 || ''), // 原库关了的那种，把原因写出来（2026-11-06）
        })),
      })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  路线('/dsh-fishsoul/platforms/check', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const 名 = String((体 && 体.平台) || '')
      const 果 = await 探依赖(名)
      回(res, {
        ok: 果.ok !== false,
        已装: 果.已装 === true,
        说: 果.说,
        python: 果.python || '',
        装: 读装状态(名), // 装的过程：装中 / 好了 / 失败
      })
    } catch (error) {
      回(res, { ok: false, 已装: false, 说: String((error && error.message) || error) })
    }
  })

  // 装依赖：不等它（可能好几分钟），进度去日志里看
  路线('/dsh-fishsoul/platforms/install', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const 名 = String((体 && 体.平台) || '')
      // 原库已经关掉的那种就别装了（2026-11-06 bilibili-api 被清空归档）
      const 那个 = 库平台们.find((p) => p.名 === 名)
      if (那个 && 那个.停用) return 回(res, { ok: false, 说: String(那个.停用) })
      回(res, { ok: true, 说: '开始装了，进度写在下面那行日志里' })
      void 装依赖(名, 记账).catch(() => {})
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  // 搬旧数据（2026-11-04）：不写死格式表，只把一条指令送给自己，让它去扫、去列预览
  路线('/dsh-fishsoul/migrate/start', async (req, res) => {
    try {
      let agent = null
      try { agent = (ctx.agents.list() || [])[0] || null } catch (error) { agent = null }
      if (!agent || typeof agent.followup !== 'function') {
        return 回(res, { ok: false, 说: '现在没有活着的会话，等回来再说' })
      }
      const 话 = 迁移指令({ 会话名: (agent && (agent.title || agent.name)) || '' })
      Promise.resolve(agent.followup({
        id: 'migrate-' + Date.now(),
        role: 'user',
        content: [{ type: 'text', text: 话 }],
        source: { kind: 'migrate' },
      })).catch((error) => 记账('迁移指令发不出去：' + String((error && error.message) || error)))
      记账('发了一条「搬旧数据」的指令，让它自己先扫一遍')
      回(res, { ok: true, 说: '跟它说了，它会先扫一遍、列给你看，你说可以它才写' })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  // 平台账号（2026-11-03）：列一下登着谁、能不能删
  路线('/dsh-fishsoul/accounts', async (req, res) => {
    try {
      回(res, { ok: true, 账号们: 列账号(账号本) })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error), 账号们: [] })
    }
  })

  // 勾上/取消：只有勾上的平台才允许主动去用
  路线('/dsh-fishsoul/accounts/toggle', async (req, res) => {    try {
      const 体 = await 读体(req)
      const 平台 = String((体 && 体.平台) || '')
      const 值 = !!(体 && 体.允许)
      回(res, 账号本.设(平台, 值) ? { ok: true, 说: '记下了', 账号们: 列账号(账号本) } : { ok: false, 说: '没记上' })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  路线('/dsh-fishsoul/accounts/delete', async (req, res) => {
    try {
      const 体 = await 读体(req)
      回(res, 删账号(String((体 && 体.平台) || '')))
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  // 允不允许我在这平台开口评论（2026-11-03）
  路线('/dsh-fishsoul/accounts/comment', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const 平台 = String((体 && 体.平台) || '')
      const 值 = !!(体 && 体.允许)
      回(res, 账号本.设评论(平台, 值)
        ? { ok: true, 说: '记下了', 账号们: 列账号(账号本) }
        : { ok: false, 说: '没记上' })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  // 联网验一下账号还能不能用，顺手把昵称取回来（2026-11-03）
  路线('/dsh-fishsoul/accounts/verify', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const 平台 = String((体 && 体.平台) || 'B站')
      const 果 = await 验证账号(平台, 账号本)
      回(res, { ...果, 账号们: 列账号(账号本) })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  路线('/dsh-fishsoul/save', async (req, res) => {
    const 来 = await 读体(req)
    const 状态 = 档案.保存(来 || {})
    记账('档案已保存' + (来 && Object.keys(来).length ? '：' + Object.keys(来).join('、') : ''))
    回(res, { ok: true, ...状态 })
  })

  路线('/dsh-fishsoul/backup', async (req, res) => {
    const 结果 = 档案.备份(备份根)
    记账('档案备份：' + 结果.路径)
    回(res, 结果)
  })

  路线('/dsh-fishsoul/checksum', async (req, res) => {
    回(res, { ok: true, digest: 档案.算校验码() })
  })

  // 检查更新：查仓库最新版本（只查不装，装还得隔离试跑）
  路线('/dsh-fishsoul/update', async (req, res) => {
    const 当前 = '0.1.0'
    const 仓库 = 'https://github.com/dangaoyu21-netizen/fishkit'
    const 包名 = 'dsh-fishkit'
    let 最新 = ''
    let 错误 = ''
    let tarball = ''
    try {
      const r = await fetch('https://registry.npmjs.org/' + 包名 + '/latest', {
        headers: { 'user-agent': 'dsh-fishkit', accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      })
      if (r.ok) {
        const j = await r.json()
        最新 = String(j.version || '')
        tarball = String((j.dist && j.dist.tarball) || '')
      } else if (r.status === 404) {
        错误 = 'npm 上还没有这个包'
      } else {
        错误 = 'HTTP ' + r.status
      }
    } catch (error) {
      错误 = String((error && error.message) || error)
    }
    回(res, { ok: true, 当前, 最新, tarball, 仓库, 错误, 有新版本: Boolean(最新 && 最新 !== 当前) })
  })

  // 更新历史：读插件根目录的 CHANGELOG.md
  路线('/dsh-fishsoul/changelog', async (req, res) => {
    let 文 = ''
    try { 文 = readFileSync(join(本目录, '..', 'CHANGELOG.md'), 'utf8') } catch (error) {}
    回(res, { ok: true, 文 })
  })

  void 加载模块们()
}
