// QQ 相关的路由（2026-11-10 从 index.js 拆出来的第二批）
//
// 探针、通道配置、系统通知送进会话，三条。
// 依赖都从 index.js 传进来，这里不自己建东西，只挂路由。

import { readFileSync } from 'node:fs'

export function 挂QQ路由(依赖) {
  const {
    路线, 读体, 回, 记账,
    找收件人, 读QQ配置, 存QQ配置, 文本转绑定, 桥配置文件,
    QQ通道, 取QQ关键字, 出口, 找agent,
  } = 依赖

  // NapCat 那类接口在不在（2026-11-05）：就是个探针，不动任何东西
  路线('/dsh-fishsoul/qqprobe', async (req, res) => {
    const 谁 = 找收件人()
    try {
      const r = await fetch(谁.地址 + '/get_login_info', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(5000),
      })
      const j = await r.json().catch(() => ({}))
      if (j && j.status === 'ok' && j.data) {
        return 回(res, { ok: true, 在线: true, 昵称: String(j.data.nickname || ''), 号: String(j.data.user_id || ''), 地址: 谁.地址 })
      }
      return 回(res, { ok: false, 在线: false, 说: '有回应，但状态不对：' + JSON.stringify(j).slice(0, 100), 地址: 谁.地址 })
    } catch (error) {
      return 回(res, { ok: false, 在线: false, 说: '连不上 ' + 谁.地址 + '（NapCat 没开着？）', 地址: 谁.地址 })
    }
  })

  路线('/dsh-fishsoul/qqlink', async (req, res) => {
    const 体 = await 读体(req)
    if (体 && 体.导入 === true) {
      let 桥 = null
      try { 桥 = JSON.parse(readFileSync(桥配置文件, 'utf8')) } catch (error) { 桥 = null }
      if (!桥) return 回(res, { ok: false, 说: '读不到桥的配置：' + 桥配置文件 })
      const 新 = { ...读QQ配置(), 绑定: Array.isArray(桥.绑定) ? 桥.绑定 : [], WS地址: 桥.WS地址 || 读QQ配置().WS地址 }
      if (!存QQ配置(新)) return 回(res, { ok: false, 说: '存不上' })
      记账('从桥那边抄过来 ' + 新.绑定.length + ' 条绑定')
      return 回(res, { ok: true, 说: '抄过来 ' + 新.绑定.length + ' 条', 配置: 新 })
    }
    if (体 && typeof 体.绑定文本 === 'string') {
      const 绑定 = 文本转绑定(体.绑定文本)
      const 新 = { ...读QQ配置(), 绑定 }
      if (!存QQ配置(新)) return 回(res, { ok: false, 说: '存不上' })
      记账('手填了绑定：' + 绑定.length + ' 条')
      return 回(res, { ok: true, 说: '记下了 ' + 绑定.length + ' 条', 配置: 新 })
    }
    if (体 && 体.设置 && typeof 体.设置 === 'object') {
      const 允许 = ['自动回', '只回QQ唤醒', '只发标记内', '试运行', '发图', '群一句话', '窗口分钟', '昵称', 'WS地址']
      const 补 = {}
      for (const k of 允许) if (k in 体.设置) 补[k] = 体.设置[k]
      const 新 = { ...读QQ配置(), ...补 }
      if (!存QQ配置(新)) return 回(res, { ok: false, 说: '存不上' })
      记账('改了 QQ 通道设置：' + Object.keys(补).join('、'))
      return 回(res, { ok: true, 说: '记下了', 配置: 新, 出口: 出口.暂存() })
    }
    if (体 && typeof 体.开关 === 'boolean') {
      if (!存QQ配置({ ...读QQ配置(), 开关: 体.开关 })) return 回(res, { ok: false, 说: '存不上' })
      if (体.开关) QQ通道.开(); else QQ通道.关()
      return 回(res, { ok: true, 说: 体.开关 ? '开了' : '关了', 状态: QQ通道.状态(), 出口: 出口.暂存() })
    }
    回(res, { ok: true, 配置: 读QQ配置(), 状态: QQ通道.状态(), 关键字: 取QQ关键字(), 出口: 出口.暂存() })
  })

  // 系统通知送进会话（2026-11-06）：以前走桥的 /receive，桥关了改走这儿。
  // 送到「老大」那条绑定对应的会话，并且标成「QQ 唤醒」—— 我的回复会回到他手机上。
  路线('/dsh-fishsoul/say', async (req, res) => {
    const 体 = await 读体(req)
    const 文字 = String((体 && 体.文字) || '').trim()
    if (!文字) return 回(res, { ok: false, 说: '空的就不送了' })
    const 行 = (读QQ配置().绑定 || []).find((b) => b && b.类型 === '私聊' && String(b.称呼 || '') === '老大')
    const 会话 = 行 ? String(行.会话 || '') : ''
    const agent = 找agent(会话)
    if (!agent || typeof agent.followup !== 'function') return 回(res, { ok: false, 说: '老大那间会话这会儿不在' })
    try {
      await Promise.resolve(agent.followup({
        id: 'notify-' + Date.now() + '-' + Math.random().toString(36).slice(2),
        role: 'user',
        content: [{ type: 'text', text: 文字 }],
        source: { kind: 'notify' },
      }))
      出口.标唤醒(会话)
      记账('系统通知送进会话：' + 文字.slice(0, 30))
      回(res, { ok: true, 说: '送进去了' })
    } catch (error) {
      回(res, { ok: false, 说: '送不进去：' + String((error && error.message) || error) })
    }
  })
}
