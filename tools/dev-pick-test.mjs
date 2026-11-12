// 加权抽 + 按心情算权重 · 本地验证（2026-11-12）
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-pick-test.mjs

import assert from 'node:assert/strict'
import { 加权抽, 按心情算权重 } from '../lib/pick.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

说('== 加权抽的边界 ==')
查('空权重 → null', () => { assert.equal(加权抽([]), null) })
查('全是 0 或负 → null', () => { assert.equal(加权抽([['a', 0], ['b', -2]]), null) })
查('只有一个 → 就它', () => { assert.equal(加权抽([['a', 5]]), 'a') })
查('权重 0 的不参与', () => {
  // 假随机数一直在头上一半，只有 a 有权重，怎么都该抽到 a
  for (let i = 0; i < 5; i++) assert.equal(加权抽([['a', 1], ['b', 0]], () => 0.9), 'a')
})

说('== 加权抽按权重落 ==')
查('权重 3:1，落在前 3/4 抽到 a', () => {
  assert.equal(加权抽([['a', 3], ['b', 1]], () => 0.1), 'a')
  assert.equal(加权抽([['a', 3], ['b', 1]], () => 0.7), 'a')
})
查('权重 3:1，落在后 1/4 抽到 b', () => {
  assert.equal(加权抽([['a', 3], ['b', 1]], () => 0.9), 'b')
})

说('== 按心情算权重 ==')
查('高兴（0.8）时出门比内向重', () => {
  const 权 = 按心情算权重({ valence: 0.8 }, ['B站'], { 整理: '整理', 神游: '思考神游' })
  const 拿 = (名) => 权.find((x) => x[0] === 名)[1]
  assert.ok(拿('B站') > 拿('整理'), '出门该比整理重')
  assert.ok(拿('B站') > 拿('思考神游'), '出门该比神游重')
})
查('低落（-0.6）时内向比出门重', () => {
  const 权 = 按心情算权重({ valence: -0.6 }, ['B站'], { 整理: '整理', 神游: '思考神游' })
  const 拿 = (名) => 权.find((x) => x[0] === 名)[1]
  assert.ok(拿('整理') > 拿('B站'), '整理该比出门重')
  assert.ok(拿('思考神游') > 0, '神游得留着')
})
查('没给心情就按中间算（出门和内向都留着）', () => {
  const 权 = 按心情算权重(undefined, ['B站'], { 整理: '整理', 神游: '思考神游' })
  assert.ok(权.every((x) => x[1] > 0))
})
查('没平台也能抽（只剩整理和神游）', () => {
  const 权 = 按心情算权重({ valence: 0.9 }, [], { 整理: '整理', 神游: '思考神游' })
  assert.equal(权.length, 2)
  assert.ok(权.every((x) => x[1] > 0))
})

说('== 分布（抽 2000 次看看像不像）==')
const 数 = (心情, 次 = 2000) => {
  const 权 = 按心情算权重({ valence: 心情 }, ['B站'], { 整理: '整理', 神游: '思考神游' })
  const 计 = {}
  for (let i = 0; i < 次; i++) {
    const r = 加权抽(权)
    计[r] = (计[r] || 0) + 1
  }
  return 计
}
查('高兴时出门占大头', () => {
  const 计 = 数(0.9)
  assert.ok(计['B站'] > 计['整理'], '出门该比整理多')
  assert.ok(计['B站'] > 计['思考神游'], '出门该比神游多')
})
查('低落时整理占大头', () => {
  const 计 = 数(-0.9)
  assert.ok(计['整理'] > 计['B站'], '整理该比出门多')
})

说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
