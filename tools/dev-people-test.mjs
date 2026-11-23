// 名册 · 本地验证（2026-11-21）
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-people-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建名册 } from '../lib/people.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 根 = mkdtempSync(join(tmpdir(), 'fishkit-people-'))
const 写 = (相对, 内容) => {
  const 路 = join(根, 相对)
  mkdirSync(join(路, '..'), { recursive: true })
  writeFileSync(路, typeof 内容 === 'string' ? 内容 : JSON.stringify(内容), 'utf8')
}

const 册 = 建名册({ 根 })

说('== 空的时候 ==')
查('没归拢过，册子是空的', () => { assert.equal(册.册().length, 0) })
查('没册子时认不出人', () => { assert.equal(册.翻('老大').length, 0) })
查('没册子时拼注入是空串', () => { assert.equal(册.拼注入('老大'), '') })

说('== 归拢 ==')
写('memory/pinned.json', { whoAmI: '小肥鱼', whoAreYou: '蛋糕鱼（老大）', userBio: '自称大肥鱼' })
写('persona/base.json', { base: '软乎乎、黏人', seed: '若你相信你所相信的' })
写('attitude/attitude.json', {
  people: [
    { id: 'owner', name: '蛋糕鱼（老大）', value: 100, qq: '137843748', firstSeen: '2026-11-01', reason: '终端管理员' },
    { id: '248551590', name: '楉离', value: 20, firstSeen: '2026-11-02', reason: '还没怎么聊过' },
  ],
})
写('memory/edges.jsonl', [
  { 从: '老大', 关系: '教了', 到: '认人要按 id', 时间: '2026-11-17' },
  { 从: '老大', 关系: '给了', 到: '可以用这台设备做任何它能完成的事', 时间: '2026-11-20' },
  { 从: '小肥鱼', 关系: '喜欢', 到: '木工 / 榫卯', 时间: '2026-11-17' },
].map((x) => JSON.stringify(x)).join('\n') + '\n')

const 全 = 册.归()
查('归出三条：我 + 两个人', () => { assert.equal(全.length, 3) })
查('我自己叫小肥鱼', () => {
  const 我 = 册.自己()
  assert.ok(我)
  assert.equal(我.name, '小肥鱼')
})
查('底色进了自己的条目', () => {
  assert.equal(册.自己().how, '软乎乎、黏人')
})
查('起点也进了自己的条目', () => {
  assert.ok(册.自己().note.includes('若你相信'))
})
查('老大那条带着 QQ 号', () => {
  const 人 = 册.找('owner')
  assert.ok(人)
  assert.equal(人.qq, '137843748')
})
查('老大那条的边是从「老大」这个名字上长的', () => {
  const 人 = 册.找('owner')
  assert.equal(人.edges.length, 2)
})
查('楉离没有边', () => { assert.equal(册.找('248551590').edges.length, 0) })

说('== 认人 ==')
查('「老大」认得出来（这个称呼必须进别名）', () => {
  assert.equal(册.翻('老大，开工喵')[0].name, '蛋糕鱼（老大）')
})
查('「蛋糕鱼」也认得出', () => {
  assert.equal(册.翻('蛋糕鱼说过')[0].name, '蛋糕鱼（老大）')
})
查('「楉离」认得出', () => {
  assert.equal(册.翻('楉离发了张图')[0].name, '楉离')
})
查('只提「鱼」不误伤', () => { assert.equal(册.翻('这条鱼真好看').length, 0) })
查('只提「你」不误伤', () => { assert.equal(册.翻('你教过我').length, 0) })
查('没提名字就是空的', () => { assert.equal(册.翻('今天天气不错').length, 0) })
查('按 QQ 号也找得到人', () => { assert.equal(册.找('137843748').name, '蛋糕鱼（老大）') })

说('== 拼注入 ==')
查('不管说不说话，自己总在', () => {
  const 文 = 册.拼注入('今天天气不错')
  assert.ok(文.includes('我是小肥鱼'))
  assert.ok(文.includes('软乎乎'))
})
查('知道对面是谁就不用从话里猜', () => {
  const 文 = 册.拼注入('嗯', '137843748')
  assert.ok(文.includes('这次在跟你说话的是'))
  assert.ok(文.includes('蛋糕鱼（老大）'))
})
查('知道对面是谁，话里提到别人也带上', () => {
  const 文 = 册.拼注入('楉离今天发了张图', '137843748')
  assert.ok(文.includes('蛋糕鱼（老大）'))
  assert.ok(文.includes('楉离'))
})
查('边太长会截掉', () => {
  const 文 = 册.拼注入('老大', '137843748')
  const 行 = 文.split('\n').filter((x) => x.includes('这次在跟你说话的是'))[0] || ''
  assert.ok(行.length < 160, '那句太长了：' + 行.length)
})
查('截断不留下半个开引号', () => {
  const 文 = 册.拼注入('老大', '137843748')
  assert.ok(!/「[^」]*$/.test(文), '拼出了没闭合的引号：' + 文)
})

rmSync(根, { recursive: true, force: true })
说('\n✅ 全过（' + 过 + ' 项）')
