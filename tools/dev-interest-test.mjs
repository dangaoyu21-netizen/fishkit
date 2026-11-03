// 兴趣 · 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-interest-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建兴趣, 算衰减, 一步, 最低次数, 半衰天数 } from '../lib/interest.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-interest-'))
const 兴趣 = 建兴趣({ 根: 目录, 记账: () => {} })

说('== 记一笔 ==')
查('还没记时是空的', () => { assert.equal(兴趣.读().length, 0) })
兴趣.记({ 名: 'AI 插件', 劲: 0.9 })
查('记完文件有了', () => { assert.ok(existsSync(join(目录, 'persona', 'interests.json'))) })
查('一条只有一次，还不算偏好', () => { assert.equal(兴趣.排行().length, 0) })

说('== 攒出偏好 ==')
兴趣.记({ 名: 'AI 插件', 劲: 0.9 })
兴趣.记({ 名: 'AI 插件', 劲: 0.8 })
查('碰过两次以上才进排行', () => { assert.ok(兴趣.排行().length >= 1) })
查('来劲的分数是正的', () => { assert.ok(兴趣.排行()[0].现分 > 0) })

兴趣.记({ 名: '评论区吵架', 劲: 0.1 })
兴趣.记({ 名: '评论区吵架', 劲: 0.1 })
查('没劲的分数是负的', () => {
  const 吵架 = 兴趣.读().find((x) => x.名 === '评论区吵架')
  assert.ok(吵架.分 < 0, '分=' + 吵架.分)
})

说('== 注入那句 ==')
const 句 = 兴趣.拼注入()
说('  ' + 句)
查('提到来劲的', () => { assert.ok(句.includes('AI 插件')) })
查('提到没劲的', () => { assert.ok(句.includes('评论区吵架')) })

说('== 衰减 ==')
查('刚碰过的分不变', () => {
  const 现在 = Date.now()
  assert.ok(Math.abs(算衰减(0.5, new Date(现在).toISOString(), 现在) - 0.5) < 0.001)
})
查('45 天前的分掉一半', () => {
  const 现在 = Date.parse('2026-11-03T12:00:00+08:00')
  const 旧 = new Date(现在 - 半衰天数 * 86400000).toISOString()
  assert.ok(Math.abs(算衰减(0.5, 旧, 现在) - 0.25) < 0.01)
})
查('没日期的当没衰减', () => { assert.equal(算衰减(0.4, ''), 0.4) })

说('== 边界 ==')
查('劲超范围会被夹住', () => {
  const 果 = 兴趣.记({ 名: '超范围', 劲: 5 })
  assert.ok(果 && Math.abs(果.分) <= 1)
})
查('没名字不记', () => { assert.equal(兴趣.记({ 名: '', 劲: 0.5 }), null) })
查('没有根目录也不记', () => { assert.equal(建兴趣({}).记({ 名: 'x', 劲: 0.5 }), null) })
查('空本子拼出空串', () => { assert.equal(建兴趣({ 根: join(目录, '没有') }).拼注入(), '') })

说('== 常数 ==')
查('一步 0.18', () => { assert.equal(一步, 0.18) })
查('最低两次', () => { assert.equal(最低次数, 2) })

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
