// 给记忆改颜色 · 本地验证（2026-11-21）
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-shape-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建档案核心 } from '../lib/fishsoul.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 工作区 = mkdtempSync(join(tmpdir(), 'fishkit-shape-'))
mkdirSync(join(工作区, '.fishsoul', 'memory'), { recursive: true })
const 事件文件 = join(工作区, '.fishsoul', 'memory', 'events.jsonl')
const 原 = [
  { id: 'evt-1', summary: '第一件事', valence: 0, arousal: 0.1, emotion: '平静', 区: '这几天' },
  { id: 'evt-2', summary: '第二件事', valence: 0.3, arousal: 0.2, emotion: '平静', 区: '这几天' },
]
writeFileSync(事件文件, 原.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8')

const 档 = 建档案核心(工作区)

说('== 改之前 ==')
查('读得到两条', () => {
  assert.equal(readFileSync(事件文件, 'utf8').split('\n').filter(Boolean).length, 2)
})

说('== 改 ==')
const 果 = 档.改事件('evt-1', { valence: 0.8, arousal: 0.6, emotion: '高兴' })
查('改成功了', () => { assert.ok(果.ok, JSON.stringify(果)) })
查('颜色真的变了', () => {
  const 行 = readFileSync(事件文件, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x))
  const 一 = 行.find((x) => x.id === 'evt-1')
  assert.equal(一.valence, 0.8)
  assert.equal(一.arousal, 0.6)
  assert.equal(一.emotion, '高兴')
})
查('别的条目没被动', () => {
  const 行 = readFileSync(事件文件, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x))
  const 二 = 行.find((x) => x.id === 'evt-2')
  assert.equal(二.valence, 0.3)
  assert.equal(二.emotion, '平静')
})
查('留了备份', () => { assert.ok(existsSync(事件文件 + '.bak-shape')) })
查('记了改的时间', () => {
  const 行 = readFileSync(事件文件, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x))
  assert.ok(行.find((x) => x.id === 'evt-1').改于)
})
查('没有残留的临时文件', () => { assert.ok(!existsSync(事件文件 + '.tmp')) })

说('== 越界和出错 ==')
查('valence 超出范围会被夹住', () => {
  档.改事件('evt-2', { valence: 9 })
  const 行 = readFileSync(事件文件, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x))
  assert.equal(行.find((x) => x.id === 'evt-2').valence, 1)
})
查('arousal 负数会被夹到 0', () => {
  档.改事件('evt-2', { arousal: -5 })
  const 行 = readFileSync(事件文件, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x))
  assert.equal(行.find((x) => x.id === 'evt-2').arousal, 0)
})
查('改不存在的 id 会说不', () => {
  const r = 档.改事件('evt-不存在', { valence: 0.5 })
  assert.equal(r.ok, false)
})
查('不给 id 也会说不', () => {
  const r = 档.改事件('', { valence: 0.5 })
  assert.equal(r.ok, false)
})
查('原文被改坏时，改不动它', () => {
  writeFileSync(事件文件, 'not json\n', 'utf8')
  const r = 档.改事件('evt-1', { valence: 0.5 })
  assert.equal(r.ok, false)
})
查('改坏了也不把文件写成空', () => {
  assert.ok(readFileSync(事件文件, 'utf8').includes('not json'))
})

rmSync(工作区, { recursive: true, force: true })
说('\n✅ 全过（' + 过 + ' 项）')
