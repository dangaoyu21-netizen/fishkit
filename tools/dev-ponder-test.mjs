// 琢磨 · 本地验证（不开 DSH）
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-ponder-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 判反应, 建琢磨, 默认冷静分钟 } from '../lib/ponder.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

说('== 判反应 ==')
查('理性又心情好 → 先想想', () => { assert.equal(判反应({ 心情: 0.3, 感性: -0.4 }), '想想') })
查('很感性 → 先气一会儿', () => { assert.equal(判反应({ 心情: 0.3, 感性: 0.5 }), '气一会儿') })
查('心情不好 → 先气一会儿', () => { assert.equal(判反应({ 心情: -0.4, 感性: -0.3 }), '气一会儿') })
查('中性 → 想想', () => { assert.equal(判反应({ 心情: 0, 感性: 0 }), '想想') })

说('== 遇纠正 ==')
const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-ponder-'))
mkdirSync(join(目录, 'persona'), { recursive: true })
const 琢磨 = 建琢磨({ 根: 目录, 记账: () => {} })

查('心情好时不当场记仇', () => {
  const r = 琢磨.遇纠正({ 被纠正的话: '太长了', 心情: 0.3, 感性: -0.3 })
  assert.equal(r.反应, '想想')
  assert.equal(琢磨.还有气吗(), 0)
})

查('心情差时先记一笔', () => {
  const r = 琢磨.遇纠正({ 被纠正的话: '这句不对', 心情: -0.4, 感性: 0.2 })
  assert.equal(r.反应, '气一会儿')
  assert.equal(琢磨.还有气吗(), 1)
})

查('账记在 persona/ponder.jsonl', () => {
  const f = join(目录, 'persona', 'ponder.jsonl')
  assert.ok(existsSync(f))
  const 条 = JSON.parse(readFileSync(f, 'utf8').trim().split('\n').pop())
  assert.equal(条.状态, '气着')
})

说('== 冷静一下 ==')
查('刚记的还不算想通', () => {
  const r = 琢磨.冷静一下({ 现在: Date.now(), 分钟: 默认冷静分钟 })
  assert.equal(r.想通.length, 0)
  assert.equal(r.还剩.length, 1)
})

查('过了冷静期就回头想通了', () => {
  const r = 琢磨.冷静一下({ 现在: Date.now() + (默认冷静分钟 + 1) * 60000 })
  assert.equal(r.想通.length, 1)
  assert.equal(r.还剩.length, 0)
})

查('想通了账户就清了', () => { assert.equal(琢磨.还有气吗(), 0) })

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
