// 会话开关（主动找事做）· 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-sessions-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建会话本, 默认方向, 默认开着 } from '../lib/sessions.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-sessions-'))
const 本 = 建会话本({ 根: 目录, 记账: () => {} })
const 甲 = 'session-aaaaaaaa-0001'
const 乙 = 'session-bbbbbbbb-0002'
// 2026-11-11：会话 id 统一成不带 session- 前缀的（存盘和一览都是），这里跟着改
const 净 = (s) => String(s).replace(/^session-/, '')

本.记会话们([
  { id: 甲, title: '老大qq会话' },
  { id: 乙, title: '楉离' },
])

说('== 默认 ==')
查('默认值就是「开」', () => { assert.equal(默认开着, true) })
查('没设过的会话算开着', () => {
  assert.equal(本.开着(甲), true)
  assert.equal(本.开着(乙), true)
})
查('一览里每行都带「开着」', () => {
  const 表 = 本.一览()
  assert.equal(表.length, 2)
  assert.ok(表.every((x) => x.开着 === true))
  assert.ok(表.every((x) => x.方向 === 默认方向))
})

说('== 单独关掉一间 ==')
查('设开着(false) 返回 true', () => { assert.equal(本.设开着(甲, false), true) })
查('只有甲关了，乙还开着', () => {
  assert.equal(本.开着(甲), false)
  assert.equal(本.开着(乙), true)
})
查('一览里只有甲是关的', () => {
  const 表 = 本.一览()
  assert.equal(表.find((x) => x.id === 净(甲)).开着, false)
  assert.equal(表.find((x) => x.id === 净(乙)).开着, true)
})
查('关掉的落盘了（关闭数组里是去前缀的甲）', () => {
  const 盘 = JSON.parse(readFileSync(join(目录, 'behavior', 'sessions.json'), 'utf8'))
  assert.deepEqual(盘.关闭, [净(甲)])
})

说('== 和方向互不打扰 ==')
查('给甲选个平台，甲的开关还是关着', () => {
  本.设方向(甲, 'B站')
  assert.equal(本.方向(甲), 'B站')
  assert.equal(本.开着(甲), false)
})
查('乙的方向改了，乙的开关不受影响', () => {
  本.设方向(乙, '思考神游')
  assert.equal(本.方向(乙), '思考神游')
  assert.equal(本.开着(乙), true)
})

说('== 再打开 ==')
查('设开着(true) 又开了', () => {
  本.设开着(甲, true)
  assert.equal(本.开着(甲), true)
  const 盘 = JSON.parse(readFileSync(join(目录, 'behavior', 'sessions.json'), 'utf8'))
  assert.deepEqual(盘.关闭, [])
})
查('重复开也不会把关闭数组弄脏', () => {
  本.设开着(甲, true)
  本.设开着(甲, true)
  const 盘 = JSON.parse(readFileSync(join(目录, 'behavior', 'sessions.json'), 'utf8'))
  assert.deepEqual(盘.关闭, [])
})

说('== 边界 ==')
查('没给会话 id 就不动', () => { assert.equal(本.设开着('', false), false) })
查('没根（只读模式）也不动', () => {
  const 空本 = 建会话本({ 根: '' })
  assert.equal(空本.设开着(甲, false), false)
  assert.equal(空本.开着(甲), true)
})
查('老的 sessions.json（没有关闭字段）照样读得动', () => {
  const 目录2 = mkdtempSync(join(tmpdir(), 'fishkit-sessions-old-'))
  const 本2 = 建会话本({ 根: 目录2 })
  本2.记会话们([{ id: 甲, title: '旧的' }])
  assert.equal(本2.开着(甲), true)
  assert.equal(本2.设方向(甲, 'B站'), true)
  assert.equal(本2.开着(甲), true)
  rmSync(目录2, { recursive: true, force: true })
})

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
