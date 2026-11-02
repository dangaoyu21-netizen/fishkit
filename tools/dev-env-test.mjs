// 环境指纹 · 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-env-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建环境, 归时段, 抽常聊, 当前平台 } from '../lib/env.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

说('== 时段 ==')
查('夜里十一点算深夜', () => { assert.equal(归时段([23, 22, 0]), '深夜') })
查('上午十点算早晨', () => { assert.equal(归时段([8, 9, 10]), '早晨') })
查('混着来取最多的那个', () => { assert.equal(归时段([9, 23, 23, 23, 15]), '深夜') })
查('空的给空串', () => { assert.equal(归时段([]), '') })

说('== 常聊 ==')
const 事件 = [
  { summary: '聊了 B站 的评论' },
  { summary: '又刷 B站 视频' },
  { summary: '调试 node 脚本' },
  { summary: '备份插件' },
  { summary: '随便说句' },
]
const 常聊 = 抽常聊(事件)
说('  抽到：' + 常聊.join('、'))
查('B站 出现了两次以上', () => { assert.ok(常聊.includes('B站')) })
查('只出现一次的不算', () => { assert.ok(!常聊.includes('备份')) })
查('不合格的结果是空数组', () => { assert.deepEqual(抽常聊([{ summary: '今天天气不错' }]), []) })

说('== 平台 ==')
查('认得出来', () => { assert.ok(['Windows', 'macOS', 'Linux'].includes(当前平台())) })

说('== 建环境 ==')
const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-env-'))
const 环境 = 建环境({ 根: 目录, 记账: () => {} })
查('没采过时读是空', () => { assert.equal(环境.读(), null) })

const 采 = 环境.采({ events: [{ time: '2026-11-02T23:00:00+08:00', summary: '聊 B站' }, { time: '2026-11-02T23:30:00+08:00', summary: '又看 B站' }] })
查('采得出平台', () => { assert.ok(采.平台) })
查('采得出时段', () => { assert.equal(采.时段, '深夜') })
查('采得出常聊', () => { assert.ok(采.常聊.includes('B站')) })
查('不存主机名', () => { assert.ok(!('主机' in 采) && !('hostname' in 采)) })

环境.刷新({ events: [] })
查('刷新后文件有了', () => { assert.ok(existsSync(join(目录, 'persona', 'environment.json'))) })
const 盘上 = JSON.parse(readFileSync(join(目录, 'persona', 'environment.json'), 'utf8'))
查('盘上也是这几样', () => { assert.ok(盘上.平台 && 盘上.语言 === '中文') })

说('== 注入那句 ==')
环境.刷新({ events: [{ time: '2026-11-02T23:00:00+08:00', summary: '聊 B站' }, { time: '2026-11-02T23:10:00+08:00', summary: 'B站' }] })
const 句 = 环境.拼注入()
说('  ' + 句)
查('带前缀', () => { assert.ok(句.startsWith('你待的地方：')) })
查('提到了平台', () => { assert.ok(句.includes(当前平台())) })
查('没环境文件时给空串', () => { assert.equal(建环境({ 根: join(目录, '没有') }).拼注入(), '') })

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
