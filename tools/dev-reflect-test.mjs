// 自检（月度回顾）· 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-reflect-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建回顾, 月标签, 带上限, 该写回顾了, 记一次提醒 } from '../lib/reflect.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-reflect-'))
const 回顾 = 建回顾({ 根: 目录, 记账: () => {} })

说('== 月标签 ==')
查('格式对', () => { assert.match(月标签(new Date(2026, 10, 2)), /^2026-11$/) })

说('== 存 ==')
查('没写过时读最近是空', () => { assert.equal(回顾.读最近(), null) })
const 路径 = 回顾.存('这个月学会了不少东西。也摔了几跤。', '2026-11')
查('文件写出来了', () => { assert.ok(路径 && existsSync(路径)) })
查('空文本不存', () => { assert.equal(回顾.存('   '), null) })

说('== 读最近 ==')
const 最近 = 回顾.读最近()
查('读得到', () => { assert.ok(最近 && 最近.文件 === '2026-11.md') })
查('正文去掉了标题', () => { assert.ok(!最近.正文.startsWith('#')) })

说('== 注入那句 ==')
const 句 = 回顾.拼注入()
说('  ' + 句)
查('带前缀', () => { assert.ok(句.startsWith('上一次回头看自己时')) })
查('只带尾巴，不超上限', () => { assert.ok(句.length <= 带上限 + 20) })
查('空档案给空串', () => { const 空 = 建回顾({ 根: join(目录, '不存在') }); assert.equal(空.拼注入(), '') })

说('== 多份回顾取最新 ==')
回顾.存('十月的想法。', '2026-10')
const 最新 = 回顾.读最近()
查('取的是 11 月那份', () => { assert.equal(最新.文件, '2026-11.md') })
查('文件按月份排好了', () => { assert.deepEqual(回顾.全部(), ['2026-10.md', '2026-11.md']) })

说('== 素材 ==')
mkdirSync(join(目录, 'memory'), { recursive: true })
mkdirSync(join(目录, 'mood'), { recursive: true })
writeFileSync(join(目录, 'persona', 'history.jsonl'), '{"time":"2026-11-01T10:00:00+08:00","key":"粘人-独立","from":0.43,"to":0.45}\n', 'utf8')
writeFileSync(join(目录, 'mood', 'history.jsonl'), '', 'utf8')
const 素材 = 回顾.拼素材('2026-11')
说('  ' + 素材.replace(/\n/g, ' / '))
查('素材里有性格演化', () => { assert.ok(素材.includes('粘人-独立')) })

说('== 该不该提醒 ==')
const 提醒目录 = mkdtempSync(join(tmpdir(), 'fishkit-prompt-'))
查('没写过、没催过 → 该提醒', () => { assert.equal(该写回顾了(提醒目录, '2026-11'), true) })
查('催过一次就不催了', () => {
  记一次提醒(提醒目录, '2026-11')
  assert.equal(该写回顾了(提醒目录, '2026-11'), false)
})
查('别人提醒过不影响下个月', () => { assert.equal(该写回顾了(提醒目录, '2026-12'), true) })
查('写过了就不用催', () => {
  建回顾({ 根: 提醒目录 }).存('写完了。', '2026-12')
  assert.equal(该写回顾了(提醒目录, '2026-12'), false)
})
查('没根目录就不催', () => { assert.equal(该写回顾了('', '2026-11'), false) })
rmSync(提醒目录, { recursive: true, force: true })

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
