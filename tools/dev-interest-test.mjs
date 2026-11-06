// 兴趣 · 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-interest-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建兴趣, 算衰减, 一步, 最低次数, 半衰天数, 类上限 } from '../lib/interest.js'

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
查('上限六十四类', () => { assert.equal(类上限, 64) })

说('== 抽一次（出门往哪儿）==')
const 抽根 = mkdtempSync(join(tmpdir(), 'fishkit-draw-'))
const 抽兴 = 建兴趣({ 根: 抽根 })
for (let i = 0; i < 4; i++) 抽兴.记({ 名: 'AI插件', 劲: 0.9 })
for (let i = 0; i < 4; i++) 抽兴.记({ 名: 'B站整活', 劲: 0.5 })
for (let i = 0; i < 4; i++) 抽兴.记({ 名: '评论区吵架', 劲: 0.1 })
const 计 = {}
for (let i = 0; i < 600; i++) { const r = 抽兴.抽一次(); 计[r.方向] = (计[r.方向] || 0) + 1 }
说('  600 次：' + JSON.stringify(计))
查('「其他」占比接近一成', () => {
  const 比 = (计['其他'] || 0) / 600
  assert.ok(比 > 0.03 && 比 < 0.2, '占比=' + 比)
})
查('来劲的抽得更多', () => { assert.ok((计['AI插件'] || 0) > (计['B站整活'] || 0)) })
查('明确不喜欢的不抽', () => { assert.equal(计['评论区吵架'] || 0, 0) })

说('== 刷多了会降权 ==')
for (let i = 0; i < 20; i++) 抽兴.记刷('AI插件')
const 计2 = {}
for (let i = 0; i < 600; i++) { const r = 抽兴.抽一次(); 计2[r.方向] = (计2[r.方向] || 0) + 1 }
说('  刷了 20 次之后：' + JSON.stringify(计2))
查('AI插件 的占比降下来了', () => { assert.ok((计2['AI插件'] || 0) < (计['AI插件'] || 0)) })
rmSync(抽根, { recursive: true, force: true })

说('== 上限 ==')
const 上根 = mkdtempSync(join(tmpdir(), 'fishkit-cap-'))
const 上兴 = 建兴趣({ 根: 上根 })
// 单字类名不会互相归并（像一类 只在两个字以上才比）
const 单字 = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥'
for (let i = 0; i < 15; i++) 上兴.记({ 名: 单字[i], 劲: 0.2 + i * 0.04 })
查('上限之内全留着', () => { assert.equal(上兴.读().length, 15) })
查('上限是 64', () => { assert.equal(类上限, 64) })
// 直接摆 70 类，再记一次触发收一收
mkdirSync(join(上根, 'persona'), { recursive: true })
writeFileSync(join(上根, 'persona', 'interests.json'), JSON.stringify({
  类们: Array.from({ length: 70 }, (_, i) => ({
    名: String.fromCharCode(0x4e00 + i), 分: (i - 30) / 100, 次数: 2, 末次: new Date().toISOString(),
  })),
  刷: { 总: 0, 各类: {} },
}), 'utf8')
上兴.记({ 名: '另开一类', 劲: 0.5 })
查('超了就砍到 64', () => { assert.equal(上兴.读().length, 类上限) })
查('留下的是分数高的', () => { assert.ok(上兴.读().some((x) => x.名 === String.fromCharCode(0x4e00 + 69))) })
rmSync(上根, { recursive: true, force: true })

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
