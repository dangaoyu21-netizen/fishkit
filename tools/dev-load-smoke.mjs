// 加载冒烟：模拟一个宿主把 lib/index.js 的 apply 跑一遍（2026-11-06）
// 跑法：node plugins/dsh-fishkit/tools/dev-load-smoke.mjs
//
// 目的：重启前先确认「插件挂得上」—— import 不炸、apply 不抛、路由都注册了。
// 不碰 QQ、不发消息；档案那边只会读状态、补情绪点（本来就该补）。

import assert from 'node:assert/strict'
import { apply, name, inject } from '../lib/index.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

说('== 插件导出 ==')
查('有 name', () => assert.equal(typeof name, 'string'))
查('inject 里有 llm', () => assert.ok(inject.includes('llm')))

说('== apply 跑一遍 ==')
const 路由们 = []
const 工具们 = []
const 监听们 = []
const ctx = {
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  effect: (fn) => {
    const 果 = typeof fn === 'function' ? fn() : null
    return () => { try { if (typeof 果 === 'function') 果() } catch (error) {} }
  },
  on: (名, fn) => { 监听们.push(名); return () => {} },
  interval: () => () => {},
  setTimeout: (fn, ms) => setTimeout(fn, 0), // 诊断那段别等 12 秒
  webServer: { register: (r) => { 路由们.push(r.path); return () => {} } },
  agents: { list: () => [], get: () => null },
  get: (k) => {
    if (k === 'sessions') return { list: () => [] }
    if (k === 'sessionTitle') return { get: () => undefined }
    return null
  },
  tools: { register: (t) => { 工具们.push(t.name); return () => {} } },
  systemPrompt: { context: () => () => {} },
  llm: { stream: async function* () {} },
}

let 炸了 = null
try { apply(ctx) } catch (error) { 炸了 = error }
查('apply 没抛错', () => { assert.equal(炸了, null, 炸了 && String(炸了.stack || 炸了)) })

查('路由注册了', () => { assert.ok(路由们.length >= 20, '只有 ' + 路由们.length + ' 条') })
查('有 /dsh-fishsoul/affect', () => assert.ok(路由们.includes('/dsh-fishsoul/affect')))
查('有 /dsh-fishsoul/qr', () => assert.ok(路由们.includes('/dsh-fishsoul/qr')))
查('有 /dsh-fishsoul/browse', () => assert.ok(路由们.includes('/dsh-fishsoul/browse')))
查('有 /dsh-fishsoul/qqlink', () => assert.ok(路由们.includes('/dsh-fishsoul/qqlink')))
查('有 /dsh-fishsoul/state', () => assert.ok(路由们.includes('/dsh-fishsoul/state')))
查('听了 session/event', () => assert.ok(监听们.includes('session/event')))

说('')
说('路由 ' + 路由们.length + ' 条')
说(process.exitCode ? '有没过的' : '全过了：' + 过 + ' 项')
