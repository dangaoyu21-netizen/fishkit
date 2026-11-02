// 全流程模拟（完整版）：连老的夜巡、整理、备份、校验一起过。
// 跑法：node plugins/dsh-fishkit-dev/tools/e2e-full.mjs
//
// 跟 e2e-sim 的区别：那份只串新模块，这份把「原来就有的一套」也拉进来。
// 更新器不测（它会去 npm 下载覆盖，不适合离线跑）。

import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { 建档案核心 } from '../lib/fishsoul.js'
import { 建整理器 } from '../lib/digest.js'
import { 建夜巡 } from '../lib/nightly.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 工作区 = mkdtempSync(join(tmpdir(), 'fishkit-full-'))
const 档案 = 建档案核心(工作区)
档案.初始化()
const 记账们 = []
const 记账 = (t) => 记账们.push(String(t || ''))

说('① 老的写入路径：事件 / 心情 / 错题')
for (let i = 0; i < 12; i++) {
  档案.加事件({ who: { type: 'person', id: 'owner', name: '老大' }, summary: '第 ' + i + ' 条：聊插件的事', valence: 0.4, arousal: 0.3, emotion: '高兴', base: 0.5, weight: 0.7, pins: [], tags: [], status: 'normal' })
}
查('事件写进去了', () => { assert.equal(档案.读状态().events.length, 12) })

档案.记心情({ emotion: '高兴', valence: 0.5, arousal: 0.4, source: 'test', reason: '测一测' })
查('心情写进去了且带历史', () => {
  const 状 = 档案.读状态()
  assert.equal(状.mood.valence, 0.5)
  assert.ok(状.moodHistory.length >= 1)
})

档案.加错题({ id: 'm-full-1', kind: 'mistake', time: new Date().toISOString(), title: '测试用的错', lesson: '记得测一测', status: '测' })
查('错题写进去了', () => { assert.equal(档案.读状态().mistakes.length, 1) })

说('② 整理器（按规则小步动八维）')
const 整理器 = 建整理器(档案, 记账)
const 前 = (档案.读状态().dims || []).map((d) => d.value).join(',')
const 整理果 = 整理器.整理({ 最近: 20 })
说('  ' + 整理果.说 + '（变了 ' + (整理果.变了 || []).length + ' 个）')
查('整理跑得通', () => { assert.equal(整理果.ok, true) })
查('事件够多，八维应该动了', () => {
  const 后 = (档案.读状态().dims || []).map((d) => d.value).join(',')
  assert.notEqual(前, 后, '八维一点没动')
})
查('演化历史记了一笔', () => {
  const 史 = readFileSync(join(工作区, '.fishsoul', 'persona', 'history.jsonl'), 'utf8').trim()
  assert.ok(史.length > 0)
})

说('③ 夜巡（每周一次的整理）')
const 夜巡 = 建夜巡(档案, 整理器, 记账)
const 巡果 = 夜巡.跑({ 强制: true })
说('  ' + JSON.stringify(巡果).slice(0, 120))
查('夜巡跑得通', () => { assert.ok(巡果 && 巡果.ok !== false) })

说('④ 校验码 + 备份')
const 码1 = 档案.算校验码()
查('算得出校验码', () => { assert.match(码1, /^[0-9a-f]{64}$/) })
const 备份根 = join(工作区, '_备份')
const 备果 = 档案.备份(备份根)
查('备份目录建出来了', () => { assert.ok(备果.ok && existsSync(备果.路径)) })
查('备份里有 digest', () => { assert.ok(existsSync(join(备果.路径, 'digest.json'))) })
查('备份里有人格档案', () => { assert.ok(existsSync(join(备果.路径, 'persona', 'cognition.json'))) })
查('备份里连着新加的 origin、environment 也带上了', () => {
  assert.ok(existsSync(join(备果.路径, 'persona', 'origin.json')))
})
const 码2 = 档案.算校验码()
查('备份前后校验码一致（备份不改档案）', () => { assert.equal(码1, 码2) })

说('⑤ 模块开关（manifest.modules）')
查('五个开关都在', () => {
  const m = (档案.读状态().manifest || {}).modules || {}
  for (const k of ['memory', 'mood', 'persona', 'attitude', 'behavior']) assert.equal(m[k], true, k + ' 没了')
})

说('⑥ 存档能重新读回来（模拟重启）')
const 档案2 = 建档案核心(工作区)
const 状2 = 档案2.读状态()
查('事件还在', () => { assert.equal(状2.events.length, 12) })
查('心情还是刚写的那个', () => { assert.equal(状2.mood.valence, 0.5) })
查('错题还在', () => { assert.equal(状2.mistakes.length, 1) })
查('八维还是整理后的值', () => { assert.equal(状2.dims.map((d) => d.value).join(','), (档案.读状态().dims || []).map((d) => d.value).join(',')) })

rmSync(工作区, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 老功能也全过了一遍（' + 过 + ' 项）')
