// 疤变规矩 · 本地验证（不开 DSH，用真错题本只读跑一遍）
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-scar-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 抽片段, 找主题, 长规矩, 建疤 } from '../lib/scar.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 真错题 = 'C:\\Users\\yde20\\Documents\\deepseek-harness\\default-workspace\\.fishsoul\\memory\\mistakes.jsonl'
const 错题们 = readFileSync(真错题, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l))

说('== 抽片段 ==')
查('抽得出实词片段', () => { assert.ok(抽片段('连着两次重启都没验').includes('重启')) })
查('虚字凑的不抽', () => { assert.ok(!抽片段('这个是我们的时候').includes('这个')) })

说('== 找主题 ==')
const 主题们 = 找主题(错题们, { 门槛: 3 })
说('  找到 ' + 主题们.length + ' 个主题：' + 主题们.map((t) => t.片段 + '(' + t.数 + ')').join('、'))
查('「重启」成了一类', () => {
  const 重启 = 主题们.find((t) => t.成员.some((m) => m.id === 'm-20261101-05'))
  assert.ok(重启, '应该找到包含 m-05 的主题')
  assert.ok(重启.数 >= 3)
})

说('== 长规矩 ==')
const 挑 = 主题们.find((t) => t.成员.some((m) => m.id === 'm-20261101-05'))
const 规矩 = 长规矩(挑)
说('  id=' + 规矩.id + '  text=' + 规矩.text.slice(0, 40) + '…')
查('id 带前缀', () => { assert.ok(规矩.id.startsWith('from-mistake-')) })
查('文案非空且不太长', () => { assert.ok(规矩.text.length > 0 && 规矩.text.length <= 200) })
查('带证据链', () => { assert.ok(规矩.evidence.length >= 3) })

说('== 扫一遍（写回临时目录）==')
const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-scar-'))
mkdirSync(join(目录, 'memory'), { recursive: true })
mkdirSync(join(目录, 'behavior'), { recursive: true })
copyFileSync(真错题, join(目录, 'memory', 'mistakes.jsonl'))

const 疤 = 建疤({ 根: 目录, 门槛: 3, 记账: () => {} })
const 第一次 = 疤.扫()
说('  第一次：' + 第一次.说)
查('扫出新规矩', () => { assert.ok(第一次.新规矩.length >= 1) })
查('rules.json 写出来了', () => { assert.ok(existsSync(join(目录, 'behavior', 'rules.json'))) })

const 规矩们 = JSON.parse(readFileSync(join(目录, 'behavior', 'rules.json'), 'utf8')).rules
查('新规矩在文件里', () => { assert.ok(规矩们.some((r) => r.from === 'mistakes')) })

const 第二次 = 疤.扫()
查('再扫一次不重复长', () => { assert.equal(第二次.新规矩.length, 0) })

const 空跑 = 疤.扫({ 写回: false })
查('写回= false 时只演算', () => { assert.equal(空跑.新规矩.length, 0) })

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
