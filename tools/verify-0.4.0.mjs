// 0.4.0 重启后验收（2026-11-06）
// 跑法：node plugins/dsh-fishkit/tools/verify-0.4.0.mjs
//
// 只读、只发一次 B 站搜索，不改任何东西。用来确认重启后新代码真的挂上了。

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const 基 = 'http://127.0.0.1:43120'
const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
let 挂 = 0
const 查 = async (名, fn) => {
  try {
    const 果 = await fn()
    过 += 1
    说('  ✓ ' + 名 + (果 ? ' —— ' + 果 : ''))
  } catch (error) {
    挂 += 1
    说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error))
  }
}

const 取 = async (路径, 体) => {
  const r = await fetch(基 + 路径, 体
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(体) }
    : {})
  const t = await r.text()
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 80))
  try { return JSON.parse(t) } catch (error) { throw new Error('不是 JSON：' + t.slice(0, 80)) }
}

说('== 插件活着吗 ==')
await 查('工具箱在', async () => {
  const d = await 取('/dsh-fishkit/ping')
  if (!d.ok) throw new Error('ping 不对')
  return '模块 ' + d.模块数 + ' 个'
})
await 查('新路由 /dsh-fishsoul/affect 在（= 新代码挂上了）', async () => {
  const d = await 取('/dsh-fishsoul/affect')
  if (!d.ok) throw new Error(d.说 || '没 ok')
  return '情绪点 ' + d.点数 + ' 个'
})
await 查('时间隧道有数据', async () => {
  const d = await 取('/dsh-fishsoul/affect')
  if (!Array.isArray(d.隧道) || !d.隧道.length) throw new Error('隧道是空的')
  return d.隧道.length + ' 个点'
})

说('== 档案和绑定 ==')
await 查('状态读得出来', async () => {
  const d = await 取('/dsh-fishsoul/state')
  if (!d.ok) throw new Error('没 ok')
  return '心情 ' + ((d.mood && d.mood.emotion) || '?')
})
await 查('QQ 绑定里老大指向本会话', async () => {
  const d = await 取('/dsh-fishsoul/qqlink')
  const 行 = ((d.配置 && d.配置.绑定) || []).find((b) => String(b.称呼) === '老大')
  if (!行) throw new Error('没有老大那条')
  return 行.会话
})
await 查('自动回这会儿是关着的（切桥前必须这样）', async () => {
  const d = await 取('/dsh-fishsoul/qqlink')
  if (d.配置 && d.配置.自动回 === true) throw new Error('自动回已经开了，先别开')
  return '关着'
})

说('== 出门逛 ==')
await 查('搜一下真能搜到', async () => {
  const d = await 取('/dsh-fishsoul/browse', { 动作: '搜', 参数: { 关键词: '榫卯', 条数: 1 } })
  if (!d.ok) throw new Error(d.说 || '没 ok')
  if (!d.们 || !d.们.length) throw new Error('一条都没搜到')
  return d.们[0].标题
})

说('== 会话标题 ==')
await 查('当前会话的标题读得出来', async () => {
  const 目录 = join(homedir(), '.dsh', 'storages', 'session_projcache', 'sessions')
  if (!existsSync(目录)) throw new Error('没有缓存目录')
  const 文件们 = readdirSync(目录).filter((f) => f.endsWith('.json'))
    .map((f) => ({ f, t: statSync(join(目录, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  for (const { f } of 文件们.slice(0, 3)) {
    try {
      const j = JSON.parse(readFileSync(join(目录, f), 'utf8'))
      const 题 = j && j.record && j.record.rows && j.record.rows.title && j.record.rows.title.val
      if (题) return '最近一间：' + 题
    } catch (error) { /* 继续 */ }
  }
  throw new Error('最近三份缓存里都没标题')
})

说('')
说(挂 ? ('有 ' + 挂 + ' 项没过') : ('全过了：' + 过 + ' 项'))
process.exitCode = 挂 ? 1 : 0
