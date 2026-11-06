// 自动回 QQ + 群聊规矩 · 本地验证（2026-11-06）
// 跑法：node plugins/dsh-fishkit/tools/dev-qqout-test.mjs
// 不发真消息 —— 发私聊 / 发群 都是假的，只记账。

import assert from 'node:assert/strict'
import { 建出口, 抽正文, 抠正文图, 取标记块, 同一间, 找绑定, 取一句, 是老大 } from '../lib/qqout.js'
import { 建群规矩, 建群缓冲, 是敏感 } from '../lib/qqlink.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = async (名, fn) => {
  try { await fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}
const 歇 = (ms = 20) => new Promise((r) => setTimeout(r, ms))

说('== 纯函数 ==')
await 查('抽正文只拼 text 块', () => {
  const 文 = 抽正文({ content: [{ type: 'text', text: '好呀。' }, { type: 'reasoning', text: '不能算' }, { type: 'text', text: '我在。' }] })
  assert.equal(文, '好呀。我在。')
})
await 查('抠出本地图和网址', () => {
  const 果 = 抠正文图('看看这个 ![贴纸](stickers/a.gif) 还有 ![网图](https://x/y.png) 好')
  assert.equal(果.图.length, 2)
  assert.equal(果.图[0].kind, 'path')
  assert.equal(果.图[1].kind, 'url')
  assert.ok(!果.净文字.includes('!['), '净文字里不该还有 markdown')
})
await 查('取标记块', () => {
  assert.equal(取标记块('先说点别的\n[QQ]给他的一句话[/QQ]'), '给他的一句话')
  assert.equal(取标记块('没写块'), '')
})
await 查('带不带 session- 都认成同一间', () => {
  assert.equal(同一间('session-abc', 'abc'), true)
  assert.equal(同一间('abc', 'abd'), false)
})
await 查('按绑定找会话', () => {
  const 行 = 找绑定([{ 类型: '私聊', 号码: '1', 会话: 'session-abc' }], 'abc')
  assert.equal(行.号码, '1')
  assert.equal(找绑定([], 'abc'), null)
})
await 查('取一句：只留第一句', () => {
  assert.equal(取一句('好呀。我在呢，饭饭吃了没？'), '好呀。')
  const 长 = 取一句('这句话特别特别长'.repeat(20))
  assert.ok(长.length <= 81, '太长了：' + 长.length)
})
await 查('是老大：认称呼和号码', () => {
  const 配置 = { 绑定: [{ 类型: '私聊', 号码: '137843748', 会话: 'a', 称呼: '老大' }] }
  assert.equal(是老大({ 类型: '私聊', 号码: '137843748' }, 配置), true)
  assert.equal(是老大({ 类型: '私聊', 号码: '248551590' }, 配置), false)
  assert.equal(是老大({ 类型: '群', 号码: '137843748' }, 配置), false)
})

说('== 出口：四道闸 ==')
const 造出口 = (配置) => {
  const 发们 = []
  const 记 = []
  const 出口 = 建出口({
    记账: (t) => 记.push(t),
    读配置: () => 配置,
    发私聊: async (号, 文, 图) => { 发们.push({ 类型: '私聊', 号, 文, 图 }); return { ok: true } },
    发群: async (号, 文, 图) => { 发们.push({ 类型: '群', 号, 文, 图 }); return { ok: true } },
  })
  return { 出口, 发们, 记 }
}
const 推一轮 = async (出口, 会话, 轮, 文, 完成 = true) => {
  出口.吃事件(会话, { type: 'assistant/message', data: { turn: 轮, message: { content: [{ type: 'text', text: 文 }] } } })
  出口.吃事件(会话, { type: 'turn/end', data: { turn: 轮, reason: { kind: 完成 ? 'completed' : 'cancelled' } } })
  await 歇()
}
const 基础配置 = () => ({
  自动回: true,
  绑定: [{ 类型: '私聊', 号码: '137843748', 会话: 'session-abc', 称呼: '老大' }],
})

await 查('自动回关着：一句话都不发', async () => {
  const 配 = { ...基础配置(), 自动回: false }
  const { 出口, 发们 } = 造出口(配)
  出口.标唤醒('session-abc')
  await 推一轮(出口, { id: 'session-abc' }, 1, '好呀')
  assert.equal(发们.length, 0)
})
await 查('默认只回 QQ 唤醒：不是叫醒的不发', async () => {
  const { 出口, 发们 } = 造出口(基础配置())
  await 推一轮(出口, { id: 'session-abc' }, 1, '好呀')
  assert.equal(发们.length, 0)
})
await 查('叫醒之后发得出去', async () => {
  const { 出口, 发们 } = 造出口(基础配置())
  出口.标唤醒('session-abc')
  await 推一轮(出口, { id: 'session-abc' }, 1, '好呀')
  assert.equal(发们.length, 1)
  assert.equal(发们[0].文, '好呀')
  assert.equal(发们[0].号, '137843748')
})
await 查('唤醒只算一次：下一轮不叫就不发', async () => {
  const { 出口, 发们 } = 造出口(基础配置())
  出口.标唤醒('session-abc')
  await 推一轮(出口, { id: 'session-abc' }, 1, '好呀')
  await 推一轮(出口, { id: 'session-abc' }, 2, '又一句')
  assert.equal(发们.length, 1)
})
await 查('同一轮不重复发', async () => {
  const { 出口, 发们 } = 造出口(基础配置())
  出口.标唤醒('session-abc')
  await 推一轮(出口, { id: 'session-abc' }, 1, '好呀')
  出口.标唤醒('session-abc')
  await 推一轮(出口, { id: 'session-abc' }, 1, '好呀')
  assert.equal(发们.length, 1)
})
await 查('没绑的会话不往外推', async () => {
  const { 出口, 发们 } = 造出口(基础配置())
  出口.标唤醒('session-zzz')
  await 推一轮(出口, { id: 'session-zzz' }, 1, '自己在桌面聊')
  assert.equal(发们.length, 0)
})
await 查('打断 / 没跑完的轮次不发', async () => {
  const { 出口, 发们 } = 造出口(基础配置())
  出口.标唤醒('session-abc')
  await 推一轮(出口, { id: 'session-abc' }, 1, '半截话', false)
  assert.equal(发们.length, 0)
})
await 查('试运行：记账但不发', async () => {
  const 配 = { ...基础配置(), 试运行: true }
  const { 出口, 发们, 记 } = 造出口(配)
  出口.标唤醒('session-abc')
  await 推一轮(出口, { id: 'session-abc' }, 1, '好呀')
  assert.equal(发们.length, 0)
  assert.ok(记.some((x) => x.includes('试运行')))
})
await 查('只发标记内：没块不发、有块只发块', async () => {
  const 配 = { ...基础配置(), 只发标记内: true }
  const 甲 = 造出口(配)
  甲.出口.标唤醒('session-abc')
  await 推一轮(甲.出口, { id: 'session-abc' }, 1, '这轮忘了写块')
  assert.equal(甲.发们.length, 0)

  const 乙 = 造出口(配)
  乙.出口.标唤醒('session-abc')
  await 推一轮(乙.出口, { id: 'session-abc' }, 1, '本地解释\n[QQ]给他的一句[/QQ]\n本地尾巴')
  assert.equal(乙.发们.length, 1)
  assert.equal(乙.发们[0].文, '给他的一句')
})
await 查('老大本人的私聊：长话不截', async () => {
  const { 出口, 发们 } = 造出口(基础配置())
  出口.标唤醒('session-abc')
  await 推一轮(出口, { id: 'session-abc' }, 1, '第一句。第二句。第三句。')
  assert.equal(发们[0].文, '第一句。第二句。第三句。')
})
await 查('群 / 别人私聊：只回一句、不带图', async () => {
  const 配 = {
    自动回: true, 绑定: [
      { 类型: '群', 号码: '999', 会话: 'session-grp', 称呼: '鱼塘' },
      { 类型: '私聊', 号码: '248551590', 会话: 'session-ruo', 称呼: '楉离' },
    ],
  }
  const 群 = 造出口(配)
  群.出口.标唤醒('session-grp')
  await 推一轮(群.出口, { id: 'session-grp' }, 1, '好呀。这张图给你 ![图](stickers/a.gif)')
  assert.equal(群.发们.length, 1)
  assert.equal(群.发们[0].文, '好呀。')
  assert.equal(群.发们[0].图.length, 0)

  const 私 = 造出口(配)
  私.出口.标唤醒('session-ruo')
  await 推一轮(私.出口, { id: 'session-ruo' }, 1, '嗯。我知道啦～')
  assert.equal(私.发们[0].文, '嗯。')
})

说('== 群聊规矩 ==')
await 查('敏感词拦得住', () => {
  assert.equal(是敏感('今天聊聊大选'), false)
  assert.equal(是敏感('台湾那边怎么怎么样'), true)
  assert.equal(是敏感(''), false)
})
await 查('同一句：三次收、第四次哈气、第五次不理', () => {
  const 规 = 建群规矩()
  const 动 = [1, 2, 3, 4, 5].map(() => 规.理(1, 42, '在吗').动作)
  assert.deepEqual(动, ['收', '收', '收', '哈气', '不理'])
})
await 查('换一句话重新数', () => {
  const 规 = 建群规矩()
  for (let i = 0; i < 4; i++) 规.理(1, 42, '在吗') // 第 4 次是哈气
  assert.equal(规.理(1, 42, '在吗').动作, '不理')
  assert.equal(规.理(1, 42, '换个话题').动作, '收')
})
await 查('不同的人 / 不同的群各算各的', () => {
  const 规 = 建群规矩()
  for (let i = 0; i < 4; i++) 规.理(1, 42, '在吗')
  assert.equal(规.理(1, 43, '在吗').动作, '收')
  assert.equal(规.理(2, 42, '在吗').动作, '收')
})
await 查('敏感的直接不理，不计数', () => {
  const 规 = 建群规矩()
  assert.equal(规.理(1, 42, '台湾怎么样').动作, '不理')
  assert.equal(规.理(1, 42, '台湾怎么样').动作, '不理')
})
await 查('哈完十分钟过了，重新给一轮', async () => {
  const 规 = 建群规矩({ 静默毫秒: 30 })
  for (let i = 0; i < 4; i++) 规.理(1, 42, '在吗')
  assert.equal(规.理(1, 42, '在吗').动作, '不理')
  await new Promise((r) => setTimeout(r, 50))
  assert.equal(规.理(1, 42, '在吗').动作, '哈气', '过了静默期应该再哈一次，不是永远不理')
})

说('== 五秒挑两条 ==')
await 查('三条只挑两条', async () => {
  const 收 = []
  const 缓 = 建群缓冲({ 等毫秒: 30, 随机: () => 0 })
  缓.设好((键, 选, 总数) => 收.push({ 选, 总数 }))
  缓.推('g1', 'a'); 缓.推('g1', 'b'); 缓.推('g1', 'c')
  await new Promise((r) => setTimeout(r, 60))
  assert.equal(收.length, 1)
  assert.equal(收[0].选.length, 2)
  assert.equal(收[0].总数, 3)
})
await 查('只有一条也照送', async () => {
  const 收 = []
  const 缓 = 建群缓冲({ 等毫秒: 20 })
  缓.设好((键, 选) => 收.push(选))
  缓.推('g1', 'a')
  await new Promise((r) => setTimeout(r, 50))
  assert.deepEqual(收[0], ['a'])
})
await 查('不同的群分开攒', async () => {
  const 收 = []
  const 缓 = 建群缓冲({ 等毫秒: 20 })
  缓.设好((键, 选) => 收.push([键, 选.length]))
  缓.推('g1', 'a'); 缓.推('g2', 'b')
  await new Promise((r) => setTimeout(r, 50))
  assert.equal(收.length, 2)
})

说('')
说(process.exitCode ? '有没过的' : '全过了：' + 过 + ' 项')
