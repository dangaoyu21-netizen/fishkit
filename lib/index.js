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
  const 回声 = 建回声({
    根: 档案.根,
    记账,
    称呼: ['老大', '蛋糕鱼'],
    // 情绪自己动：接到什么回响就动一点，不再由我挑着记
    记情绪: (结果, 增量, 他那句话) => {
      try {
        const 状态 = 档案.读状态()
        const m = 状态.mood || {}
        const 新v = Math.max(-1, Math.min(1, Number(m.valence ?? 0) + Number(增量.valence || 0)))
        const 新a = Math.max(0, Math.min(1, Number(m.arousal ?? 0.2) + Number(增量.arousal || 0)))
        let 落到 = 新v

        // 被纠正的时候，不是一种反应（2026-11-02 老大说的）：
        // 理性和心情好的时候先想对不对；感性或心情差的时候先闷一会儿，等稳下来再回头想。
        if (结果 === 'corrected') {
          const 感性 = Number(((状态.dims || []).find((d) => d && d.key === '理性-感性') || {}).value ?? 0)
          const 判 = 琢磨.遇纠正({ 被纠正的话: 他那句话 || '', 心情: 新v, 感性 })
          if (判.反应 === '气一会儿') {
            落到 = Math.max(-1, 新v - 0.03) // 气头上再多掉一点
          }
        }

        档案.记心情({ emotion: 判情绪词(落到, 新a), valence: 落到, arousal: 新a, source: 'echo', reason: '回响：' + 结果 })

        // 顺便算「此刻想不想跟他说话」：好感是底子，合拍和心情是眼下
        const 人们 = (状态.attitude && 状态.attitude.people) || []
        if (人们.length && 人们[0]) {
          const 目标 = 人们[0]
          目标.wantTalk = 算想聊({
            好感: Number(目标.value || 50),
            合拍: 此刻合拍[结果] ?? 0.5,
            心情: 落到,
          })
          目标.lastSeen = new Date().toISOString()
          档案.保存({ attitude: { ...状态.attitude, people: 人们 } })
        }
      } catch (error) { /* 心情记不上不拖累回声 */ }
    },
  })
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
