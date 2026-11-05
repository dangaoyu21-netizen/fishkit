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

/**
 * 发一句到 QQ 私聊。
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
  try {
    const r = await fetch(谁.地址 + '/send_private_msg', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: 号, message: [{ type: 'text', data: { text: 话 } }] }),
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) return { ok: false, 说: 'NapCat 回了个 ' + r.status }
    const j = await r.json().catch(() => ({}))
    if (j && j.status === 'ok') return { ok: true, 说: '发出去了（' + 号 + '）' }
    return { ok: false, 说: '没发出去：' + JSON.stringify(j).slice(0, 120) }
  } catch (error) {
    return { ok: false, 说: '连不上 NapCat：' + String((error && error.message) || error) }
  }
}
