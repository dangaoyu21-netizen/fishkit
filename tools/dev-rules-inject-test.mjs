// 规矩进注入 · 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-rules-inject-test.mjs

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { 拼行为, 规矩上限 } from '../lib/soul.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

说('== 拼行为 ==')
查('没规矩给空串', () => { assert.equal(拼行为([]), '') })
查('不是数组也给空串', () => { assert.equal(拼行为(null), '') })
查('跳过停用的', () => {
  const 出 = 拼行为([
    { id: 'a', text: '要这样', enabled: true },
    { id: 'b', text: '别这样', enabled: false },
  ])
  assert.equal(出, '行为：要这样')
})
查('跳过没文案的', () => {
  const 出 = 拼行为([{ id: 'c', text: '   ' }, { id: 'd', text: '算数' }])
  assert.equal(出, '行为：算数')
})
查('疤长出来的只带最近两条，手写的不被挤掉', () => {
  const 规矩们 = [
    { id: 'a', text: '手写一' },
    { id: 'b', text: '手写二' },
    { id: 'f1', text: '疤一', from: 'mistakes' },
    { id: 'f2', text: '疤二', from: 'mistakes' },
    { id: 'f3', text: '疤三', from: 'mistakes' },
  ]
  const 出 = 拼行为(规矩们)
  assert.ok(出.includes('手写一') && 出.includes('手写二'), '手写的要全在')
  assert.ok(!出.includes('疤一'), '老疤应该被挤掉')
  assert.ok(出.includes('疤二') && 出.includes('疤三'), '最近两条疤要在')
  assert.equal(出.replace(/^行为：/, '').split('；').length, 4)
})
查('总量也封顶', () => {
  const 规矩们 = Array.from({ length: 14 }, (_, i) => ({ id: 'r' + i, text: '第' + i + '条' }))
  const 出 = 拼行为(规矩们)
  assert.equal(出.replace(/^行为：/, '').split('；').length, 规矩上限)
})

说('== 真档案里的规矩 ==')
const 真规矩 = JSON.parse(readFileSync('C:\\Users\\yde20\\Documents\\deepseek-harness\\default-workspace\\.fishsoul\\behavior\\rules.json', 'utf8')).rules
const 真出 = 拼行为(真规矩)
说('  ' + 真出)
查('现有规矩能拼出来', () => { assert.ok(真出.startsWith('行为：')) })
查('话题那几条还在', () => { assert.ok(真出.includes('不谈键政') || 真出.includes('键政')) })

说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
