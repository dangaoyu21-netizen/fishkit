// 记忆检索·新加的那几样（同义词扩、同音、错一个字、热词翻倍）
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-recall-near-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建检索, 同义组, 同音组, 是同音, 骨架, 近似权重, 归组 } from '../lib/recall.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

说('== 同义词表 ==')
查('至少五十组', () => { assert.ok(同义组.length >= 50, '只有 ' + 同义组.length + ' 组') })
查('每组至少两个说法', () => {
  for (const 组 of 同义组) assert.ok(组.length >= 2, 组[0] + ' 只有一个说法')
})
查('没有空词', () => {
  for (const 组 of 同义组) for (const 词 of 组) assert.ok(String(词).trim(), '有个空的')
})
查('「装上」和「部署」算一家', () => { assert.equal(归组('装上'), 归组('部署')) })
查('「子窗口」和「弹窗」算一家', () => { assert.equal(归组('子窗口'), 归组('弹窗')) })

说('== 同音 ==')
查('桥和乔同音', () => { assert.ok(是同音('桥', '乔')) })
查('修和休同音', () => { assert.ok(是同音('修', '休')) })
查('不是同音的不乱认', () => { assert.ok(!是同音('桥', '盘')) })
查('同音表里不许有单字组', () => { for (const 组 of 同音组) assert.ok(组.length >= 2, 组.join('') + ' 只有一个字') })

说('== 删字骨架 ==')
查('重修 → 重 / 修', () => { assert.deepEqual(骨架('重修').sort(), ['重', '修'].sort()) })
查('四个字给四个骨架', () => { assert.equal(骨架('插件重启').length, 4) })
查('一个字不给骨架', () => { assert.deepEqual(骨架('桥'), []) })
查('太长的也不给', () => { assert.deepEqual(骨架('一二三四五'), []) })

说('== 近似权重 ==')
查('同音替换更可信', () => { assert.ok(近似权重('桥接', '乔接') > 近似权重('桥接', '盘接')) })
查('完全一样不算近似', () => { assert.equal(近似权重('桥接', '桥接'), 0) })

说('== 错一个字也找得到 ==')
const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-near-'))
mkdirSync(join(目录, 'memory'), { recursive: true })
const 文件 = join(目录, 'memory', 'events.jsonl')
const 现在 = Date.parse('2026-11-04T20:00:00+08:00')
const 造 = (时间, summary, weight = 0.5) => JSON.stringify({
  time: 时间, who: { type: 'person', id: 'owner', name: '老大' }, summary, valence: 0, arousal: 0,
  emotion: '平静', base: 0.5, weight, pins: [], tags: [], status: 'normal',
}) + '\n'

writeFileSync(文件, [
  造('2026-11-04T19:00:00+08:00', '重新装了插件，验过才合回去'),
  造('2026-11-04T18:00:00+08:00', '今天中午吃了番茄鸡蛋面'),
  造('2026-11-03T18:00:00+08:00', '下雨天堵车堵得很难受'),
].join(''), 'utf8')

const 检索 = 建检索({ 根: 目录 })
const 果 = 检索.找('重修插件', { 条数: 3, 现在 })
说('  找到：' + 果.map((x) => x.summary.slice(0, 16)).join(' / '))
查('错一个字的也能翻出来', () => { assert.ok(果.some((x) => x.summary.includes('重新装'))) })
查('同音的字也认（桥/乔）', () => {
  writeFileSync(join(目录, 'memory', 'events.jsonl'),
    造('2026-11-04T17:00:00+08:00', '把桥接的端口记下来了') +
    造('2026-11-04T16:00:00+08:00', '晚饭吃的是馄饨'), 'utf8')
  const 乙 = 建检索({ 根: 目录 }).找('乔接端口', { 条数: 3, 现在 })
  assert.ok(乙.some((x) => x.summary.includes('桥接')), '同音没认出来：' + JSON.stringify(乙.map((x) => x.summary)))
})

说('== 热词翻倍 ==')
const 带热词 = (写不写) => {
  writeFileSync(文件, [
    造('2026-11-04T19:00:00+08:00', '老大说房子要收拾一下'),
    造('2026-11-04T18:00:00+08:00', '顺手把窗帘洗了'),
  ].join(''), 'utf8')
  const k = join(目录, 'memory', 'keywords.jsonl')
  if (写不写) writeFileSync(k, JSON.stringify({ 日: '2026-11-04', time: '2026-11-04T22:00:00+08:00', 词们: ['房子'] }) + '\n', 'utf8')
  else rmSync(k, { force: true })
  const r = 建检索({ 根: 目录 }).找('房子', { 条数: 1, 现在 })
  return r[0]
}
const 没热词 = 带热词(false)
const 有热词 = 带热词(true)
说('  没热词 ' + (没热词 && 没热词._分) + ' ／ 有热词 ' + (有热词 && 有热词._分))
查('命中热词的分更高', () => { assert.ok(有热词 && 没热词 && 有热词._分 > 没热词._分) })

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
