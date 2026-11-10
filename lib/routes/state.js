// 状态与存档类路由（2026-11-10 从 index.js 拆出来的第四批）
//
// 设置页要的那一大坨状态、存档案、备份、校验码、查更新、更新历史，六条。

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function 挂状态路由(依赖) {
  const {
    路线, 读体, 回, 记账, ctx,
    档案, 账号本, 会话本, 出门本, 平台们, 列账号,
    模式, 备份根, 本目录,
  } = 依赖

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
}
