// 小肥鱼 · 调模型（开发板）
//
// 2026-11-17：之前以为插件拿不到调模型的口子，其实有——`ctx.get('llm')`。
// 借鉴 dsh-study-mode 的做法：
//   · 不带 sessionId（隔离），只有我们显式拼进去的内容，模型看不到聊天历史；
//   · 模型选择每次重新读（用户界面上切了，下一次就用新的）；
//   · 任何失败都**温和降级**：返回 {ok:false}，调用方退回本地排序，别让功能挂掉。
//
// 用法：
//   const 模 = 建模型调用(ctx)
//   模.有()                        → 有没有可用的模型服务
//   await 模.问({ 提示, 超时 })      → { ok, 文本, 说 }
//   await 模.问JSON({ 提示 })       → { ok, 值, 说 }（自动抠 JSON）

/** 兜底：取不到宿主选择时用 */
const 兜底模型 = 'deepseek-flash'

/**
 * 取宿主上的 llm 服务（软探测，取不到不算错）。
 */
export function 取模型服务(ctx) {
  try {
    return ctx && typeof ctx.get === 'function' ? ctx.get('llm') || null : null
  } catch (error) {
    return null
  }
}

/**
 * 解析这次该用哪个模型：优先宿主当前选择，取不到就用兜底。
 */
export function 选模型(ctx) {
  try {
    const 选 = ctx && typeof ctx.get === 'function' ? ctx.get('agentDefaultModel') : null
    if (选 && typeof 选.currentSelection === 'function') {
      const s = 选.currentSelection()
      if (s && s.provider && s.model) return { provider: String(s.provider), model: String(s.model) }
    }
  } catch (error) {}
  return { provider: 'deepseek-account', model: 兜底模型 }
}

/** 把流收成一段文字（跟 dsh-study-mode 的 collectStream 一个路子，砍到只留正文） */
async function 收流(stream) {
  const 块 = new Map()
  let 思考字数 = 0
  let 错误 = ''
  const 槽 = (i) => {
    const k = i === undefined || i === null ? 0 : i
    if (!块.has(k)) 块.set(k, '')
    return k
  }
  for await (const chunk of stream) {
    if (!chunk || typeof chunk !== 'object') continue
    if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
      const k = 槽(chunk.index)
      块.set(k, 块.get(k) + chunk.text)
      continue
    }
    if (chunk.type === 'block-end' && chunk.block && chunk.block.type === 'text') {
      const k = 槽(chunk.index)
      if (typeof chunk.block.text === 'string' && chunk.block.text.length >= 块.get(k).length) 块.set(k, chunk.block.text)
      continue
    }
    if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string') { 思考字数 += chunk.text.length; continue }
    if (chunk.type === 'finish') {
      const r = chunk.reason
      if (r && r.kind === 'error') 错误 = String((r.failure && r.failure.message) || '模型调用失败')
    }
  }
  const 文 = [...块.keys()].sort((a, b) => a - b).map((k) => 块.get(k)).join('').trim()
  return { 文, 思考字数, 错误 }
}

/**
 * 建一个模型调用本。
 * @param {object} ctx 插件上下文
 * @param {object} 选项 { 超时, 最多字 }
 */
export function 建模型调用(ctx, 选项 = {}) {
  const 超时 = Math.max(3000, Number(选项.超时) || 40000)
  const 最多字 = Math.max(200, Number(选项.最多字) || 1500)

  const 有 = () => Boolean(取模型服务(ctx))

  /** 现在用哪个模型（探活和排错用） */
  const 说 = () => {
    if (!取模型服务(ctx)) return '没有模型服务'
    const s = 选模型(ctx)
    return s.provider + ' / ' + s.model
  }

  /**
   * 问一次模型。
   * @param {{提示:string, 系统?:string, 超时?:number, 最多字?:number}} 问
   * @returns {Promise<{ok:boolean, 文本:string, 说:string}>}
   */
  const 问 = async (问 = {}) => {
    const llm = 取模型服务(ctx)
    if (!llm || typeof llm.stream !== 'function') return { ok: false, 文本: '', 说: '本机没有可用的模型服务' }
    const { provider, model } = 选模型(ctx)
    const 控制 = new AbortController()
    const 表 = setTimeout(() => 控制.abort(), Math.max(3000, Number(问.超时) || 超时))
    try {
      const stream = llm.stream({
        provider, model,
        ...(问.系统 ? { system: String(问.系统) } : {}),
        messages: [{ role: 'user', content: [{ type: 'text', text: String(问.提示 || '') }] }],
        maxTokens: Math.max(200, Number(问.最多字) || 最多字),
        signal: 控制.signal,
      })
      const { 文, 思考字数, 错误 } = await 收流(stream)
      if (错误) return { ok: false, 文本: 文, 说: 错误 }
      if (!文) {
        return {
          ok: false, 文本: '',
          说: 思考字数 ? '模型只返回了思考过程，没有正文' : '模型没有返回内容',
        }
      }
      return { ok: true, 文本: 文, 说: '' }
    } catch (error) {
      const 是中止 = error && (error.name === 'AbortError' || /abort/i.test(String(error.message || '')))
      return { ok: false, 文本: '', 说: 是中止 ? '模型调用超时' : String((error && error.message) || error).slice(0, 160) }
    } finally {
      clearTimeout(表)
    }
  }

  /** 问一次，要求返回 JSON；抠不出来就当失败 */
  // 2026-11-17：参数以前也叫「问」，把上面的函数名挡住了 → 报「问 is not a function」。
  const 问JSON = async (参 = {}) => {
    const 果 = await 问(参)
    if (!果.ok) return { ok: false, 值: null, 说: 果.说 }
    const 文 = 果.文本
    // 先试整段，再试第一个 { 到最后一个 }
    const 试 = [文]
    const 起 = 文.indexOf('{')
    const 止 = 文.lastIndexOf('}')
    if (起 >= 0 && 止 > 起) 试.push(文.slice(起, 止 + 1))
    for (const s of 试) {
      try { return { ok: true, 值: JSON.parse(s), 说: '' } } catch (error) {}
    }
    return { ok: false, 值: null, 说: '模型没返回能解析的 JSON' }
  }

  return { 有, 说, 问, 问JSON }
}
