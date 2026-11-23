// 令牌拦截 · 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-token-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建档案核心, 抹令牌, 筛敏感, 敏感规则 } from '../lib/fishsoul.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

说('== 抹令牌 ==')
查('github_pat_ 会被抹掉', () => {
  const 果 = 抹令牌('这是我给你的 github_pat_11ABCDEFG0_abcdefghijklmnop')

  assert.ok(!果.includes('github_pat_'), 果)
  assert.ok(果.includes('已抹掉'), 果)
})
查('npm_ 会被抹掉', () => {
  assert.ok(!抹令牌('npm_abcdefghijklmnopqrstuvwxyz0123').includes('npm_'))
})
查('sk- 会被抹掉', () => {
  assert.ok(!抹令牌('sk-abcdefghijklmnopqrstuv').includes('sk-'))
})
查('普通的话一个字不动', () => {
  const 话 = '老大说今天下雨，路上好堵。'
  assert.equal(抹令牌(话), 话)
})
查('空值也不炸', () => {
  assert.equal(抹令牌(''), '')
  assert.equal(抹令牌(null), '')
  assert.equal(抹令牌(undefined), '')
})

说('== 别的敏感也筛 ==')
查('私钥整段抹掉', () => {
  const 果 = 抹令牌('-----BEGIN RSA PRIVATE KEY-----\nABCDEFG\n-----END RSA PRIVATE KEY-----')
  assert.ok(!果.includes('ABCDEFG'), 果)
  assert.ok(果.includes('已抹掉'))
})
查('cookie 抹掉', () => {
  const 果 = 抹令牌('SESSDATA=abcdef1234567890; bili_jct=zzz')
  assert.ok(!果.includes('abcdef1234567890'), 果)
})
查('密码抹掉', () => {
  const 果 = 抹令牌('password=hunter2hunter2')
  assert.ok(!果.includes('hunter2'), 果)
})
查('手机号只打码，头尾留着', () => {
  const 果 = 抹令牌('他的手机 13812345678')
  assert.ok(!果.includes('13812345678'), 果)
  assert.ok(果.startsWith('他的手机 138'), 果)
  assert.ok(果.endsWith('5678'), 果)
})
查('身份证打码', () => {
  const 果 = 抹令牌('身份证 110101199003071234')
  assert.ok(!果.includes('110101199003071234'), 果)
  assert.ok(果.includes('110'), 果)
})
查('银行卡打码', () => {
  const 果 = 抹令牌('卡号 6222020200112233445')
  assert.ok(!果.includes('6222020200112233445'), 果)
})
查('筛敏感说得出命中了哪种', () => {
  const 果 = 筛敏感('这里是 github_pat_11ABCDEFG0_abcdefghijklmnop 和 13812345678')
  assert.ok(果.命中.includes('令牌'), JSON.stringify(果.命中))
  assert.ok(果.命中.includes('手机号'), JSON.stringify(果.命中))
})
查('规则表里每条都有名字和正则', () => {
  for (const 条 of 敏感规则) {
    assert.ok(条.名, '有条没名字')
    assert.ok(条.re instanceof RegExp, 条.名 + ' 没正则')
    assert.ok(['抹掉', '打码'].includes(条.怎么处理), 条.名 + ' 的处理方式不认识')
  }
})

说('== 写进记忆时就抹掉 ==')
const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-token-'))
const 档案 = 建档案核心(目录)
档案.初始化()
档案.加事件({
  time: new Date().toISOString(),
  summary: '老大把 token 发给我是 github_pat_11ABCDEFG0_abcdefghijklmnop，让我推仓库',
  pins: ['github_pat_11ABCDEFG0_abcdefghijklmnop'],
  tags: ['令牌'],
})
const 行们 = readFileSync(join(目录, '.fishsoul', 'memory', 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const 末 = 行们[行们.length - 1]
查('摘要里没有令牌原文', () => { assert.ok(!String(末.summary).includes('github_pat_')) })
查('摘要里留了一句「已抹掉」', () => { assert.ok(String(末.summary).includes('已抹掉')) })
查('pins 里也没有', () => { assert.ok(!JSON.stringify(末.pins).includes('github_pat_')) })
查('事情本身还留着（他给过令牌这件事没丢）', () => { assert.ok(String(末.summary).includes('老大把 token 发给我')) })

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
