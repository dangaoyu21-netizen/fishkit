// 记忆清晰度（开发板）· 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-clarity-test.mjs

import assert from 'node:assert/strict'
import { 清晰度, 细度, 压缩, 模糊成句, 门槛, 想一次涨 } from '../lib/clarity.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

// 造一个六轴点（键跟 affect.js 的 轴们 一致）
const 点 = (取 = {}) => ({
  valence: 0.6, arousal: 0.4, dominance: 0.5, warmth: 0.6, optimism: 0.6, softness: 0.5,
  ...取,
})
const 高兴点 = 点({ valence: 0.9, arousal: 0.6, optimism: 0.8, warmth: 0.8 })
const 低点 = 点({ valence: 0.15, arousal: 0.8, optimism: 0.15, warmth: 0.2, softness: 0.2 })

说('== 清晰度 ==')
查('刚记下的、没想起、重要度普通 —— 还算清楚', () => {
  const γ = 清晰度({ 重: 0.5 })
  assert.ok(γ >= 0.55, 'γ=' + γ)
})
查('越旧越淡', () => {
  const 新 = 清晰度({ 重: 0.5, 天: 0 })
  const 旧 = 清晰度({ 重: 0.5, 天: 730 })
  assert.ok(新 > 旧, '新=' + 新 + ' 旧=' + 旧)
})
查('当时和此刻心情一样 —— 比不一样更清楚', () => {
  const 像 = 清晰度({ 此刻: 高兴点, 当时: 高兴点, 重: 0.5 })
  const 不像 = 清晰度({ 此刻: 低点, 当时: 高兴点, 重: 0.5 })
  assert.ok(像 > 不像, '像=' + 像 + ' 不像=' + 不像)
})
查('被想起越多越清楚', () => {
  const 少 = 清晰度({ 想起: 0, 重: 0.5 })
  const 多 = 清晰度({ 想起: 20, 重: 0.5 })
  assert.ok(多 > 少, '少=' + 少 + ' 多=' + 多)
})
查('越重要越清楚', () => {
  const 轻 = 清晰度({ 重: 0.1, 想起: 0 })
  const 重 = 清晰度({ 重: 1, 想起: 0 })
  assert.ok(重 > 轻, '轻=' + 轻 + ' 重=' + 重)
})
查('永远落在 0~1 之间', () => {
  for (const 参数 of [{}, { 重: 99, 想起: 999 }, { 重: -5, 想起: -3 }, { 此刻: 点(1), 当时: 点(0), 重: 1, 想起: 100 }]) {
    const γ = 清晰度(参数)
    assert.ok(γ >= 0 && γ <= 1, JSON.stringify(参数) + ' → ' + γ)
  }
})
查('感官缺失按纯文字算（不崩）', () => {
  const γ = 清晰度({ 重: 0.5, 感官: null })
  assert.ok(Number.isFinite(γ))
})

说('== 细度 ==')
查('很清楚的给全文', () => { assert.equal(细度(0.9), 0) })
查('中间给一句摘要', () => { assert.equal(细度(0.5), 1) })
查('模糊给关键词', () => { assert.equal(细度(0.25), 2) })
查('快没了只剩一句', () => { assert.equal(细度(0.05), 3) })
查('门槛顺序对（高 > 中 > 低）', () => { assert.ok(门槛[0] > 门槛[1] && 门槛[1] > 门槛[2]) })

说('== 压缩 ==')
查('全文不动', () => {
  const 原 = '今天把 bilibili-api 的停用文案合回主版了，测试全绿。'
  assert.equal(压缩(原, 0), 原)
})
查('摘要只留第一句', () => {
  const 果 = 压缩('今天合完了。测试全绿。明天再说。', 1)
  assert.ok(果.startsWith('今天合完了'), 果)
  assert.ok(!果.includes('明天'), 果)
})
查('摘要太长会截断', () => {
  const 长 = '这是一句特别特别特别长长长长长长长长长长长长长长长长长长长长长长的话'
  const 果 = 压缩(长 + '。后面还有。', 1)
  assert.ok(果.length <= 42, '长度 ' + 果.length)
})
查('关键词只留几个词', () => {
  const 果 = 压缩('缝纫机螺丝做旧白霜嫁妆母亲修复', 2)
  assert.ok(果.length <= 20, 果)
  assert.ok(果.endsWith('…'), 果)
})
查('最低档只剩一句空话', () => {
  const 果 = 压缩('随便什么内容', 3)
  assert.ok(果.includes('想不太清'), 果)
})
查('空文本不炸', () => {
  assert.equal(压缩('', 0), '')
  assert.equal(压缩('', 3), '')
})

说('== 模糊成句 ==')
查('清楚的给原文', () => {
  const 原 = '老大说那个 B 站号是给我用的。'
  assert.equal(模糊成句(原, 0.9), 原)
})
查('快忘的只剩关键词', () => {
  const 果 = 模糊成句('老大说那个 B 站号是给我用的', 0.3)
  assert.ok(果.endsWith('…'), 果)
})

说('== 常数 ==')
查('想一次涨一点', () => { assert.ok(想一次涨 > 0 && 想一次涨 < 0.2) })

说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
