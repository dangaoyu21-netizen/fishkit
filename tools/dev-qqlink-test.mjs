// 自己的 QQ 通道（开发板）· 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-qqlink-test.mjs

import assert from 'node:assert/strict'
import { 抽文字, 抽内容, 拼成话, 读私聊事件, 读群消息, 找会话, 找群会话, 有艾特我, 含关键字, 建通道, 绑定转文本, 文本转绑定, 默认WS } from '../lib/qqlink.js'

const 说 = (s) => process.stdout.write(s + '\n')
/** 群消息现在要攒几秒才送，测试里用短窗口 + 等一下 */
const 歇 = (ms = 40) => new Promise((r) => setTimeout(r, ms))
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

说('== 抽文字 ==')
查('字符串直接返回', () => { assert.equal(抽文字('你好'), '你好') })
查('段数组挑 text', () => {
  assert.equal(抽文字([{ type: 'text', data: { text: '在吗' } }, { type: 'image', data: {} }, { type: 'text', data: { text: '？' } }]), '在吗？')
})
查('不是数组也不是字符串就空着', () => { assert.equal(抽文字(null), '') })

说('== 认私聊 ==')
查('私聊认得出号码和文字', () => {
  const 果 = 读私聊事件({ post_type: 'message', message_type: 'private', user_id: 137843748, message: [{ type: 'text', data: { text: '在不在' } }] }, 3968799683)
  assert.ok(果)
  assert.equal(果.号码, 137843748)
  assert.equal(果.文字, '在不在')
})
查('群消息不认', () => {
  assert.equal(读私聊事件({ post_type: 'message', message_type: 'group', user_id: 1, raw_message: 'x' }, 0), null)
})
查('自己发的不算', () => {
  assert.equal(读私聊事件({ post_type: 'message', message_type: 'private', user_id: 9, raw_message: 'x' }, 9), null)
})
查('空消息不算', () => {
  assert.equal(读私聊事件({ post_type: 'message', message_type: 'private', user_id: 9, message: [] }, 0), null)
})
查('不是消息事件不算', () => {
  assert.equal(读私聊事件({ post_type: 'notice' }, 0), null)
})

说('== 找会话 ==')
const 绑定 = [
  { 类型: '私聊', 号码: '137843748', 会话: 'session-aaa' },
  { 类型: '私聊', 号码: '248551590', 会话: 'session-bbb' },
]
查('按号码找到那间', () => {
  assert.equal(找会话(绑定, 137843748), 'session-aaa')
  assert.equal(找会话(绑定, '248551590'), 'session-bbb')
})
查('没绑的返回空', () => { assert.equal(找会话(绑定, 123), '') })

说('== 一条消息进来 ==')
const 送去 = []
const 日志 = []
const 通道 = 建通道({
  读配置: () => ({ WS地址: 默认WS, 绑定 }),
  记账: (t) => 日志.push(t),
  送话: async (会话, 文字) => { 送去.push({ 会话, 文字 }) },
  自己号: () => 3968799683,
})
await 通道.收事件({ post_type: 'message', message_type: 'private', user_id: 137843748, message: [{ type: 'text', data: { text: '在吗' } }] })
await 通道.收事件({ post_type: 'message', message_type: 'private', user_id: 999, message: [{ type: 'text', data: { text: '陌生人' } }] })
查('该进的会话收到了', () => {
  assert.equal(送去.length, 1)
  assert.equal(送去[0].会话, 'session-aaa')
  assert.equal(送去[0].文字, '在吗')
})
查('没绑定的被跳过，还记了一笔', () => {
  assert.ok(日志.some((x) => x.includes('没绑定')))
})

说('== 群消息 ==')
查('不带 @ 的群消息不算叫我', () => {
  const 果 = 读群消息({ post_type: 'message', message_type: 'group', group_id: 123, user_id: 9, message: [{ type: 'text', data: { text: '今天好热' } }] }, 3968799683)
  assert.ok(果)
  assert.equal(果.艾特我, false)
})
查('@ 我的才算', () => {
  const 果 = 读群消息({
    post_type: 'message', message_type: 'group', group_id: 123, user_id: 9,
    message: [{ type: 'at', data: { qq: '3968799683' } }, { type: 'text', data: { text: ' 在吗' } }],
  }, 3968799683)
  assert.equal(果.艾特我, true)
  assert.equal(果.文字, '在吗')
})
查('按群号找到会话', () => {
  assert.equal(找群会话([{ 类型: '群', 号码: '123', 会话: 'session-g' }], 123), 'session-g')
  assert.equal(找群会话([{ 类型: '群', 号码: '123', 会话: 'session-g' }], 999), '')
})

说('== 去重 ==')
const 二次 = []
const 通道2 = 建通道({
  读配置: () => ({ 绑定: [{ 类型: '私聊', 号码: '137843748', 会话: 'session-aaa' }] }),
  记账: () => {},
  送话: async (会话, 文字) => { 二次.push(文字) },
  自己号: () => 3968799683,
})
const 同一条 = { post_type: 'message', message_type: 'private', user_id: 137843748, message: [{ type: 'text', data: { text: '在吗' } }] }
await 通道2.收事件(同一条)
await 通道2.收事件(同一条)
查('同一句话五秒内只送一次', () => { assert.equal(二次.length, 1) })

说('== 群消息进会话 ==')
const 群送 = []
const 通道3 = 建通道({
  读配置: () => ({ 绑定: [{ 类型: '群', 号码: '123', 会话: 'session-g' }] }),
  记账: () => {},
  送话: async (会话, 文字) => { 群送.push({ 会话, 文字 }) },
  自己号: () => 3968799683,
  群缓冲毫秒: 20,
})
await 通道3.收事件({ post_type: 'message', message_type: 'group', group_id: 123, user_id: 9, message: [{ type: 'text', data: { text: '今天好热' } }] })
await 歇()
查('没 @ 我，不吵', () => { assert.equal(群送.length, 0) })
await 通道3.收事件({
  post_type: 'message', message_type: 'group', group_id: 123, user_id: 9,
  message: [{ type: 'at', data: { qq: '3968799683' } }, { type: 'text', data: { text: ' 在吗' } }],
})
await 歇()
查('@ 了我就送进去，还带了是谁在哪个群', () => {
  assert.equal(群送.length, 1)
  assert.equal(群送[0].会话, 'session-g')
  assert.ok(群送[0].文字.includes('群 123'))
})

说('== 图片 ==')
查('文字和图片分开抽', () => {
  const 果 = 抽内容([{ type: 'text', data: { text: '看这个' } }, { type: 'image', data: { url: 'http://x/y.jpg' } }])
  assert.equal(果.文字, '看这个')
  assert.deepEqual(果.图们, ['http://x/y.jpg'])
})
查('只有图没文字也算一条消息', () => {
  const 果 = 读私聊事件({ post_type: 'message', message_type: 'private', user_id: 1, message: [{ type: 'image', data: { url: 'http://x/z.jpg' } }] }, 0)
  assert.ok(果)
  assert.equal(果.图们.length, 1)
})
查('拼成话会带上图片地址', () => {
  const 话 = 拼成话('看这个', ['http://x/y.jpg'])
  assert.ok(话.includes('看这个') && 话.includes('http://x/y.jpg'))
})

说('== 手动填绑定 ==')
查('绑定转成一行一条', () => {
  const 文本 = 绑定转文本([{ 类型: '私聊', 号码: '137843748', 会话: 'session-aaa', 称呼: '老大' }])
  assert.equal(文本, '私聊|137843748|session-aaa|老大')
})
查('文本转回绑定', () => {
  const 绑定 = 文本转绑定('私聊|137843748|session-aaa|老大\n群|123456|session-bbb|群里的人')
  assert.equal(绑定.length, 2)
  assert.equal(绑定[0].类型, '私聊')
  assert.equal(绑定[1].类型, '群')
  assert.equal(绑定[1].会话, 'session-bbb')
})
查('空行、缺号码、缺会话的都丢掉', () => {
  assert.equal(文本转绑定('\n\n私聊|123|   \n|||\n好的').length, 0)
})
查('转一圈还是原来那条', () => {
  const 原 = [{ 类型: '群', 号码: '123', 会话: 'session-x', 称呼: '群友' }]
  const 回 = 文本转绑定(绑定转文本(原))
  assert.equal(回.length, 1)
  assert.equal(回[0].号码, '123')
  assert.equal(回[0].会话, 'session-x')
})

说('== 关键字唤醒 ==')
查('提到关键字也算叫我', () => { assert.equal(含关键字('今天聊聊插件吧', ['插件', '重启']), true) })
查('没提到就不算', () => { assert.equal(含关键字('今天好热', ['插件']), false) })

const 关键送 = []
const 通道4 = 建通道({
  读配置: () => ({ 绑定: [{ 类型: '群', 号码: '123', 会话: 'session-g' }] }),
  取关键字: () => ['插件', '小肥鱼'],
  记账: () => {},
  送话: async (会话, 文字) => { 关键送.push(文字) },
  自己号: () => 3968799683,
  群缓冲毫秒: 20,
})
await 通道4.收事件({
  post_type: 'message', message_type: 'group', group_id: 123, user_id: 9, group_name: '测试群',
  sender: { nickname: '小明' },
  message: [{ type: 'text', data: { text: '聊聊插件' } }],
})
await 歇()
查('带关键字的群消息也转进去，还带了群名和昵称', () => {
  assert.equal(关键送.length, 1)
  assert.ok(关键送[0].includes('测试群'), 关键送[0])
  assert.ok(关键送[0].includes('小明'), 关键送[0])
})

说('== 语音 / 卡片 / 转发 ==')
查('语音认得出', () => {
  const 果 = 抽内容([{ type: 'record', data: { url: 'http://x/a.amr' } }])
  assert.equal(果.语音们.length, 1)
})
查('分享卡片的原文留着', () => {
  const 果 = 抽内容([{ type: 'json', data: { data: '{"prompt":"这是一条卡片"}' } }])
  assert.ok(果.卡们[0].includes('卡片'), JSON.stringify(果.卡们))
})
查('合并转发认得出', () => {
  const 果 = 抽内容([{ type: 'forward', data: { id: 'abc' } }])
  assert.equal(果.转发们.length, 1)
})
查('拼成话会写上有语音、有卡片', () => {
  const 话 = 拼成话('听这个', [], { 语音们: ['http://x/a.amr'], 卡们: ['标题'] })
  assert.ok(话.includes('语音'), 话)
  assert.ok(话.includes('分享卡片'), 话)
})

说('== 门槛：聊开了的那五分钟 ==')
const 门槛送 = []
const 通道5 = 建通道({
  读配置: () => ({ 绑定: [{ 类型: '群', 号码: '123', 会话: 'session-g' }], 门槛: true, 窗口分钟: 5 }),
  取关键字: () => ['小肥鱼'],
  记账: () => {},
  送话: async (会话, 文字) => { 门槛送.push(文字) },
  自己号: () => 3968799683,
  群缓冲毫秒: 20,
})
await 通道5.收事件({ post_type: 'message', message_type: 'group', group_id: 123, user_id: 9, sender: { nickname: '小明' }, message: [{ type: 'text', data: { text: '今天好热' } }] })
await 歇()
查('没叫我的，窗口没开时不理', () => { assert.equal(门槛送.length, 0) })
await 通道5.收事件({ post_type: 'message', message_type: 'group', group_id: 123, user_id: 9, sender: { nickname: '小明' }, message: [{ type: 'at', data: { qq: '3968799683' } }, { type: 'text', data: { text: ' 在吗' } }] })
await 歇()
查('叫到我，窗口开了', () => { assert.equal(门槛送.length, 1) })
await 通道5.收事件({ post_type: 'message', message_type: 'group', group_id: 123, user_id: 8, sender: { nickname: '小红' }, message: [{ type: 'text', data: { text: '我也觉得好热' } }] })
await 歇()
查('窗口里没叫我的也放进去，还带了提示', () => {
  assert.equal(门槛送.length, 2, '送进去 ' + 门槛送.length + ' 条')
  assert.ok(门槛送[1].includes('没 @ 你'), 门槛送[1])
})

说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')


