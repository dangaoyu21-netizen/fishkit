// 认知维度 · 本地验证（在开发板里跑，不碰主插件）
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-cognition-test.mjs
//
// 2026-11-21 改了：出厂不再随机生成这四根（老大说的，人设得从过往里长）。
// 所以这个测试现在验两件事：一是不生成也不崩，二是往后真长出来的时候能读能拼。

import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建档案核心 } from '../lib/fishsoul.js'
import { 拼认知, 认知门槛, 认知上限 } from '../lib/soul.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-cog-'))
const 档案 = 建档案核心(目录)
档案.初始化()
const 文件 = join(目录, '.fishsoul', 'persona', 'cognition.json')

说('== 出厂不再随机生成 ==')
查('cognition.json 不再被建出来', () => { assert.ok(!existsSync(文件)) })
查('读状态不崩，cognition 是空的', () => {
  const 状态 = 档案.读状态()
  assert.ok(Array.isArray(状态.cognition))
  assert.equal(状态.cognition.length, 0)
})
查('八维也不再随机生成', () => {
  const 状态 = 档案.读状态()
  assert.ok(Array.isArray(状态.dims))
  assert.equal(状态.dims.length, 0)
})
查('重复初始化还是不建', () => {
  档案.初始化()
  assert.ok(!existsSync(文件))
})

说('== 往后长出来了，能读 ==')
mkdirSync(join(目录, '.fishsoul', 'persona'), { recursive: true })
writeFileSync(文件, JSON.stringify({
  dims: [
    { key: 'a', left: '先信人', right: '先求证', value: -0.2, locked: false, manual: false, evidence: ['某天的事'] },
    { key: 'b', left: '算细账', right: '凭感觉', value: 0.18, locked: false, manual: false, evidence: [] },
  ],
}), 'utf8')
查('长出来的读得动', () => {
  const 状态 = 档案.读状态()
  assert.equal(状态.cognition.length, 2)
})
查('再初始化一次也不动它', () => {
  const 前 = readFileSync(文件, 'utf8')
  档案.初始化()
  assert.equal(readFileSync(文件, 'utf8'), 前)
})

说('== 注入那句 ==')
查('偏得明显的才带', () => {
  const 出 = 拼认知([
    { left: '先信人', right: '先求证', value: -0.2 },
    { left: '算细账', right: '凭感觉', value: 0.03 },
  ])
  assert.equal(出, '你想事情的样子：先信人一点。')
})
查('锁上的不带', () => {
  const 出 = 拼认知([{ left: '怕错', right: '敢试', value: -0.25, locked: true }])
  assert.equal(出, '')
})
查('一条都不够门槛就空串', () => {
  const 出 = 拼认知([{ left: '爱闹', right: '正经', value: 0.05 }, { left: '怕错', right: '敢试', value: -0.1 }])
  assert.equal(出, '')
})
查('最多带四条', () => {
  const 六条 = ['A', 'B', 'C', 'D', 'E', 'F'].map((k) => ({ left: k + '左', right: k + '右', value: 0.3 }))
  const 出 = 拼认知(六条)
  assert.equal(出.replace(/^你想事情的样子：/, '').replace(/。$/, '').split('、').length, 认知上限)
})
查('门槛是 0.15', () => { assert.equal(认知门槛, 0.15) })

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
