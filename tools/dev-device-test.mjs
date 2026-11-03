// 设备码 · 本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-device-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { 建设备, 码长 } from '../lib/device.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

// 假装这台机器的标识（真的注册表在这个沙箱里读不到，插件里能读到）
const 假机器 = '11111111-2222-3333-4444-555555555555'

const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-device-'))
const 备 = 建设备({ 根: 目录, 取标识: () => 假机器, 记账: () => {} })

说('== 生成 ==')
const 一 = 备.初始化()
查('文件生成了', () => { assert.ok(existsSync(join(目录, 'persona', 'device.json'))) })
查('有 uuid', () => { assert.match(一.uuid, /^[0-9a-f-]{36}$/) })
查('设备码是 32 位十六进制', () => { assert.match(一.设备码, new RegExp('^[0-9a-f]{' + 码长 + '}$')) })
查('有盐', () => { assert.equal(一.盐.length, 32) })

说('== 原文不落盘 ==')
const 盘上 = readFileSync(join(目录, 'persona', 'device.json'), 'utf8')
查('档案里没有机器标识原文', () => { assert.ok(!盘上.includes(假机器)) })
查('档案里也没有不带横杠的写法', () => { assert.ok(!盘上.includes(假机器.replace(/-/g, ''))) })

说('== 稳定 ==')
const 二 = 备.初始化()
查('第二次不重新生成', () => { assert.equal(一.uuid, 二.uuid) })
查('设备码也不变', () => { assert.equal(一.设备码, 二.设备码) })

说('== 换个盐就变 ==')
const 目录2 = mkdtempSync(join(tmpdir(), 'fishkit-device2-'))
const 备2 = 建设备({ 根: 目录2, 取标识: () => 假机器, 记账: () => {} })
查('同样的机器、不同的盐，设备码不一样', () => { assert.notEqual(备2.初始化().设备码, 一.设备码) })

说('== 摘要 ==')
const 摘 = 备.摘要()
说('  ' + JSON.stringify(摘))
查('摘要是短的', () => { assert.equal(摘.短码.length, 8) })
查('带 uuid', () => { assert.ok(摘.uuid.length > 0) })

说('== 读不到标识时 ==')
const 目录3 = mkdtempSync(join(tmpdir(), 'fishkit-device3-'))
const 备3 = 建设备({ 根: 目录3, 取标识: () => '', 记账: () => {} })
const 三 = 备3.初始化()
查('只留 uuid，设备码空着', () => { assert.ok(三.uuid) && assert.equal(三.设备码, '') })
查('摘要标着没有设备码', () => { assert.equal(备3.摘要().有设备码, false) })

rmSync(目录, { recursive: true, force: true })
rmSync(目录2, { recursive: true, force: true })
rmSync(目录3, { recursive: true, force: true })
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
