// 记忆检索 · 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-recall-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建检索, 拆词, 半衰天数, 默认条数, 归组 } from '../lib/recall.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

说('== 拆词 ==')
查('中文两字滑窗', () => {
  const 词 = 拆词('今天天气不错')
  assert.ok(词.includes('今天') && 词.includes('天气'))
})
查('语气词不当词', () => {
  const 词 = 拆词('的了吗呢')
  assert.equal(词.length, 0)
})
查('英文数字能拆', () => {
  const 词 = 拆词('用 DSH 写 node 脚本')
  assert.ok(词.includes('dsh') && 词.includes('node'))
})

const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-recall-'))
mkdirSync(join(目录, 'memory'), { recursive: true })
const 文件 = join(目录, 'memory', 'events.jsonl')
const 现在 = Date.parse('2026-11-03T12:00:00+08:00')
const 造 = (时间, summary, weight = 0.5, who = '老大') => JSON.stringify({
  time: 时间, who: { type: 'person', id: 'owner', name: who }, summary, valence: 0, arousal: 0, emotion: '平静', base: 0.5, weight, pins: [], tags: [], status: 'normal',
}) + '\n'

writeFileSync(文件, [
  造('2026-11-03T11:00:00+08:00', '今天给我做鸡汤喝'),
  造('2026-11-02T20:00:00+08:00', '聊了插件重启的事，他要我验过再说'),
  造('2026-10-20T20:00:00+08:00', '插件重启失败，报了假的成功'),
  造('2026-09-01T20:00:00+08:00', '插件重启这件事摔过一次大跟头', 1.2),
  造('2026-11-03T10:00:00+08:00', '楉离发来一张图'),
].join(''), 'utf8')

const 检索 = 建检索({ 根: 目录, 记账: () => {} })

说('== 找相关的 ==')
const 果 = 检索.找('插件重启', { 条数: 3, 现在 })
说('  找到：')
果.forEach((x) => 说('    [' + x._分 + '] ' + x.summary))
查('能找着相关的', () => { assert.ok(果.length > 0) })
查('第一条跟「插件重启」有关', () => { assert.ok(果[0].summary.includes('插件重启')) })
查('不相干的不混进来', () => { assert.ok(!果.some((x) => x.summary.includes('鸡汤'))) })

说('== 时间衰减 ==')
const 新 = 检索.找('插件重启', { 条数: 10, 现在 }).find((x) => x.summary.includes('重启失败'))
const 旧 = 检索.找('插件重启', { 条数: 10, 现在 }).find((x) => x.summary.includes('大跟头'))
查('旧事分数更低', () => { assert.ok(旧._分 < 新._分, '旧的=' + 旧._分 + ' 新的=' + 新._分) })

说('== 情绪权重 ==')
查('情绪重的旧事还能压过普通新事', () => {
  const 全 = 检索.找('插件重启', { 条数: 10, 现在 })
  const 重 = 全.find((x) => x.summary.includes('大跟头'))
  assert.ok(重, '重情绪的条目没找到')
})

说('== 去重 ==')
writeFileSync(文件, [
  造('2026-11-03T11:00:00+08:00', '同一句话'),
  造('2026-11-03T10:00:00+08:00', '同一句话'),
  造('2026-11-03T09:00:00+08:00', '同一句话'),
].join(''), 'utf8')
const 重检索 = 建检索({ 根: 目录 })
查('一样的话只留一条', () => { assert.equal(重检索.找('同一句话', { 条数: 5, 现在 }).length, 1) })

说('== 兜底 ==')
查('没线索时返回空', () => { assert.deepEqual(重检索.找('', { 条数: 3 }), []) })
查('没记忆文件时返回空', () => { assert.deepEqual(建检索({ 根: join(目录, '没有') }).找('插件', { 条数: 3 }), []) })
查('最近几条能拿到', () => { assert.ok(重检索.最近(2).length === 2) })

说('== 拼注入 ==')
const 句 = 重检索.拼注入('同一句话', { 相关条数: 2, 最近条数: 1 })
说('  ' + String(句).replace(/\n/g, ' / '))
查('带项目符号', () => { assert.ok(句.includes('·')) })
查('只有一条不重复', () => { assert.equal(句.split('\n').length, 1) })

说('== 常数 ==')
查('半衰 30 天', () => { assert.equal(半衰天数, 30) })
查('默认 6 条', () => { assert.equal(默认条数, 6) })

说('== 同义词 ==')
查('归组认得近义词', () => {
  assert.equal(归组('重起'), 归组('重启'))
  assert.equal(归组('谎报'), 归组('假报'))
})
查('不认识的词原样返回', () => { assert.equal(归组('鸡汤'), '鸡汤') })

说('== 错题本也一起翻 ==')
writeFileSync(join(目录, 'memory', 'mistakes.jsonl'), JSON.stringify({
  id: 'm-x', kind: 'mistake', time: '2026-11-01T10:00:00+08:00',
  title: '报了假的重启', symptom: '说已重启，其实一次都没重启', fix: '重启完先验一遍', lesson: '敲了命令不等于事情发生', status: '已修',
}) + '\n', 'utf8')
const 错题果 = 建检索({ 根: 目录 }).找('重启 假报', { 条数: 3, 现在 })
说('  找到：' + 错题果.map((x) => (x._错题 ? '【错题】' : '') + String(x.summary).slice(0, 18)).join(' / '))
查('错题能被翻出来', () => { assert.ok(错题果.some((x) => x._错题)) })

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
