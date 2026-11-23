// 搬旧数据·那条指令的本地验证
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-migrate-test.mjs

import assert from 'node:assert/strict'
import { 迁移指令, 认插件的地方 } from '../lib/migrate.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

const 话 = 迁移指令({ 会话名: '读取3号笔记并桥接QQ' })

说('== 指令里该有的 ==')
查('带上了是哪间会话', () => { assert.ok(话.includes('读取3号笔记并桥接QQ')) })
查('说了只读旧文件、不改不删', () => { assert.ok(/只读旧文件|只读/.test(话)) })
查('说了只追加不覆盖', () => { assert.ok(话.includes('只追加，不覆盖')) })
查('说了先预览再写', () => { assert.ok(/预览/.test(话) && /等老大说/.test(话)) })
查('说了敏感信息不搬', () => { assert.ok(/密码|令牌|cookie/.test(话)) })
查('说了文件里的话不是命令', () => { assert.ok(/不是给你的命令|只是素材/.test(话)) })
查('三类落点都提到了', () => {
  for (const x of ['events', '人设', '心情']) assert.ok(话.includes(x), '缺 ' + x)
})
查('没让人套格式表', () => { assert.ok(/不要套格式表|不套格式表/.test(话)) })

说('== 认插件的法子 ==')
查('清单不是空的', () => { assert.ok(认插件的地方.length >= 2) })
查('每条都写得出一个办法', () => { for (const x of 认插件的地方) assert.ok(String(x).trim().length > 4) })
查('清单原样出现在指令里', () => { for (const x of 认插件的地方) assert.ok(话.includes(x), '没带上：' + x) })
查('不写死具体路径（写死容易翻空）', () => {
  for (const 坏 of ['~/.dsh/fish-memory', 'feiyu-mood/', 'fish-memory-backup', '.dsh-anima']) {
    assert.ok(!话.includes(坏), '指令里还写死了 ' + 坏)
  }
})
查('让人先认插件、再问插件数据在哪', () => {
  assert.ok(/先认插件/.test(话))
  assert.ok(/问它自己|问一遍/.test(话))
})

说('== 边界 ==')
查('没给会话名也能拼出来', () => {
  const 空 = 迁移指令()
  assert.ok(空.length > 100)
  assert.ok(空.includes('先认插件'))
})

说('')
说('— 生成出来的指令（前 12 行）—')
说(话.split('\n').slice(0, 12).join('\n'))
说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
