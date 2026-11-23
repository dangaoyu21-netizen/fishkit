// 往 QQ 说话 · 本地验证（只验「找得到人」，不真发）
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-qq-test.mjs

import assert from 'node:assert/strict'
import { 找收件人, 发一句, 拆段, 段上限, 段间停顿 } from '../lib/qq.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = async (名, fn) => {
  try { await fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

说('== 找收件人 ==')
const 谁 = 找收件人()
说('  地址：' + 谁.地址 + '　号码：' + 谁.号码 + '　称呼：' + 谁.称呼)
查('拿得到 NapCat 地址', () => { assert.match(谁.地址, /^https?:\/\//) })
查('认得出要发给谁', () => { assert.ok(Number.isInteger(谁.号码) && 谁.号码 > 0, '号码是 ' + 谁.号码) })

说('== 拆段 ==')
查('短话不拆', () => { assert.deepEqual(拆段('在吗'), ['在吗']) })
查('空了就没段', () => { assert.deepEqual(拆段(''), []) })
查('长话会拆，每段都不超上限', () => {
  const 长 = '字'.repeat(700)
  const 段 = 拆段(长, 段上限)
  assert.ok(段.length >= 3, '只拆成 ' + 段.length + ' 段')
  assert.ok(段.every((x) => x.length <= 段上限))
  assert.equal(段.join(''), 长, '拼回去得跟原来一样')
})
查('按行凑，凑得下就不拆', () => {
  assert.deepEqual(拆段('第一行\n第二行', 300), ['第一行\n第二行'])
})

说('== 段间停顿 ==')
查('短句在四百到九百之间晃', () => {
  for (let i = 0; i < 40; i++) {
    const t = 段间停顿('在吗')
    assert.ok(t >= 400 && t <= 900, 't=' + t)
  }
})
查('长句子等得更久', () => {
  const t = 段间停顿('字'.repeat(50))
  assert.ok(t > 1500, '长句=' + t)
})
查('带代码块的那段等得最久', () => {
  const t = 段间停顿('```js\nconst a = 1\n```')
  assert.ok(t >= 7500, '代码段=' + t)
})

说('== 边界 ==')
await 查('空的直接不发', async () => {
  const 果 = await 发一句('')
  assert.equal(果.ok, false)
})

说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
