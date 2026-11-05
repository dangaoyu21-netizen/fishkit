// 小肥鱼 · 自己的 QQ 通道（开发板，2026-11-05）
//
// 不碰桥那个插件 —— 那是别人写的，改一升级就没了。
// 这里只做最小一截：连 NapCat 的推送口，收到私聊就转进绑定的那间会话。
// 发消息用 lib/qq.js（直连 send_private_msg）。
//
// 现在只认私聊，群、图片、门槛都还没做 —— 一步一步来。
// ⚠️ 开发板：先在这里长，验过才合回主插件，而且真上线前得先把旧桥关掉，不然会回两遍。

export const 版本 = '0.1.0'
/** 没配就用这个（NapCat 的推送口） */
export const 默认WS = 'ws://127.0.0.1:3001/'

/**
 * 从 OneBot 的 message 数组里抽内容。
 * 认：文字、图片、语音、分享卡片（json/xml）、合并转发。
 */
export function 抽内容(message) {
  if (typeof message === 'string') return { 文字: message, 图们: [], 语音们: [], 卡们: [], 转发们: [] }
  if (!Array.isArray(message)) return { 文字: '', 图们: [], 语音们: [], 卡们: [], 转发们: [] }
  const 字 = []
  const 图们 = []
  const 语音们 = []
  const 卡们 = []
  const 转发们 = []
  for (const 段 of message) {
    if (!段) continue
    const 数 = 段.data || {}
    if (段.type === 'text') 字.push(String(数.text || ''))
    else if (段.type === 'image') { const u = String(数.url || 数.file || ''); if (u) 图们.push(u) }
    else if (段.type === 'record') { const u = String(数.url || 数.file || ''); 语音们.push(u || '（没给地址）') }
    else if (段.type === 'json' || 段.type === 'xml') 卡们.push(String(数.data || 数.content || '').slice(0, 300))
    else if (段.type === 'forward') 转发们.push(数)
  }
  return { 文字: 字.join(''), 图们, 语音们, 卡们, 转发们 }
}

/** 只要文字（老接口，留着别的地方还在用） */
export function 抽文字(message) {
  return 抽内容(message).文字
}

/** 把文字和各种附件拼成一句能读的话 */
export function 拼成话(文字, 图们, 其们 = {}) {
  const 净 = String(文字 || '').trim()
  const 图 = Array.isArray(图们) ? 图们.filter(Boolean) : []
  const 语 = Array.isArray(其们.语音们) ? 其们.语音们.filter(Boolean) : []
  const 卡 = Array.isArray(其们.卡们) ? 其们.卡们.filter(Boolean) : []
  const 转 = Array.isArray(其们.转发们) ? 其们.转发们.filter(Boolean) : []
  const 尾 = []
  if (图.length) 尾.push('（附了 ' + 图.length + ' 张图，地址：' + 图.join(' ') + '）')
  if (语.length) 尾.push('（有一段语音，地址：' + 语.join(' ') + '）')
  if (卡.length) 尾.push('（分享卡片：' + 卡.join(' ｜ ') + '）')
  if (转.length) 尾.push('（转来一段聊天记录）')
  return [净, ...尾].filter(Boolean).join('\n')
}

/**
 * 一条事件是不是「别人发给我的私聊」，是就返回 { 号码, 文字 }。
 * @param {object} 事件 OneBot 11 的事件
 * @param {number} 自己号 自己的 QQ 号（自己发出来的不算）
 */
export function 读私聊事件(事件, 自己号 = 0) {
  if (!事件 || 事件.post_type !== 'message') return null
  if (事件.message_type !== 'private') return null
  const 号 = Number(事件.user_id || 0)
  if (!号) return null
  if (自己号 && Number(自己号) === 号) return null
  const 内 = 抽内容(事件.message)
  const 净 = String(内.文字 || 事件.raw_message || '').trim()
  if (!净 && !内.图们.length && !内.语音们.length && !内.卡们.length && !内.转发们.length) return null
  const 昵称 = String((事件.sender && (事件.sender.card || 事件.sender.nickname)) || '')
  return { 号码: 号, 文字: 净, 图们: 内.图们, 语音们: 内.语音们, 卡们: 内.卡们, 转发们: 内.转发们, 昵称 }
}

/** 按绑定找这号该进哪间会话（只认私聊行） */
export function 找会话(绑定, 号码) {
  const 行 = (绑定 || []).find((b) => b && b.类型 === '私聊' && String(b.号码) === String(号码))
  return 行 ? String(行.会话 || '') : ''
}

/** 按绑定找这个群该进哪间会话 */
export function 找群会话(绑定, 群号) {
  const 行 = (绑定 || []).find((b) => b && b.类型 === '群' && String(b.号码) === String(群号))
  return 行 ? String(行.会话 || '') : ''
}

/** 这条群消息里有没有 @ 我 */
export function 有艾特我(message, 自己号) {
  if (!Array.isArray(message) || !自己号) return false
  return message.some((段) => 段 && 段.type === 'at' && String((段.data && 段.data.qq) || '') === String(自己号))
}

/**
 * 一条事件是不是「群里的消息」，是就返回 { 群号, 号码, 文字, 图们, 昵称, 群名, 艾特我 }。
 * 群里只认 @ 到我的、或者带关键字的 —— 不然一群人聊天，句句都往会话里灌。
 */
export function 读群消息(事件, 自己号 = 0) {
  if (!事件 || 事件.post_type !== 'message') return null
  if (事件.message_type !== 'group') return null
  const 群号 = Number(事件.group_id || 0)
  const 号 = Number(事件.user_id || 0)
  if (!群号 || !号) return null
  if (自己号 && Number(自己号) === 号) return null
  const 内 = 抽内容(事件.message)
  const 昵称 = String((事件.sender && (事件.sender.card || 事件.sender.nickname)) || '')
  const 群名 = String(事件.group_name || '')
  return {
    群号,
    号码: 号,
    文字: String(内.文字 || '').trim(),
    图们: 内.图们,
    语音们: 内.语音们,
    卡们: 内.卡们,
    转发们: 内.转发们,
    昵称,
    群名,
    艾特我: 有艾特我(事件.message, 自己号),
  }
}

/** 这段话里有没有提到某个关键字（2026-11-05 老大要的：感兴趣的词也算叫醒） */
export function 含关键字(文字, 关键字们) {
  const 净 = String(文字 || '')
  if (!净) return false
  return (Array.isArray(关键字们) ? 关键字们 : []).some((k) => {
    const 词 = String(k || '').trim()
    return 词 && 净.includes(词)
  })
}

/** 绑定 → 一行一条的文本（给人看、给人改） */
export function 绑定转文本(绑定) {
  return (绑定 || [])
    .map((b) => [b.类型 || '私聊', b.号码 || '', b.会话 || '', b.称呼 || ''].join('|'))
    .join('\n')
}

/**
 * 文本 → 绑定。一行一条：类型|号码|会话|称呼。
 * 空行、缺号码、缺会话的都丢掉；类型只认「群」，别的都当私聊。
 */
export function 文本转绑定(文本) {
  const 出 = []
  for (const 行 of String(文本 || '').split(/\r?\n/)) {
    const 净 = 行.trim()
    if (!净) continue
    const 段 = 净.split('|').map((x) => x.trim())
    const 号码 = 段[1] || ''
    const 会话 = 段[2] || ''
    if (!号码 || !会话) continue
    出.push({ 类型: 段[0] === '群' ? '群' : '私聊', 号码, 会话, 称呼: 段[3] || '' })
  }
  return 出
}

/**
 * 建一个通道。
 * @param {object} 选项
 *   - 读配置：函数，返回 { 收消息方式, WS地址, 绑定, NapCat? }
 *   - 记账：日志
 *   - 送话：函数 (会话id, 文字) => Promise，把一句话喂进那间会话
 *   - 自己号：函数，返回自己的 QQ 号（可选）
 */
export function 建通道(选项 = {}) {
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  const 读配置 = typeof 选项.读配置 === 'function' ? 选项.读配置 : () => ({})
  const 送话 = typeof 选项.送话 === 'function' ? 选项.送话 : async () => {}
  const 取自己号 = typeof 选项.自己号 === 'function' ? 选项.自己号 : () => 0
  // 关键字每次现算：我的名字、QQ 昵称、鱼缸里兴趣高的那几类（2026-11-05 老大定的）
  const 取关键字 = typeof 选项.取关键字 === 'function' ? 选项.取关键字 : () => []
  // 语音转文字（2026-11-05）：给了就转，没给就只写一句「有一段语音」
  const 转写语音 = typeof 选项.转写语音 === 'function' ? 选项.转写语音 : null

  /** 把语音转成文字，转不了就返回空 */
  const 试着转写 = async (语音们) => {
    if (!转写语音 || !Array.isArray(语音们) || !语音们.length) return []
    const 出 = []
    for (const 地址 of 语音们) {
      try {
        const 文 = await 转写语音(地址)
        if (文 && String(文).trim()) 出.push(String(文).trim())
      } catch (error) {
        记账('语音转写出错：' + String((error && error.message) || error))
      }
    }
    return 出
  }

  let 套接字 = null
  let 定时器 = null
  let 停了 = false
  let 连着 = false

  // 门槛（2026-11-05）：@ 我或者叫到我，就算「聊开了」，开一个五分钟的窗口；
  // 窗口里没叫我的消息也放进去，带一句提示让我自己判断是不是在接我的话。过了窗口就收。
  const 窗口们 = new Map() // 群号 → 到什么时候

  // 同一个人、同一句话，五秒内只认一次 —— 断线重连时 QQ 会把老消息再推一遍
  const 最近收过 = new Map()
  const 去过重 = (键) => {
    const 现在 = Date.now()
    const 上 = 最近收过.get(键)
    if (上 && 现在 - 上 < 5000) return false
    最近收过.set(键, 现在)
    if (最近收过.size > 200) {
      for (const [k, t] of 最近收过) if (现在 - t > 60000) 最近收过.delete(k)
    }
    return true
  }

  const 收事件 = async (事件) => {
    const 自己 = 取自己号()
    const 私 = 读私聊事件(事件, 自己)
    if (私) {
      if (!去过重('私:' + 私.号码 + '|' + 私.文字)) return
      const 配置 = 读配置()
      const 会话 = 找会话(配置 && 配置.绑定, 私.号码)
      if (!会话) {
        记账('收到 ' + 私.号码 + ' 的私聊，但没绑定，跳过')
        return
      }
      记账('收到 ' + 私.号码 + ' 的私聊，转进 ' + 会话.slice(-6))
      const 语音字 = await 试着转写(私.语音们)
      const 话 = 拼成话([私.文字, ...语音字].filter(Boolean).join('\n'), 私.图们, { 卡们: 私.卡们, 转发们: 私.转发们 })
      try {
        await 送话(会话, 话)
      } catch (error) {
        记账('转进会话失败：' + String((error && error.message) || error))
      }
      return
    }
    const 群 = 读群消息(事件, 自己)
    if (群) {
      const 配置 = 读配置()
      let 词们 = []
      try { 词们 = 取关键字() || [] } catch (error) { 词们 = [] }
      const 叫我了 = 群.艾特我 || 含关键字(群.文字, 词们)
      const 群键 = String(群.群号)
      const 当前 = Date.now()
      const 窗口毫秒 = Math.max(1, Number((配置 && 配置.窗口分钟) || 5)) * 60000
      const 在聊 = (窗口们.get(群键) || 0) > 当前
      if (叫我了) {
        窗口们.set(群键, 当前 + 窗口毫秒) // 叫到了就是开聊，窗口续上
      } else if (!((配置 && 配置.门槛 !== false) && 在聊)) {
        return // 没叫我、也没在聊，就不去吵
      }
      if (!去过重('群:' + 群.群号 + ':' + 群.号码 + '|' + 群.文字)) return
      const 会话 = 找群会话(配置 && 配置.绑定, 群.群号)
      if (!会话) {
        记账('群里 ' + 群.群号 + ' 有人叫我，但这个群没绑定，跳过')
        return
      }
      记账('群里 ' + (群.群名 || 群.群号) + (叫我了 ? ' 有人叫我' : ' 还在聊，接着看') + '，转进 ' + 会话.slice(-6))
      const 谁 = '【群 ' + (群.群名 || 群.群号) + ' · ' + (群.昵称 || 群.号码) + '】'
      const 提示 = 叫我了 ? '' : '（这条没 @ 你：判断一下是不是在接你的话，不是就装没看见）\n'
      const 语音字 = await 试着转写(群.语音们)
      try {
        await 送话(会话, 谁 + 提示 + 拼成话([群.文字, ...语音字].filter(Boolean).join('\n'), 群.图们, { 卡们: 群.卡们, 转发们: 群.转发们 }))
      } catch (error) {
        记账('群消息转进会话失败：' + String((error && error.message) || error))
      }
    }
  }

  const 连一次 = () => {
    if (停了) return
    if (typeof WebSocket === 'undefined') {
      记账('这个运行时没有 WebSocket，自己的 QQ 通道开不了（不影响别的功能）')
      return
    }
    const 配置 = 读配置() || {}
    const 地址 = String(配置.WS地址 || 默认WS)
    try {
      套接字 = new WebSocket(地址)
    } catch (error) {
      记账('连不上推送口：' + String((error && error.message) || error))
      排下一次()
      return
    }
    套接字.addEventListener('open', () => {
      连着 = true
      记账('推送口连上了：' + 地址)
    })
    套接字.addEventListener('message', (ev) => {
      let 事件 = null
      try { 事件 = JSON.parse(String(ev.data)) } catch (error) { return }
      void 收事件(事件)
    })
    套接字.addEventListener('close', () => {
      连着 = false
      套接字 = null
      if (!停了) 记账('推送口断了，30 秒后再连')
      排下一次()
    })
    套接字.addEventListener('error', () => { /* close 会跟着来，这里不用管 */ })
  }

  const 排下一次 = () => {
    if (停了 || 定时器) return
    定时器 = setTimeout(() => {
      定时器 = null
      连一次()
    }, 30000)
  }

  /** 开 */
  const 开 = () => {
    停了 = false
    连一次()
  }

  /** 关 */
  const 关 = () => {
    停了 = true
    if (定时器) { clearTimeout(定时器); 定时器 = null }
    try { if (套接字) 套接字.close() } catch (error) {}
    套接字 = null
  }

  return { 开, 关, 收事件, 状态: () => ({ 连着, 地址: String((读配置() || {}).WS地址 || 默认WS) }) }
}
