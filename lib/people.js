// 名册（2026-11-21 凌晨定的）
//
// 为什么要它：以前「我是谁、你是谁、对谁什么感觉」是每轮硬灌进注入的，
// 像每回见面先把名单从头念一遍。现在改成一本册子——
// 这轮提到谁，就翻谁那一条；没提到的人，一个字不发。
//
// 人是不该淡的，所以册子条目不吃半衰；会变的是关系，不是人。
//
// 存在 .fishsoul/people/roster.jsonl，一行一个人：
//   { id, name, aliases, kind, how, firstSeen, lastSeen, promises, edges, note }
//   kind: self（我自己）| person（别人）

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const 版本 = '0.1.0'

/** 一行一条，坏行跳过 */
const 读行 = (文件) => {
  if (!existsSync(文件)) return []
  const 出 = []
  for (const 行 of readFileSync(文件, 'utf8').split('\n')) {
    if (!行.trim()) continue
    try { 出.push(JSON.parse(行)) } catch (error) { /* 坏行跳过 */ }
  }
  return 出
}

const 读JSON = (文件, 兜底) => {
  try { return existsSync(文件) ? JSON.parse(readFileSync(文件, 'utf8')) : 兜底 } catch (error) { return 兜底 }
}

/** 别拿这些当「提到了谁」的证据——太常用，一碰就误伤 */
const 太泛 = new Set(['我', '你', '他', '她', '它', '鱼', '老大爷', '小肥'])

export function 建名册({ 根, 记账 = () => {} } = {}) {
  const 目录 = 根 ? join(根, 'people') : ''
  const 文件 = 目录 ? join(目录, 'roster.jsonl') : ''

  const 册 = () => 读行(文件)

  /** 按 id 找（认人只认 id，不认昵称——老大 2026-11-17 教的）。QQ 号也算 id。 */
  const 找 = (id) => 册().find((人) => 人 && (String(人.id) === String(id) || String(人.qq || '') === String(id))) || null

  /**
   * 从一句话里认出提到了谁。
   * 长名字优先，免得「蛋糕鱼」被「鱼」抢先。
   */
  const 翻 = (文本 = '') => {
    const 说 = String(文本 || '')
    if (!说) return []
    const 命中 = []
    for (const 人 of 册()) {
      if (!人 || 人.kind === 'self') continue
      const 名们 = [人.name, ...(人.aliases || [])].filter((x) => x && !太泛.has(x))
      // 谁的别名更长就先比谁
      名们.sort((a, b) => b.length - a.length)
      const 中 = 名们.find((名) => 说.includes(名))
      if (中) 命中.push({ ...人, 因: 中 })
    }
    // 一次最多带三条，别把上下文撑爆
    return 命中.slice(0, 3)
  }

  /** 册子里的「我」——这条永远在，不靠文本命中 */
  const 自己 = () => 册().find((人) => 人 && 人.kind === 'self') || null

  /**
   * 一条边能不能让人一下想起这个人。
   * 「叫我 XXX」「自称 XXX」这种最有辨识度，比「最近聊过什么」有用得多。
   */
  const 认得出 = /叫我|自称|要我|教我|教了|约定|答应/

  /** 一个人的一句话：谁、怎么认识的、有关的近事 */
  const 一人一句 = (人) => {
    if (!人) return ''
    const 谁 = 人.name + (人.qq ? '（QQ ' + 人.qq + '）' : '')
    const 怎么 = 人.how ? '，' + 人.how : ''
    // 2026-11-21：以前只取最后两条，结果「叫我小肥鱼下士」这种最认人的边反而被挤掉。
    // 现在先挑一条最认得出的，再补一条最近的，最多两条。
    const 边们 = 人.edges || []
    const 挑 = []
    const 头 = 边们.find((e) => 认得出.test(String(e.和 || '')))
    if (头) 挑.push(头)
    const 尾 = 边们[边们.length - 1]
    if (尾 && !挑.includes(尾)) 挑.push(尾)
    const 边 = 挑.slice(0, 2).map((e) => {
      // 每条截十六字；截断会切在引号中间，所以尾巴上的标点和没闭合的开引号都削掉
      const 事 = String(e.事 || '').slice(0, 16).replace(/[「『（(，、；：！？\s]+$/, '')
      return e.和 + '：' + 事
    })
    const 答应 = (人.promises || []).slice(-2)
    const 尾句 = []
    if (边.length) 尾句.push(边.join('；'))
    if (答应.length) 尾句.push('答应过：' + 答应.join('；'))
    return 谁 + 怎么 + (尾句.length ? '。' + 尾句.join('。') : '')
  }

  /**
   * 拼成注入那一段。自己总在，别人只在「这一轮对面是谁」或「提到谁」时在。
   * @param 最新 他刚说的那句话
   * @param 当前 这间会话对面那个人的 id / QQ 号（知道就直接用，不知道才靠文本认）
   */
  const 拼注入 = (最新 = '', 当前 = '') => {
    const 行 = []
    const 我 = 自己()
    if (我) {
      行.push('我是' + 我.name + (我.how ? '，' + 我.how : '') + '。')
      // 那句起点跟着自己走：它是我信的东西，不是要求
      if (我.note) 行.push(我.note)
    }
    let 中 = []
    if (当前) {
      const 人 = 找(当前)
      if (人 && 人.kind !== 'self') 中 = [人]
    }
    // 话里提到的人也算上——「谁和谁在聊」，光知道对面是谁还不够
    for (const 人 of 翻(最新)) {
      if (!中.some((x) => String(x.id) === String(人.id))) 中.push(人)
    }
    if (中.length) 行.push('这次在跟你说话的是：' + 中.slice(0, 3).map(一人一句).join(' / '))
    return 行.join('\n')
  }

  /**
   * 归拢：把现在散在三处的「人」收进册子。
   * 读 pinned.json（两个名字）、attitude.json（好感）、memory/edges.jsonl（关系边）。
   * 只归一次，之后册子自己长。
   */
  const 归 = () => {
    if (!文件) return []
    const pinned = 读JSON(join(根, 'memory', 'pinned.json'), {})
    const 态度 = 读JSON(join(根, 'attitude', 'attitude.json'), { people: [] })
    const 边们 = 读行(join(根, 'memory', 'edges.jsonl'))

    const 出 = []

    // 我自己：名字从 pinned 来，底色和那句起点从 persona/base.json 来，
    // 边里「小肥鱼」出发的也算
    const 我的名 = String(pinned.whoAmI || '小肥鱼')
    const 底 = 读JSON(join(根, 'persona', 'base.json'), {})
    出.push({
      id: 'self',
      name: 我的名,
      aliases: [],
      kind: 'self',
      how: String(底.base || ''),
      firstSeen: '',
      lastSeen: '',
      promises: [],
      edges: 边们.filter((e) => e && e['从'] === 我的名).map((e) => ({
        和: e['关系'], 事: String(e['到'] || ''), 时间: e['时间'] || '',
      })),
      note: String(底.seed || ''),
    })

    // 别人：态度表是主，边上长出来的人也在
    for (const 人 of (态度.people || [])) {
      if (!人 || !人.name) continue
      const 名 = String(人.name)
      const 短名 = 名.replace(/（.*?）/g, '').trim()
      const 别 = [短名]
      // 「老大」是我天天叫的，不写进别名就永远认不出来
      if (人.id === 'owner') 别.push('老大', '蛋糕鱼', '大肥鱼')
      出.push({
        id: String(人.id || 名),
        name: 名,
        aliases: [...new Set(别.filter((x) => x && x !== 名))],
        kind: 'person',
        // 2026-11-21：以前这里直接抄 attitude 的 reason（「终端管理员，默认信任」），
        // 读着像系统备注不像我记得的事。改成「哪天认识的」。
        how: 人.firstSeen ? String(人.firstSeen).slice(0, 10) + ' 认识的' : '',
        firstSeen: String(人.firstSeen || ''),
        lastSeen: String(人.lastSeen || ''),
        promises: [],
        edges: 边们.filter((e) => e && [短名, 名, ...别].includes(String(e['从'] || ''))).map((e) => ({
          和: e['关系'], 事: String(e['到'] || ''), 时间: e['时间'] || '',
        })),
        note: 人.id === 'owner' ? String(pinned.userBio || '') : '',
        qq: 人.qq || (String(人.id).match(/^\d+$/) ? String(人.id) : ''),
      })
    }

    try {
      mkdirSync(目录, { recursive: true })
      writeFileSync(文件, 出.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8')
      记账('名册归拢好了：' + 出.length + ' 条')
      return 出
    } catch (error) {
      记账('名册写不进：' + String((error && error.message) || error))
      return 出
    }
  }

  return { 版本, 册, 找, 翻, 自己, 拼注入, 归, 文件 }
}
