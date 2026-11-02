// 认知维度 · 本地验证（在开发板里跑，不碰主插件）
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-cognition-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
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

说('== 文件 ==')
查('cognition.json 建出来了', () => { assert.ok(existsSync(文件)) })
const 数据 = JSON.parse(readFileSync(文件, 'utf8'))
查('六对维度', () => { assert.equal(数据.dims.length, 6) })

说('== 初值 ==')
const 值们 = 数据.dims.map((d) => d.value)
查('都在 -0.25 到 0.25 之间', () => { for (const v of 值们) assert.ok(v >= -0.25 && v <= 0.25, '越界：' + v) })
查('不是全都一个数（每条鱼长得不一样）', () => { assert.ok(new Set(值们).size > 1) })
查('字段跟八维一致', () => {
  for (const d of 数据.dims) {
    assert.ok(typeof d.key === 'string' && typeof d.left === 'string' && typeof d.right === 'string')
    assert.equal(d.locked, false)
    assert.equal(d.manual, false)
    assert.ok(Array.isArray(d.evidence))
  }
})

说('== 读状态 ==')
const 状态 = 档案.读状态()
查('状态里带 cognition', () => { assert.ok(Array.isArray(状态.cognition) && 状态.cognition.length === 6) })
查('跟八维是两份东西', () => { assert.ok(Array.isArray(状态.dims) && 状态.dims[0].key !== 状态.cognition[0].key) })

说('== 重复初始化不重置 ==')
const 旧值 = 数据.dims.map((d) => d.value).join(',')
档案.初始化()
const 新值 = JSON.parse(readFileSync(文件, 'utf8')).dims.map((d) => d.value).join(',')
查('再初始化一次值不变', () => { assert.equal(旧值, 新值) })

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
