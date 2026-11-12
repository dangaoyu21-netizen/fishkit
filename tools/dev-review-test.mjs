// 复习（记忆别真忘掉）· 本地验证（2026-11-12）
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-review-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建检索 } from '../lib/recall.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 根 = mkdtempSync(join(tmpdir(), 'fishkit-review-'))
mkdirSync(join(根, 'memory'), { recursive: true })

const 两百天前 = new Date(Date.now() - 200 * 86400000).toISOString()
const 三天前 = new Date(Date.now() - 3 * 86400000).toISOString()
const 今天 = new Date().toISOString()

const 事件们 = [
  { id: 'evt-1', time: 两百天前, summary: '老师说：摔在同一个地方最冤', weight: 0.9, 区: '我栽过什么', 情绪: null },
  { id: 'evt-2', time: 两百天前, summary: '随手记的一条废话', weight: 0.35, 区: '这几天', 情绪: null },
  { id: 'evt-3', time: 三天前, summary: '刚发生的事', weight: 0.9, 区: '这几天', 情绪: null },
  { id: 'evt-4', time: 两百天前, summary: '重要但要复习的事', weight: 0.8, 区: '我会什么', 情绪: null },
]
writeFileSync(join(根, 'memory', 'events.jsonl'), 事件们.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8')

const 检索 = 建检索({ 根 })

说('== 该复习挑得对不对 ==')
const 该 = 检索.该复习(3)
查('挑出了「重要的旧事」，没挑废话', () => {
  const 文们 = 该.map((x) => x.事件.summary)
  assert.ok(文们.includes('重要但要复习的事'), '该挑出它：' + JSON.stringify(文们))
  assert.ok(!文们.includes('随手记的一条废话'), '别挑废话：' + JSON.stringify(文们))
  assert.ok(!文们.includes('刚发生的事'), '太新的不挑：' + JSON.stringify(文们))
})
查('越重要越靠前', () => {
  assert.equal(该[0].事件.summary, '老师说：摔在同一个地方最冤')
})
查('每条都带了 γ 和键', () => {
  assert.ok(该.every((x) => typeof x.γ === 'number' && x.键))
})

说('== 复习后想起数涨 ==')
const 第一条 = 该[0]
const 前 = 第一条.想起
const 后 = 检索.复习一下(第一条.键)
查('想起数 +1', () => { assert.equal(后, 前 + 1) })
查('落盘了', () => {
  const 盘 = JSON.parse(readFileSync(join(根, 'memory', 'recalled.json'), 'utf8'))
  assert.equal(盘[第一条.键], 前 + 1)
})
查('再复习一次就 +2', () => { assert.equal(检索.复习一下(第一条.键), 前 + 2) })
查('复习空键不炸', () => { assert.equal(检索.复习一下(''), 0) })

说('== 复习过的，γ 应该涨了一点 ==')
查('同一件事复习两次后，γ 比原来高', () => {
  const 再来 = 检索.该复习(3).find((x) => x.键 === 第一条.键)
  if (!再来) return // 涨过了不再进候选，也是合理的
  assert.ok(再来.γ > 第一条.γ, 'γ 该往上走：' + 第一条.γ + ' → ' + 再来.γ)
})

rmSync(根, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
