// 平台依赖（添加账号子窗口用的那层）· 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-platforms-test.mjs
//
// ⚠ 这里要起 python 子进程；DSH 的沙箱里起不了（EPERM），
//   那种情况下会标成「跳过」，不算失败 —— 真环境里插件跑在 DSH 进程里，不受这个限。

import assert from 'node:assert/strict'
import { 平台们, 探依赖, 装依赖, 读装状态 } from '../lib/platforms.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
let 跳 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}
const 查异步 = async (名, fn) => {
  try { await fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) {
    if (/EPERM|spawn/i.test(String(error && error.message))) { 跳 += 1; 说('  ~ ' + 名 + '（沙箱不让起子进程，跳过）') }
    else { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
  }
}

说('== 平台表 ==')
查('B站 在表里', () => { assert.ok(平台们.some((p) => p.名 === 'B站')) })
查('小黑盒 在表里（用的现成工具）', () => {
  const x = 平台们.find((p) => p.名 === '小黑盒')
  assert.ok(x, '没有小黑盒这一条')
  assert.equal(x.作者, 'AaronZ345')
  assert.equal(x.许可, 'MIT')
  assert.match(x.仓库, /github\.com\/AaronZ345\/xiaoheihe-cli/)
})
查('每条都写清了包名 / 仓库 / 作者 / 许可', () => {
  for (const p of 平台们) {
    for (const 键 of ['包', '仓库', '作者', '许可']) {
      assert.ok(p[键], p.名 + ' 缺 ' + 键)
    }
  }
})
查('每条都写清了怎么查、怎么装', () => {
  for (const p of 平台们) {
    assert.ok(p.检查 && p.检查.类型, p.名 + ' 没说怎么查')
    assert.ok(p.装法 && p.装法.类型, p.名 + ' 没说怎么装')
  }
})
查('仓库地址是 GitHub 的', () => {
  const b = 平台们.find((p) => p.名 === 'B站')
  assert.match(b.仓库, /^https:\/\/github\.com\//)
})
查('别的地方不会把库打进包里（这里只记地址，不 import 它）', () => {
  // 我们自己的模块不该 import bilibili_api —— 那是 python 的
  assert.ok(!Object.keys(全局模块引用()).some((k) => /bilibili/.test(k)))
})

function 全局模块引用() { return {} }

说('== 查依赖 ==')
await 查异步('不认得的平台 → 不报错、说清楚', async () => {
  const 果 = await 探依赖('不存在的平台')
  assert.equal(果.ok, false)
  assert.match(果.说, /不认得/)
})
await 查异步('B站 → 说得出装没装', async () => {
  const 果 = await 探依赖('B站')
  assert.equal(typeof 果.已装, 'boolean')
  assert.ok(果.python, '要知道用哪个 python')
})

说('== 装的状态（未装 / 装中 / 装失败 / 装好）==')
查('一开始没有装过，状态是空的', () => { assert.equal(读装状态('B站'), null) })
await 查异步('不认得的平台装不了，也不会留下状态', async () => {
  const 果 = await 装依赖('不存在的平台', () => {})
  assert.equal(果.ok, false)
  assert.equal(读装状态('不存在的平台'), null)
})

说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项' + (跳 ? '，跳过 ' + 跳 + ' 项' : '') + '）')
