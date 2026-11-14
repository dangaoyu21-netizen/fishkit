// 记忆分区 · 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-zone-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建检索, 分区半衰, 该区半衰 } from '../lib/recall.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) {
    说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error))
    process.exitCode = 1
  }
}

说('== 分区半衰的常数 ==')
查('四个区都在', () => {
  assert.deepEqual(Object.keys(分区半衰).sort(), ['我会什么', '我栽过什么', '我和谁', '这几天'].sort())
})
查('没写区的时候按「这几天」30 天', () => { assert.equal(该区半衰({}), 30) })
查('写了不认识的区也退回 30 天', () => { assert.equal(该区半衰({ 区: '瞎写的' }), 30) })
查('「我会什么」几乎不淡', () => { assert.equal(该区半衰({ 区: '我会什么' }), 3650) })
查('「我栽过什么」也几乎不淡', () => { assert.equal(该区半衰({ 区: '我栽过什么' }), 3650) })
查('「我和谁」淡得慢一点', () => { assert.equal(该区半衰({ 区: '我和谁' }), 365) })

const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-zone-'))
mkdirSync(join(目录, 'memory'), { recursive: true })
const 文件 = join(目录, 'memory', 'events.jsonl')
const 现在 = Date.parse('2026-11-08T12:00:00+08:00')
const 造 = (time, summary, 区) => JSON.stringify({
  time, 区, who: { type: 'person', id: 'owner', name: '老大' },
  summary, valence: 0, arousal: 0, emotion: '平静', base: 0.5, weight: 0.5,
  pins: [], tags: [], status: 'normal',
}) + '\n'

// 两百天前，同一句话，只有「区」不一样
writeFileSync(文件, [
  造('2026-04-20T12:00:00+08:00', '画画的线条要一笔拉到底，先练直线', '这几天'),
  造('2026-04-20T12:00:00+08:00', '画画的线条要一笔拉到底，收笔要能收住', '我会什么'),
].join(''), 'utf8')

const 检索 = 建检索({ 根: 目录 })
const 果 = 检索.找('画画的线条', { 条数: 5, 现在 })

说('== 分区影响衰减 ==')
查('两条都找得到', () => { assert.equal(果.length, 2) })
查('「我会什么」两百天后仍然压过「这几天」', () => {
  const 技能 = 果.find((x) => x.区 === '我会什么')
  const 日常 = 果.find((x) => x.区 === '这几天')
  assert.ok(技能 && 日常, '两条没都找到')
  assert.ok(技能._分 > 日常._分, '技能=' + 技能._分 + ' 日常=' + 日常._分)
})

// 没写区的老事件，行为不能变
writeFileSync(文件, [JSON.stringify({
  time: '2026-11-07T12:00:00+08:00', who: { type: 'person', id: 'owner', name: '老大' },
  summary: '昨天画了一张线稿', valence: 0, arousal: 0, emotion: '平静', base: 0.5,
  weight: 0.5, pins: [], tags: [], status: 'normal',
}) + '\n'].join(''), 'utf8')
const 老检索 = 建检索({ 根: 目录 })
查('没写区的老事件照样找得到', () => {
  const r = 老检索.找('线稿', { 条数: 3, 现在 })
  assert.equal(r.length, 1)
})


说('== 科目 ==')
writeFileSync(文件, [JSON.stringify({
  time: '2026-11-08T10:00:00+08:00', 区: '我会什么', 科目: '画画',
  who: { type: 'person', id: 'owner', name: '老大' },
  summary: '排线要一笔一笔来，别画成一束', valence: 0, arousal: 0, emotion: '平静',
  base: 0.5, weight: 0.6, pins: [], tags: [], status: 'normal',
}) + '\n'].join(''), 'utf8')
const 科目检索 = 建检索({ 根: 目录 })
查('科目跟着事件一起存下来', () => {
  const r = 科目检索.找('排线', { 条数: 3, 现在 })
  assert.equal(r.length, 1)
  assert.equal(r[0].科目, '画画')
  assert.equal(r[0].区, '我会什么')
})


查('按区过滤：只翻「我会什么」', () => {
  writeFileSync(文件, [
    JSON.stringify({ time: '2026-11-08T10:00:00+08:00', 区: '我会什么', 科目: '画画', who: { type: 'person', id: 'owner', name: '老大' }, summary: '线条要一笔拉到底', valence: 0, arousal: 0, emotion: '平静', base: 0.5, weight: 0.6, pins: [], tags: [], status: 'normal' }),
    JSON.stringify({ time: '2026-11-08T10:00:00+08:00', 区: '这几天', who: { type: 'person', id: 'owner', name: '老大' }, summary: '线条这个词今天说过两回', valence: 0, arousal: 0, emotion: '平静', base: 0.5, weight: 0.6, pins: [], tags: [], status: 'normal' }),
  ].join('\n') + '\n', 'utf8')
  const r = 建检索({ 根: 目录 }).找('线条', { 条数: 5, 现在, 区: '我会什么' })
  assert.equal(r.length, 1)
  assert.equal(r[0].区, '我会什么')
})
查('按科目过滤：画画只翻画画的', () => {
  const r = 建检索({ 根: 目录 }).找('线条', { 条数: 5, 现在, 科目: '画画' })
  assert.equal(r.length, 1)
  assert.equal(r[0].科目, '画画')
})


说('== 区可以自己加 ==')
writeFileSync(join(目录, 'memory', 'zones.json'), JSON.stringify({ 我和游戏: 500 }), 'utf8')
查('zones.json 里加的区能生效', () => {
  writeFileSync(文件, [JSON.stringify({
    time: '2026-06-01T12:00:00+08:00', 区: '我和游戏', 科目: '环世界',
    who: { type: 'person', id: 'owner', name: '老大' },
    summary: '环世界这局开了 527 个 mod', valence: 0, arousal: 0, emotion: '平静',
    base: 0.5, weight: 0.5, pins: [], tags: [], status: 'normal',
  }), JSON.stringify({
    time: '2026-06-01T12:00:00+08:00', 区: '这几天',
    who: { type: 'person', id: 'owner', name: '老大' },
    summary: '环世界这局开了 527 个 mod 的那天', valence: 0, arousal: 0, emotion: '平静',
    base: 0.5, weight: 0.5, pins: [], tags: [], status: 'normal',
  })].join('\n') + '\n', 'utf8')
  const r = 建检索({ 根: 目录 }).找('环世界', { 条数: 5, 现在 })
  const 游戏 = r.find((x) => x.区 === '我和游戏')
  const 日常 = r.find((x) => x.区 === '这几天')
  assert.ok(游戏 && 日常, '两条没都找到')
  assert.ok(游戏._分 > 日常._分, '游戏=' + 游戏._分 + ' 日常=' + 日常._分)
})

rmSync(目录, { recursive: true, force: true })
说('✅ 全过（' + 过 + ' 项）')





