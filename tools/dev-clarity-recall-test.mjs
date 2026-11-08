// 清晰度接进检索（开发板）· 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-clarity-recall-test.mjs

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { 建检索 } from '../lib/recall.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 根 = mkdtempSync(join(tmpdir(), 'fishkit-clarity-'))
mkdirSync(join(根, 'memory'), { recursive: true })

const 造 = (summary, 天前, weight, extra = {}) => ({
  time: new Date(Date.now() - 天前 * 86400000).toISOString(),
  summary,
  weight,
  ...extra,
})

const 事件们 = [
  造('修缝纫机那条视频的评论区在争做旧', 1, 0.8, { tags: ['B站', '缝纫机'] }),
  造('缝纫机螺丝是不是十字，评论区吵起来了', 30, 0.5, { tags: ['缝纫机'] }),
  造('今天吃了饭', 2, 0.3, { tags: ['饭'] }),
]
writeFileSync(join(根, 'memory', 'events.jsonl'), 事件们.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8')

const 检索 = 建检索({ 根, 记账: () => {} })

说('== 检索带清晰度 ==')
查('搜出来的每条都有清晰度、细度', () => {
  const 果 = 检索.找('缝纫机 螺丝', { 条数: 3 })
  assert.ok(果.length >= 1, '一条都没搜到')
  for (const e of 果) {
    assert.ok(Number.isFinite(e._清晰度), '没清晰度：' + JSON.stringify(e._清晰度))
    assert.ok(Number.isFinite(e._细), '没细度')
    assert.ok(e._清晰度 >= 0 && e._清晰度 <= 1)
  }
})

说('== 想起次数会涨 ==')
查('第一次搜完，想起本里记上了', () => {
  const 文件 = join(根, 'memory', 'recalled.json')
  assert.ok(existsSync(文件), 'recalled.json 没生成')
  const 盘 = JSON.parse(readFileSync(文件, 'utf8'))
  const 值们 = Object.values(盘).map(Number)
  assert.ok(值们.length >= 1, '没记下任何一条')
  assert.ok(值们.some((v) => v >= 1), '次数没涨：' + JSON.stringify(盘))
})
查('搜两次，次数变成 2', () => {
  检索.找('缝纫机 螺丝', { 条数: 3 })
  const 盘 = JSON.parse(readFileSync(join(根, 'memory', 'recalled.json'), 'utf8'))
  assert.ok(Object.values(盘).some((v) => Number(v) >= 2), JSON.stringify(盘))
})

说('== 清晰度影响排序 ==')
查('新且重的那条排在旧且轻的前面', () => {
  const 果 = 检索.找('缝纫机', { 条数: 3 })
  const 新 = 果.findIndex((e) => String(e.summary).includes('做旧'))
  const 旧 = 果.findIndex((e) => String(e.summary).includes('十字'))
  assert.ok(新 >= 0 && 旧 >= 0, '两条都得搜到')
  assert.ok(新 < 旧, '新的排第 ' + 新 + '，旧的排第 ' + 旧)
})

说('== 注入里会按清晰度压缩 ==')
查('拼注入能出来、不炸', () => {
  const 文 = 检索.拼注入('缝纫机 螺丝', { 相关条数: 3, 最近条数: 1 })
  assert.ok(typeof 文 === 'string' && 文.length > 0, '拼注入是空的')
  assert.ok(文.includes('缝纫机'), 文)
})

rmSync(根, { recursive: true, force: true })

说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
