// 语用回声 · 本地验证脚本（不开 DSH、不碰真档案）
//
// 拿假事件把「接住了 / 没接 / 被纠正 / 被打断」四条路都走一遍，
// 再算一次形状、拼一次注入，全过才算这块逻辑立住。
//
// 跑法：node tools/dev-echo-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建回声, 抽特征, 判回声, 算想聊 } from '../lib/echo.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

// ── 假事件工厂 ─────────────────────────────────────
const 助手 = (turn, 文) => ({
  type: 'assistant/message',
  data: {
    turn, step: 0,
    message: { id: 'm' + turn, role: 'assistant', source: { kind: 'model', provider: 'x', model: 'y' }, content: [{ type: 'text', text: 文 }] },
    stream: [],
  },
})
const 轮完 = (turn, kind = 'completed') => ({ type: 'turn/end', data: { turn, reason: { kind } } })
let 序号 = 0
const 用户 = (文, 源 = 'user') => ({
  type: 'user/message',
  data: { id: 'u' + (++序号), role: 'user', source: { kind: 源 }, content: [{ type: 'text', text: 文 }] },
})

const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-echo-'))
const 会 = { id: 'session-测试' }
const 情绪记录 = []
const 回声 = 建回声({
  根: 目录,
  称呼: ['老大', '蛋糕鱼'],
  记账: () => {},
  记情绪: (结果, 增量) => 情绪记录.push({ 结果, 增量 }),
})

说('== 抽特征 ==')
查('字数按字符算', () => { assert.equal(抽特征('老大好呀～').chars, 5) })
查('分三段', () => { assert.equal(抽特征('一\n\n二\n\n三').paragraphs, 3) })
查('认表情', () => { assert.equal(抽特征('好诶😊').emoji, true) })
查('认列点', () => { assert.equal(抽特征('我看了：\n1. 这个\n2. 那个').bullets, true) })
查('认称呼', () => { assert.equal(抽特征('老大吃饭没', { 称呼: ['老大'] }).address, '老大') })

说('== 判回声 ==')
查('马上接话算接住', () => { assert.equal(判回声('嗯嗯', 60000, 600000), 'continue') })
查('过了窗口算没接', () => { assert.equal(判回声('来了', 30 * 60000, 600000), 'silence') })
查('说了太长了算纠正', () => { assert.equal(判回声('太长了，短点', 60000, 600000), 'corrected') })
查('空话算没接', () => { assert.equal(判回声('', 1000, 600000), 'silence') })
查('追问算没答好', () => { assert.equal(判回声('还是没有重启呢', 60000, 600000, ''), 'pressed') })
查('带着兴趣接着问算想深入', () => { assert.equal(判回声('那如果换个写法呢', 60000, 600000, ''), 'curious') })
查('「什么意思」是好奇不是不满意', () => { assert.equal(判回声('什么意思呀', 60000, 600000, ''), 'curious') })
查('重复问同一件事也算', () => {
  assert.equal(判回声('你确定那台机器真的重启了', 60000, 600000, '那台机器真的重启了吗'), 'pressed')
})
查('短句重复不算追问', () => { assert.equal(判回声('好', 60000, 600000, '好'), 'continue') })

说('== 事件流 ==')
// 1. 接住了
回声.吃事件(会, 助手(1, '好呀老大，我这就去看看～'))
回声.吃事件(会, 轮完(1))
查('接住了记成 continue', () => { assert.equal(回声.吃事件(会, 用户('嗯嗯去吧')).outcome, 'continue') })

// 2. 没接（把上一条时间拨旧 31 分钟）
回声.吃事件(会, 助手(2, '这个我记下了。'))
回声.吃事件(会, 轮完(2))
回声.待回声.get('session-测试').at = Date.now() - 31 * 60000
查('过半小时才回记成 silence', () => { assert.equal(回声.吃事件(会, 用户('刚才说啥了')).outcome, 'silence') })

// 3. 被纠正
回声.吃事件(会, 助手(3, '这是一段很长的回复。'))
回声.吃事件(会, 轮完(3))
查('被纠正记成 corrected', () => { assert.equal(回声.吃事件(会, 用户('太长了，短点说')).outcome, 'corrected') })

// 4. 被打断
回声.吃事件(会, 助手(4, '还没说完呢…'))
查('被打断记成 interrupted', () => { assert.equal(回声.吃事件(会, 轮完(4, 'aborted')).outcome, 'interrupted') })

// 4.5 被追问（这一轮没答到点上）
回声.吃事件(会, 助手(9, '重启好了。'))
回声.吃事件(会, 轮完(9))
查('被追问记成 pressed', () => { assert.equal(回声.吃事件(会, 用户('还是没有重启呢')).outcome, 'pressed') })

// 5. 注入的上下文不算他的回话
回声.吃事件(会, 助手(5, '嗯。'))
回声.吃事件(会, 轮完(5))
查('runtime-context 不结算', () => { assert.equal(回声.吃事件(会, 用户('时间：22:00', 'runtime-context')), null) })
查('紧接着真回话才算', () => { assert.equal(回声.吃事件(会, 用户('那接着说')).outcome, 'continue') })

// 6. 主动找事注入的也不算
回声.吃事件(会, 助手(6, '我在想想。'))
回声.吃事件(会, 轮完(6))
查('idle 消息不结算', () => { assert.equal(回声.吃事件(会, 用户('（没人找你）', 'idle')), null) })

// 6.5 时间快照（time-context）也不算 —— 2026-11-01 实盘踩到的漏网之鱼
回声.吃事件(会, 助手(8, '嗯。'))
回声.吃事件(会, 轮完(8))
查('time-context 不结算', () => {
  assert.equal(回声.吃事件(会, 用户('Time sampled while preparing turn 8, step 1: 2026-11-01T22:00:00+08:00', 'time-context')), null)
})
查('来源没标的系统快照也被兜底挡掉', () => {
  assert.equal(回声.吃事件(会, 用户('Current runtime context. This snapshot supersedes earlier ...', 'user')), null)
})
查('挡完以后真回话照样算', () => { assert.equal(回声.吃事件(会, 用户('接着说')).outcome, 'continue') })

// 7. 同轮多段模型消息只留最后一段
回声.吃事件(会, 助手(7, '中间那段'))
回声.吃事件(会, 助手(7, '最后那段'))
查('同轮只留最后一段', () => { assert.ok(回声.待回声.get('session-测试').text.includes('最后那段')) })

说('== 落盘 ==')
const 反馈 = join(目录, 'style', 'feedback.jsonl')
查('feedback.jsonl 建出来了', () => { assert.ok(existsSync(反馈)) })
const 行们 = readFileSync(反馈, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
查('一共 7 条（第 7 轮没结算，不算）', () => { assert.equal(行们.length, 7) })
查('结局分布对', () => {
  const 数 = 行们.reduce((m, x) => { m[x.outcome] = (m[x.outcome] || 0) + 1; return m }, {})
  assert.deepEqual(数, { continue: 3, silence: 1, corrected: 1, pressed: 1, interrupted: 1 })
})
查('每条都带特征', () => { for (const x of 行们) assert.ok(x.features && x.features.chars > 0) })

说('== 情绪自己动 ==')
查('每次结算都推了一下心情', () => { assert.equal(情绪记录.length, 行们.length) })
查('被纠正会往下走', () => {
  const 条 = 情绪记录.find((x) => x.结果 === 'corrected')
  assert.ok(条 && 条.增量.valence < 0, '纠正应该让 valence 变负')
})
查('想深入会往上走', () => {
  const 条 = { 结果: 'curious', 增量: { valence: 0.04, arousal: 0.03 } }
  assert.ok(条.增量.valence > 0)
})

说('== 汇总 ==')
const 形 = 回声.汇总()
查('形状算出来了', () => { assert.ok(形 && 形.样本 === 7) })
查('中位字数是正数', () => { assert.ok(形.medianChars > 0) })
查('纠正数对得上', () => { assert.equal(形.结果.corrected, 1) })
查('合拍度算出来了且在 0–1 之间', () => { assert.ok(typeof 形.合拍 === 'number' && 形.合拍 >= 0 && 形.合拍 <= 1) })
查('我递话率也算出来了', () => { assert.ok(typeof 形.我递话率 === 'number' && 形.我递话率 >= 0 && 形.我递话率 <= 1) })
查('shape.json 落了盘', () => { assert.ok(existsSync(join(目录, 'style', 'shape.json'))) })

说('== 注入 ==')
const 注 = 回声.生成注入()
查('注入不是空的', () => { assert.ok(注.length > 0) })
查('注入提到称呼', () => { assert.ok(注.includes('老大')) })
查('注入提到被纠正过', () => { assert.ok(注.includes('纠正')) })
说('   文案：' + 注)

rmSync(目录, { recursive: true, force: true })
说('== 想不想说话 ==')
查('聊得顺就更想聊', () => {
  assert.ok(算想聊({ 好感: 65, 合拍: 0.7, 心情: 0.3 }) > 算想聊({ 好感: 65, 合拍: 0.2, 心情: -0.4 }))
})
查('心情很差也不会掉到零以下', () => {
  const x = 算想聊({ 好感: 0, 合拍: 0, 心情: -1 })
  assert.ok(x >= 0 && x <= 1)
})
查('结果总在 0–1', () => {
  for (const 好 of [0, 50, 100]) for (const 合 of [0, 0.5, 1]) for (const 心 of [-1, 0, 1]) {
    const x = 算想聊({ 好感: 好, 合拍: 合, 心情: 心 })
    assert.ok(x >= 0 && x <= 1, '越界了：' + x)
  }
})

说('== 等太久的回复（超时兜底）==')
const 会2 = { id: 'session-超时' }
回声.吃事件(会2, 助手(30, '说完了，等你回话。'))
回声.吃事件(会2, 轮完(30))
查('刚说完不急着结算', () => { assert.equal(回声.结算超时的().length, 0) })
回声.待回声.get('session-超时').at = Date.now() - 3 * 3600 * 1000
const 老的 = 回声.结算超时的()
查('三小时后当没接结算掉', () => {
  assert.equal(老的.length, 1)
  assert.equal(老的[0].outcome, 'silence')
})
查('结算完就清掉了', () => { assert.equal(回声.待回声.has('session-超时'), false) })

说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
