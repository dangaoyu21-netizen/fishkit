// 小肥鱼 · 把会话里说的话发回 QQ（2026-11-06）
//
// 之前只有「收」（qqlink.js）和「手动发」（qq.js），所以切掉旧桥的前提一直不成立。
// 这一截补上：听会话事件、记住一轮最后说的那段话、轮次结束时按绑定发回对应的私聊 / 群。
//
// 三道闸照桥那套搬过来，但默认更保守：
//   ① 自动回（qq.json，默认开）—— 总闸
//   ② 只回 QQ 唤醒（默认开）—— 你在桌面自己聊的不推到手机
//   ③ 只发标记内（默认关）—— 开了就只发 [QQ]…[/QQ] 块里的
// 外加一个「试运行」：把要发的话写进日志，不真发。
//
// ⚠️ 这一层只管「要不要发、发到哪」，怎么发（拆段、停顿、图片）在 qq.js 里。

/** 会话键：统一成不带 `session-` 前缀的样子，绑定的两边都能对上 */
export function 归一(s) {
  return String(s == null ? '' : s).trim().replace(/^session-/, '')
}

/** 两个会话 id 是不是同一间（带不带前缀都认） */
export function 同一间(a, b) {
  const x = 归一(a)
  const y = 归一(b)
  return Boolean(x && y && x === y)
}

/** 从一条 assistant 消息里只抽正文（text 块；reasoning / 图片都不要） */
export function 抽正文(message) {
  if (!message || !Array.isArray(message.content)) return ''
  return message.content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim()
}

/**
 * 正文里那种 markdown 图片 `![名字](路径)` 也当图片发。
 * 以前桥是这么干的（贴纸就是 `![小肥鱼](...)`），不抠的话 QQ 那边看到的是一串 markdown。
 * @returns {{净文字:string, 图:{kind:'url'|'path', value:string}[]}}
 */
export function 抠正文图(文字) {
  const 图 = []
  const 净文字 = String(文字 || '')
    .replace(/!\[[^\]]*\]\(\s*([^)\s]+)\s*\)/g, (全, 路径) => {
      const p = String(路径 || '').trim()
      if (!p) return ''
      if (/^https?:\/\//i.test(p)) {
        if (!图.some((x) => x.value === p)) 图.push({ kind: 'url', value: p })
        return ''
      }
      if (!图.some((x) => x.value === p)) 图.push({ kind: 'path', value: p })
      return ''
    })
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { 净文字, 图 }
}

/** 取 [QQ]…[/QQ] 里的那段；没有就返回空 */
export function 取标记块(文字) {
  const 块 = /\[QQ\]([\s\S]*?)\[\/QQ\]/.exec(String(文字 || ''))
  return 块 && String(块[1] || '').trim() ? String(块[1]).trim() : ''
}

/** 按绑定找这间会话说的话该回哪个聊天 */
export function 找绑定(绑定, 会话) {
  for (const 行 of Array.isArray(绑定) ? 绑定 : []) {
    if (行 && 同一间(行.会话, 会话)) return 行
  }
  return null
}

/** 带不带前缀找一次（会话 id 常换形式，两个方向都试） */
export function 候选会话(id) {
  const 原 = String(id == null ? '' : id).trim()
  if (!原) return []
  const 出 = [原]
  if (原.startsWith('session-')) 出.push(原.slice('session-'.length))
  else 出.push('session-' + 原)
  return 出
}

/**
 * 只留一句（外部渠道的规矩：只回一句话）。
 * 找第一个句末标点就收；没有标点就按长度截。
 */
export function 取一句(文字, 上限 = 80) {
  const 净 = String(文字 || '').trim().replace(/\s+/g, ' ')
  if (!净) return ''
  const 句 = /^[^。！？!?；;\n]{1,200}[。！？!?；;]?/u.exec(净)
  let 一 = 句 ? 句[0].trim() : 净
  if (!一) 一 = 净
  if (一.length > 上限) 一 = 一.slice(0, 上限).replace(/[，,、\s]+$/u, '') + '…'
  return 一
}

/** 这一行是不是「老大本人」—— 不是的话按外部渠道处理，只回一句 */
export function 是老大(行, 配置) {
  if (!行) return false
  if (行.类型 === '群') return false
  const 称呼 = String(行.称呼 || '')
  if (称呼 === '老大') return true
  try {
    const 老大 = ((配置 && 配置.绑定) || []).find((b) => b && b.类型 === '私聊' && String(b.称呼 || '') === '老大')
    return Boolean(老大 && String(老大.号码) === String(行.号码))
  } catch (error) {
    return false
  }
}

/**
 * 建一个出口。
 * @param {object} 选项
 *   - 记账：日志
 *   - 读配置：函数，返回 qq.json 的内容
 *   - 发私聊：(号码, 文字, 图) => Promise
 *   - 发群：(群号, 文字, 图) => Promise
 */
export function 建出口(选项 = {}) {
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  const 读配置 = typeof 选项.读配置 === 'function' ? 选项.读配置 : () => ({})
  const 发私聊 = typeof 选项.发私聊 === 'function' ? 选项.发私聊 : async () => ({ ok: false, 说: '没有发私聊的口子' })
  const 发群 = typeof 选项.发群 === 'function' ? 选项.发群 : async () => ({ ok: false, 说: '没有发群的口子' })

  // 上一轮说的那段话，按会话分开存（两间会话同时说话不会串）
  const 上一轮们 = new Map() // 会话键 -> { 轮号, 文本, 图们 }
  const 已发过 = new Set() // 「会话键:轮号」
  // 这一轮是不是 QQ 消息叫醒的（消费一次就清掉）
  const 唤醒时间 = new Map()
  const 唤醒窗口 = 15 * 60000

  /** 通道那边收到一条消息、要往这间会话送的时候调一下 */
  const 标唤醒 = (会话) => {
    const 键 = 归一(会话)
    if (键) 唤醒时间.set(键, Date.now())
  }

  const 空轮 = () => ({ 轮号: -1, 文本: '', 图们: [] })

  /** 一轮结束，决定发不发 */
  const 落地一发 = async (会话键, 本轮) => {
    const 配置 = 读配置() || {}
    // 默认关（2026-11-06）：旧桥还挂着的时候，两条一起开就会一条消息回两遍。
    if (配置.自动回 !== true) return 记账('自动回关着，这轮不往 QQ 发')
    const 行 = 找绑定(配置.绑定, 会话键)
    if (!行) return // 这间会话没绑，闲聊不往外推
    const 标 = 会话键 + ':' + String(本轮.轮号)
    if (已发过.has(标)) return
    已发过.add(标)
    if (已发过.size > 300) 已发过.clear()

    // 闸一：只发标记内
    let 待发 = String(本轮.文本 || '')
    if (配置.只发标记内 === true) {
      const 块 = 取标记块(待发)
      if (!块) return 记账('这轮没写 [QQ]…[/QQ] 块（「只发标记内」开着）—— 不发')
      待发 = 块
    }
    // 闸二：只回 QQ 唤醒的那一轮
    if (配置.只回QQ唤醒 !== false) {
      const 醒 = 唤醒时间.get(会话键) || 0
      唤醒时间.delete(会话键)
      if (!醒 || Date.now() - 醒 > 唤醒窗口) {
        return 记账('这轮不是 QQ 叫醒的（「只回 QQ 唤醒」开着）—— 只在本地说，不推 QQ')
      }
    }

    // 外部渠道：只回一句话（老大本人的私聊不截）
    let 图们 = Array.isArray(本轮.图们) ? 本轮.图们.slice(0, 10) : []
    const 外部 = !是老大(行, 配置) && 配置.群一句话 !== false
    if (外部) {
      待发 = 取一句(待发, 80)
      图们 = [] // 一句话就是一句话，不带图
    }
    // 抠正文里的 markdown 图（贴纸是这么发的）
    const 抠过 = 配置.发图 === false ? { 净文字: 待发, 图: [] } : 抠正文图(待发)
    const 全图 = 图们.concat(抠过.图)
    const 净文 = String(抠过.净文字 || '').trim()
    if (!净文 && !全图.length) return

    if (配置.试运行 === true) {
      记账('试运行：本来要发到 ' + 行.类型 + ' ' + 行.号码 + ' →「' + 净文.slice(0, 40) + (净文.length > 40 ? '…' : '') + '」')
      return
    }

    try {
      const 果 = 行.类型 === '群'
        ? await 发群(行.号码, 净文, 全图)
        : await 发私聊(行.号码, 净文, 全图)
      const 尾巴 = 全图.length ? '（带 ' + 全图.length + ' 张图）' : ''
      if (果 && 果.ok) 记账('✅ 已发到 ' + (行.类型 === '群' ? '群 ' + 行.号码 : '私聊 ' + 行.号码) + '：「' + 净文.slice(0, 40) + (净文.length > 40 ? '…' : '') + '」' + 尾巴)
      else 记账('⚠ 发 QQ 没发出去：' + String((果 && 果.说) || '不知道为啥'))
    } catch (error) {
      记账('⚠ 发 QQ 出错：' + String((error && error.message) || error))
    }
  }

  /** 吃会话事件：记这一轮最后一句，轮次结束时落地 */
  const 吃事件 = (session, event) => {
    const 键 = 归一(session && session.id)
    if (!键 || !event) return
    const 上 = 上一轮们.get(键) || 空轮()
    if (event.type === 'assistant/message') {
      const d = event.data || {}
      if (d.interrupted) {
        上一轮们.set(键, 空轮())
        return
      }
      const 文 = 抽正文(d.message)
      const 图们 = []
      try {
        if (d.message && Array.isArray(d.message.content)) {
          for (const b of d.message.content) if (b && b.type === 'image' && b.attachment) 图们.push(b)
        }
      } catch (error) {}
      if (文) 上一轮们.set(键, { 轮号: d.turn, 文本: 文, 图们 })
      else if (图们.length) {
        上一轮们.set(键, {
          轮号: d.turn,
          文本: 上.轮号 === d.turn ? 上.文本 : '',
          图们: (上.轮号 === d.turn ? 上.图们 : []).concat(图们).slice(0, 10),
        })
      }
      return
    }
    if (event.type === 'turn/end') {
      const d = event.data || {}
      const 完成 = !!(d.reason && d.reason.kind === 'completed')
      if (完成 && 上.轮号 === d.turn && (上.文本 || 上.图们.length)) {
        void 落地一发(键, 上)
      }
      上一轮们.set(键, 空轮())
    }
  }

  return {
    吃事件,
    标唤醒,
    落地一发: (会话, 本轮) => 落地一发(归一(会话), 本轮),
    暂存: () => ({ 会话数: 上一轮们.size, 已发: 已发过.size }),
  }
}
