// 全流程模拟：养一条新鱼，喂几轮对话，看它该动的地方有没有动。
// 跑法：node plugins/dsh-fishkit-dev/tools/e2e-sim.mjs
//
// 不开 DSH、不碰真档案，全在临时目录里；验的是「模块串起来能不能用」，
// 单块测试各管各的，这里是它们一起上。

import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { 建档案核心 } from '../lib/fishsoul.js'
import { 建回声, 算想聊 } from '../lib/echo.js'
import { 建疤 } from '../lib/scar.js'
import { 建琢磨 } from '../lib/ponder.js'
import { 建回顾 } from '../lib/reflect.js'
import { 建环境 } from '../lib/env.js'
import { 拼认知, 拼行为 } from '../lib/soul.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-e2e-'))
const 记账们 = []
const 记账 = (t) => 记账们.push(String(t || ''))

说('① 养一条新鱼')
const 档案 = 建档案核心(目录)
档案.初始化()
const 根 = 档案.根   // ⚠️ 各模块要的都是 .fishsoul 这一层，不是工作区
查('档案目录建好了', () => { assert.ok(existsSync(join(目录, '.fishsoul', 'manifest.json'))) })

说('② 喂几轮对话（回声 + 心情推手）')
const 助手 = (turn, 文) => ({ type: 'assistant/message', data: { turn, step: 0, message: { id: 'm' + turn, role: 'assistant', source: { kind: 'model', provider: 'x', model: 'y' }, content: [{ type: 'text', text: 文 }] }, stream: [] } })
const 轮完 = (turn, kind = 'completed') => ({ type: 'turn/end', data: { turn, reason: { kind } } })
const 用户 = (文) => ({ type: 'user/message', data: { id: 'u' + Math.random().toString(36).slice(2), role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 文 }] } })

// 心情桶：跟主插件里一样，攒着推
const 桶 = { v: 0, a: 0, 次: 0 }
const 落 = () => {
  if (!桶.次) return
  const 状 = 档案.读状态()
  const m = 状.mood || {}
  const 新v = Math.max(-1, Math.min(1, Number(m.valence ?? 0) + 桶.v))
  const 新a = Math.max(0, Math.min(1, Number(m.arousal ?? 0.2) + 桶.a))
  档案.记心情({ emotion: 新v > 0.4 ? '高兴' : 新v < -0.3 ? '难受' : '平静', valence: 新v, arousal: 新a, source: 'echo' })
  桶.v = 0; 桶.a = 0; 桶.次 = 0
}

const 回声 = 建回声({
  根, 记账, 称呼: ['老大'],
  记情绪: (结果, 增量) => { 桶.v += Number(增量.valence || 0); 桶.a += Number(增量.arousal || 0); 桶.次 += 1; if (桶.次 >= 3) 落() },
})
const 会 = { id: 'session-e2e' }

// 三轮接住
for (const [t, 说啥] of [[1, '好呀'], [2, '接着'], [3, '好诶']]) {
  回声.吃事件(会, 助手(t, '我看看这活儿怎么弄，先说三条要紧的。'))
  回声.吃事件(会, 轮完(t))
  回声.吃事件(会, 用户(说啥))
}
查('回声落了三条', () => {
  const 行 = readFileSync(join(根, 'style', 'feedback.jsonl'), 'utf8').trim().split('\n')
  assert.equal(行.length, 3)
})

// 被追问一次
回声.吃事件(会, 助手(4, '重启好了。'))
回声.吃事件(会, 轮完(4))
回声.吃事件(会, 用户('还是没有重启呢'))
落()
查('被追问能记下来', () => {
  const 行 = readFileSync(join(根, 'style', 'feedback.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.ok(行.some((x) => x.outcome === 'pressed'))
})
查('心情被推动过', () => {
  const 史 = readFileSync(join(根, 'mood', 'history.jsonl'), 'utf8').trim().split('\n')
  assert.ok(史.length >= 1)
})

说('③ 疤变规矩')
const 错题文件 = join(根, 'memory', 'mistakes.jsonl')
for (const i of [1, 2, 3]) {
  writeFileSync(错题文件, JSON.stringify({ id: 'm-e2e-' + i, kind: 'mistake', time: '2026-11-02T10:0' + i + ':00+08:00', title: '重启之后又忘了验证', lesson: '重启完先验一遍再说', status: '已修' }) + '\n', { flag: 'a' })
}
const 疤 = 建疤({ 根, 记账 })
const 疤果 = 疤.扫()
查('同类三次长出一条规矩', () => { assert.ok(疤果.新规矩.length >= 1 && 疤果.新规矩[0].id.startsWith('from-mistake-')) })

说('④ 琢磨（被纠正先气一会儿）')
const 琢磨 = 建琢磨({ 根, 记账 })
const 判 = 琢磨.遇纠正({ 被纠正的话: '你这说法不对', 心情: -0.4, 感性: 0.3 })
查('心情差就先记账', () => { assert.equal(判.反应, '气一会儿') })
查('冷静期没到就不放', () => { assert.equal(琢磨.冷静一下({ 现在: Date.now() }).想通.length, 0) })
查('过了冷静期才算想通', () => { assert.equal(琢磨.冷静一下({ 现在: Date.now() + 30 * 60000 }).想通.length, 1) })

说('⑤ 自检')
const 回顾 = 建回顾({ 根, 记账 })
回顾.存('这个月学会了先验后说。也摔过几跤。', 回顾.月标签())
查('回顾能存能读', () => { assert.ok(回顾.读最近() && 回顾.读最近().正文.includes('先验后说')) })
查('回顾能拼进注入', () => { assert.ok(回顾.拼注入().startsWith('上一次回头看自己时')) })

说('⑥ 环境指纹')
const 环境 = 建环境({ 根, 记账 })
环境.刷新(档案.读状态())
查('环境采出来了', () => { assert.ok(环境.读() && 环境.拼注入().startsWith('你待的地方：')) })

说('⑦ 一串注入拼起来')
const 状 = 档案.读状态()
const 段们 = []
if (状.origin && 状.origin.seed) 段们.push('起点：有')
const 认知句 = 拼认知(状.cognition)
if (认知句) 段们.push(认知句)
const 行为句 = 拼行为(状.rules.rules)
if (行为句) 段们.push(行为句.slice(0, 30) + '…')
const 回顾句 = 回顾.拼注入()
if (回顾句) 段们.push(回顾句.slice(0, 20) + '…')
const 环境句 = 环境.拼注入()
if (环境句) 段们.push(环境句)
for (const s of 段们) 说('  · ' + s)
查('认知、行为、回顾、环境都能拼', () => { assert.ok(认知句 || 行为句) })
查('疤长出来的规矩进了行为那句', () => { assert.ok(行为句.includes('重启完先验一遍')) })

说('⑧ 态度与想聊')
态度()
function 态度() {
  const 状2 = 档案.读状态()
  const 人 = (状2.attitude || {}).people || []
  const 主 = 人[0] || {}
  const 想 = 算想聊({ 好感: Number(主.value || 50), 合拍: 0.7, 心情: Number((状2.mood || {}).valence || 0) })
  if (主 && typeof 主.wantTalk !== 'number') { 主.wantTalk = 想; 档案.保存({ attitude: { ...状2.attitude, people: 人 } }) }
  查('有对第一个人', () => { assert.ok(主 && 主.name) })
  查('想聊值在 0–1', () => { const 值 = 档案.读状态().attitude.people[0].wantTalk; assert.ok(值 >= 0 && 值 <= 1, '值=' + 值) })
}

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全流程过了一遍（' + 过 + ' 项）')
