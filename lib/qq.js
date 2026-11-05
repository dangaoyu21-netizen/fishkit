// 小肥鱼 · 往 QQ 说一句（2026-11-05）
//
// 桥（dsh-qq-bridge）还是单独的插件，这里不搬它，只隔着本机 HTTP 让它发一句。
// 桥那边有个 `/dsh-qq-bridge/say`：手动发、绕开「只回 QQ 唤醒」那道闸，
// 但照样走它自己的拆段、发图。
//
// ⚠ 桥没起来、或者一条绑定都没有，这里就发不出去 —— 老老实实把原因说出来，别装作发了。

export const 桥地址 = 'http://127.0.0.1:43120/dsh-qq-bridge'

/**
 * 让桥发一句。
 * @param {string} 文本 要说的话
 * @param {object} 参数 { 会话 } —— 会话 id；不给就发桥里第一条绑定
 * @returns {Promise<{ok:boolean, 说:string}>}
 */
export async function 发一句(文本, 参数 = {}) {
  const 话 = String(文本 || '').trim()
  if (!话) return { ok: false, 说: '空的就不发了' }
  const 体 = { text: 话 }
  const 会话 = String((参数 && 参数.会话) || '').trim()
  if (会话) 体.会话 = 会话
  try {
    const r = await fetch(桥地址 + '/say', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(体),
      signal: AbortSignal.timeout(15000),
    })
    if (r.status === 404) return { ok: false, 说: '桥没开、或者太旧了（找不到 /say）' }
    if (!r.ok) return { ok: false, 说: '桥回了个 ' + r.status }
    const j = await r.json().catch(() => ({}))
    return { ok: j && j.ok !== false, 说: String((j && j.说) || '') }
  } catch (error) {
    return { ok: false, 说: '连不上桥：' + String((error && error.message) || error) }
  }
}
