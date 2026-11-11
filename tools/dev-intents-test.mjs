// 意图本 · 本地验证（2026-11-11）
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-intents-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建意图本 } from '../lib/intents.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-intents-'))
const 本 = 建意图本({ 根: 目录 })

说('== 空的时候 ==')
查('没写过意图，挑一条是空的', () => {
  const r = 本.挑一条()
  assert.equal(r.歇着, false)
  assert.equal(r.条, null)
})
查('没写过时 一句话 是空串', () => { assert.equal(本.一句话(), '') })

说('== 写和读 ==')
const 甲 = 本.记({ 想做什么: '把切图接进看图流程', 为什么: '省得每次手动喊' })
const 乙 = 本.记({ 想做什么: '看看环世界 RIMAPI 能不能连上' })
查('记返回了一条带 id 的', () => {
  assert.ok(甲 && 甲.id)
  assert.equal(甲.状态, '想做')
})
查('读得到两条', () => { assert.equal(本.读().length, 2) })
查('想做什么空的不记', () => { assert.equal(本.记({ 想做什么: '   ' }), null) })

说('== 挑哪条 ==')
查('先挑写在前面的那条', () => {
  const r = 本.挑一条()
  assert.equal(r.条.id, 甲.id)
})
查('挑完还没动过，还是同一条', () => {
  assert.equal(本.挑一条().条.id, 甲.id)
})

说('== 标状态 ==')
查('标成做完了，结果也写进去了', () => {
  assert.equal(本.标(甲.id, '做完了', '接上了，自动切'), true)
  const 条 = 本.读().find((x) => x.id === 甲.id)
  assert.equal(条.状态, '做完了')
  assert.equal(条.结果, '接上了，自动切')
})
查('标完再挑，轮到第二条', () => {
  assert.equal(本.挑一条().条.id, 乙.id)
})
查('标不存在的 id 返回 false', () => { assert.equal(本.标('int-不存在', '做完了'), false) })
查('状态写错就当归「想做」', () => {
  本.标(乙.id, '乱写的状态')
  assert.equal(本.读().find((x) => x.id === 乙.id).状态, '想做')
})

说('== 不想动 ==')
查('写了「不想动」，今天就歇着', () => {
  const 歇 = 本.记({ 想做什么: '今天不想动', 为什么: '累了' })
  本.标(歇.id, '不想动')
  const r = 本.挑一条()
  assert.equal(r.歇着, true)
  assert.equal(r.条, null)
})
查('明天还歇着吗——不歇（按日期算）', () => {
  const 明天 = new Date(Date.now() + 24 * 3600 * 1000)
  const r = 本.挑一条(明天)
  assert.equal(r.歇着, false)
})

说('== 一句话 ==')
查('一句话带上件数', () => {
  const 话 = 本.一句话()
  assert.ok(话.includes('想做'))
  assert.ok(话.includes('做完'))
})

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
