// 小肥鱼 · 往 QQ 说一句（2026-11-05）
//
// 不碰桥那个插件 —— 那是别人写的，改人家的代码不合适，一升级也没了。
// 这里直接找 NapCat 的发消息口：地址从桥的配置里借一眼（它知道 NapCat 在哪），
// 借不到就退回默认的 127.0.0.1:3000。
//
// 只发私聊，只发给绑定里的第一个人（老大），绝不往别人那儿发。
// 发不出去就老实说原因，别装作发了。

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const 家 = process.env.DSH_HOME || join(homedir(), '.dsh')
export const 桥配置文件 = join(家, 'qq-bridge-config.json')

const 读json = (p) => {
  try {
    if (!existsSync(p)) return null
    const 原 = readFileSync(p, 'utf8')
    return 原.trim() ? JSON.parse(原) : null
  } catch (error) {
    return null
  }
}

/** 从桥的配置里认一下 NapCat 在哪、发给谁 */
export function 找收件人() {
  const 桥 = 读json(桥配置文件) || {}
  const 私聊们 = (桥.绑定 || []).filter((b) => b && b.类型 === '私聊' && b.号码)
  const 老大 = 私聊们.find((b) => String(b.称呼 || '') === '老大') || 私聊们[0] || null
  const 地址 = String(桥.NapCat || 'http://127.0.0.1:3000').replace(/\/+$/, '')
  return {
    地址,
    号码: 老大 ? Number(老大.号码) : 0,
    称呼: 老大 ? String(老大.称呼 || '') : '',
  }
}

/** 一段最多多少字（超了就拆成几条发） */
export const 段上限 = 300

/**
 * 两段之间歇多久 —— 沿用桥那套（2026-10-27 定的）：
 * 按字数算，短句快、长句慢；代码块整块发完等 10 秒，链接等 3 秒。
 * 抖动还是 ±25%，但短句那个绝对值太小，垫一个「至少三百毫秒」的幅度；
 * 再压个 400 毫秒下限，再抖也不会连着发。
 */
export function 段间停顿(段) {
  const 文 = String(段 || '')
  const 是代码 = /```/.test(文)
  const 是链接 = /^\s*(https?:\/\/|www\.)/i.test(文) || /https?:\/\/\S+/i.test(文)
  const 基准 = 是代码 ? 10000 : (是链接 ? 3000 : Math.max(600, Math.min(60000, 文.length * 300)))
  const 幅度 = Math.max(基准 * 0.25, 300)
  const 抖 = (Math.random() * 2 - 1) * 幅度
  return Math.round(Math.max(400, 基准 + 抖))
}

/**
 * 把一段话拆成几条。
 *
 * 2026-11-09 老大要的：**多段就适当分开几条发**，别全挤成一条。
 * 所以先按「空行」切自然段，一个自然段一条；某一段自己还超长，再按行凑、凑不下硬切。
 * 只有一段（没空行）又没超长的，照旧原样一条发。
 */
export function 拆段(文本, 上限 = 段上限) {
  const 净 = String(文本 || '').trim()
  if (!净) return []

  /** 单段太长时：先按换行凑，凑不下再硬切 */
  const 切长段 = (段) => {
    const 出 = []
    const 行们 = 段.split('\n')
    const 组们 = []
    let 当前 = ''
    for (const 行 of 行们) {
      if (!当前) { 当前 = 行; continue }
      if ((当前 + '\n' + 行).length <= 上限) 当前 += '\n' + 行
      else { 组们.push(当前); 当前 = 行 }
    }
    if (当前) 组们.push(当前)
    for (const 组 of 组们) {
      if (组.length <= 上限) { 出.push(组); continue }
      for (let i = 0; i < 组.length; i += 上限) 出.push(组.slice(i, i + 上限))
    }
    return 出
  }

  // 先按空行切成自然段（\n + 若干空白 + \n）
  const 自然段们 = 净.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
  if (自然段们.length <= 1) {
    // 只有一段：太短就原样，太长才切
    return 净.length <= 上限 ? [净] : 切长段(净)
  }
  const 结果 = []
  for (const 段 of 自然段们) {
    if (段.length <= 上限) 结果.push(段)
    else 结果.push(...切长段(段))
  }
  return 结果
}

const 歇一下 = (毫秒) => new Promise((r) => setTimeout(r, 毫秒))

/**
 * 发一句到 QQ 私聊（长了会自动拆成几条）。
 * @param {string} 文本
 * @param {object} 参数 { 号码 } —— 不给就发给绑定里的老大
 * @returns {Promise<{ok:boolean, 说:string}>}
 */
export async function 发一句(文本, 参数 = {}) {
  const 话 = String(文本 || '').trim()
  if (!话) return { ok: false, 说: '空的就不发了' }
  const 谁 = 找收件人()
  const 号 = Number((参数 && 参数.号码) || 谁.号码 || 0)
  if (!号) return { ok: false, 说: '不知道发给谁（桥的配置里没有私聊绑定）' }
  const 段们 = 拆段(话)
  let 过 = 0
  let 最后 = ''
  for (let i = 0; i < 段们.length; i++) {
    try {
      const r = await fetch(谁.地址 + '/send_private_msg', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: 号, message: [{ type: 'text', data: { text: 段们[i] } }] }),
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) { 最后 = 'NapCat 回了个 ' + r.status; break }
      const j = await r.json().catch(() => ({}))
      if (!j || j.status !== 'ok') { 最后 = '没发出去：' + JSON.stringify(j).slice(0, 120); break }
      过 += 1
    } catch (error) {
      最后 = '连不上 NapCat：' + String((error && error.message) || error)
      break
    }
    if (i < 段们.length - 1) await 歇一下(段间停顿(段们[i]))
  }
  if (过 === 段们.length) {
    return { ok: true, 说: 段们.length > 1 ? ('发出去了（拆成 ' + 段们.length + ' 条）') : '发出去了' }
  }
  return { ok: false, 说: (过 ? '发了一半：' : '') + (最后 || '没发出去') }
}

/** 一张本地图 / 一张附件块 → base64（读不到就返回空，别把整句卡住） */
export function 读图(x) {
  try {
    const 路径 = x && x.kind === 'path' ? x.value : (x && x.attachment && x.attachment.path ? x.attachment.path : '')
    if (!路径 || !existsSync(路径)) return ''
    return readFileSync(路径).toString('base64')
  } catch (error) {
    return ''
  }
}

/** OneBot 的图片段：base64 直接塞，不依赖 QQ 那边能不能访问本地文件 */
export function 图片段(base64) {
  return { type: 'image', data: { file: 'base64://' + String(base64) } }
}

/**
 * 发到任意一个聊天（私聊 / 群）—— 自动回 QQ 用这个，比 发一句 多一个「群」。
 * @param {{类型?:string, 号码:number|string}} 谁
 * @param {string} 文本
 * @param {Array<{kind:'path'|'url', value:string}|object>} 图们
 * @returns {Promise<{ok:boolean, 说:string}>}
 */
export async function 发到聊天(谁, 文本, 图们 = []) {
  const 是群 = Boolean(谁 && 谁.类型 === '群')
  const 号 = Number((谁 && 谁.号码) || 0)
  if (!号) return { ok: false, 说: '没给号码' }
  const 地址 = String(找收件人().地址 || 'http://127.0.0.1:3000').replace(/\/+$/, '')
  const 端点 = 是群 ? '/send_group_msg' : '/send_private_msg'
  const 体 = (消息) => (是群 ? { group_id: 号, message: 消息 } : { user_id: 号, message: 消息 })
  const 段们 = 拆段(文本)
  let 过 = 0
  let 末 = ''
  for (let i = 0; i < 段们.length; i++) {
    try {
      const r = await fetch(地址 + 端点, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(体([{ type: 'text', data: { text: 段们[i] } }])),
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) { 末 = 'NapCat 回了个 ' + r.status; break }
      const j = await r.json().catch(() => ({}))
      if (!j || j.status !== 'ok') { 末 = '没发出去：' + JSON.stringify(j).slice(0, 120); break }
      过 += 1
    } catch (error) {
      末 = '连不上 NapCat：' + String((error && error.message) || error)
      break
    }
    if (i < 段们.length - 1) await 歇一下(段间停顿(段们[i]))
  }
  if (!段们.length) 过 = 0
  if (段们.length && 过 < 段们.length) return { ok: false, 说: (过 ? '发了一半：' : '') + (末 || '没发出去') }

  // 图片一张一张发，中间歇一下
  let 图过 = 0
  for (const x of Array.isArray(图们) ? 图们 : []) {
    let 段 = null
    if (x && x.value && /^https?:\/\//i.test(x.value)) 段 = { type: 'image', data: { file: x.value } }
    if (!段) {
      const b = 读图(x)
      if (b) 段 = 图片段(b)
    }
    if (!段) continue
    try {
      const r = await fetch(地址 + 端点, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(体([段])),
        signal: AbortSignal.timeout(20000),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j && j.status === 'ok') 图过 += 1
      else 末 = '图没发出去：' + JSON.stringify(j).slice(0, 100)
    } catch (error) {
      末 = '图发不出去：' + String((error && error.message) || error)
    }
    await 歇一下(800)
  }
  if (!段们.length && !图过) return { ok: false, 说: '没有能发的' }
  return { ok: true, 说: '发出去了' + (图过 ? '（带 ' + 图过 + ' 张图）' : '') }
}
