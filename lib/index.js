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

export const name = 'fishkit'
export const inject = ['webServer', 'timer', 'agents', 'systemPrompt']

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
  const 备份根 = join(工作区, '.fishsoul-backup')
  try { 档案.初始化() } catch (error) { 记账('档案初始化失败：' + String((error && error.message) || error)) }
  const 排重启 = { 待重启: false }
  ctx.effect(() => 挂人格(ctx, 档案, 记账, 排重启), 'dsh-fishkit: 人格注入')

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
  路线('/dsh-fishsoul/echo', async (req, res) => {
    回(res, { ok: true, 形状: 回声.汇总(), 注入: 回声.生成注入() })
  })

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
  路线('/dsh-fishsoul/ponder', async (req, res) => {
    回(res, { ok: true, 还气着: 琢磨.还有气吗(), 账单: 琢磨.读() })
  })

  路线('/dsh-fishsoul/restart-after-turn', async (req, res) => {
    排重启.待重启 = true
    记账('排了一个重启：这轮结束就重启')
    回(res, { ok: true, 说: '排上了，这一轮结束就重启 DSH' })
  })

  路线('/dsh-fishsoul/mode', async (req, res) => {
    const 来 = await 读体(req)
    const 新 = String((来 && 来.mode) || '') === 'shared' ? 'shared' : 'independent'
    mkdirSync(DSH家, { recursive: true })
    // 第一次切共享：把当前工作区档案带过去，别让新档案从空白开始
    const 共享根 = join(DSH家, 'fishsoul-shared')
    if (新 === 'shared' && !existsSync(join(共享根, 'manifest.json'))) {
      try { cpSync(join(工作区, '.fishsoul'), 共享根, { recursive: true }) } catch (error) { 记账('共享档案初始化失败：' + String((error && error.message) || error)) }
    }
    writeFileSync(模式配置, JSON.stringify({ mode: 新 }, null, 2) + '\n', 'utf8')
    回(res, { ok: true, mode: 新, 说: '已切换成' + (新 === 'shared' ? '共享' : '独立') + '，重启 DSH 后生效' })
  })

  const 整理器 = 建整理器(档案, 记账)
  路线('/dsh-fishsoul/digest', async (req, res) => {
    const 来 = await 读体(req)
    回(res, 整理器.整理(来 || {}))
  })

  const 更新器 = 建更新器(工作区, 备份根, 记账)
  路线('/dsh-fishsoul/update/apply', async (req, res) => {
    try {
      回(res, await 更新器.应用())
    } catch (error) {
      回(res, { ok: false, 说: '更新失败：' + String((error && error.message) || error) })
    }
  })

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
  路线('/dsh-fishsoul/scar', async (req, res) => {
    回(res, 疤.扫({ 写回: false }))
  })

  路线('/dsh-fishsoul/nightly', async (req, res) => {
    回(res, 夜巡.跑({ 强制: true }))
  })

  路线('/dsh-fishsoul/state', async (req, res) => {
    回(res, { ok: true, mode: 模式, ...档案.读状态() })
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
