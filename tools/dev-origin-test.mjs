// 起点（origin）· 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-origin-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建档案核心 } from '../lib/fishsoul.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-origin-'))
const 档案 = 建档案核心(目录)
档案.初始化()
const 文件 = join(目录, '.fishsoul', 'persona', 'origin.json')

说('== 文件 ==')
查('origin.json 建出来了', () => { assert.ok(existsSync(文件)) })
const 起点 = JSON.parse(readFileSync(文件, 'utf8'))

说('== 内容 ==')
查('种子句先空着（新鱼自己写）', () => { assert.equal(起点.seed, '') })
查('带了自己的名字', () => { assert.ok(起点.name) })
查('第一次见面先空着', () => {
  assert.ok(起点.firstMeet)
  assert.equal(起点.firstMeet.firstWords, '')
  assert.equal(起点.firstMeet.howItFelt, '')
})
查('标成只读', () => { assert.equal(起点.readonly, true) })

说('== 读状态 ==')
const 状态 = 档案.读状态()
查('状态里带 origin', () => { assert.ok(状态.origin && 'seed' in 状态.origin && 状态.origin.name) })

说('== 不覆盖 ==')
查('手写了第一次见面也留着', () => {
  起点.firstMeet.when = '2026-10-25'
  起点.firstMeet.firstWords = '你好呀'
  写File(文件, 起点)
  档案.初始化()
  const 再读 = JSON.parse(readFileSync(文件, 'utf8'))
  assert.equal(再读.firstMeet.firstWords, '你好呀')
})

function 写File(p, v) { writeFileSync(p, JSON.stringify(v, null, 2) + '\n', 'utf8') }

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
