// 情绪牵制 + 人设振幅 · 本地验证（2026-11-14）
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-affect-bind-test.mjs

import assert from 'node:assert/strict'
import { 牵制, 人设振幅, 加扰动, 从状态造点 } from '../lib/affect.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = (名, fn) => {
  try { fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

说('== 牵制：高兴的时候不容易冷 ==')
查('valence 0.8 + softness -0.5 → softness 被拉上来', () => {
  const p = 牵制({ valence: 0.8, softness: -0.5, arousal: 0, optimism: 0, dominance: 0, warmth: 0 })
  assert.ok(p.softness >= 0.1, 'softness 该被拉到 0.1 以上，实际 ' + p.softness)
})
查('valence 0.2（不够高）→ 不动', () => {
  const p = 牵制({ valence: 0.2, softness: -0.5, arousal: 0, optimism: 0, dominance: 0, warmth: 0 })
  assert.equal(p.softness, -0.5)
})

说('== 牵制：激动的时候容易乐观 ==')
查('arousal 0.9 + optimism -0.4 → optimism 被托起来', () => {
  const p = 牵制({ valence: 0, softness: 0, arousal: 0.9, optimism: -0.4, dominance: 0, warmth: 0 })
  assert.ok(p.optimism >= 0.2, 'optimism 该被托到 0.2 以上，实际 ' + p.optimism)
})
查('arousal 0.3 → 不动', () => {
  const p = 牵制({ valence: 0, softness: 0, arousal: 0.3, optimism: -0.4, dominance: 0, warmth: 0 })
  assert.equal(p.optimism, -0.4)
})

说('== 牵制：没底气的时候会软 ==')
查('dominance -0.8 + softness -0.5 → softness 被拉回 0 以上', () => {
  const p = 牵制({ valence: 0, softness: -0.5, arousal: 0, optimism: 0, dominance: -0.8, warmth: 0 })
  assert.ok(p.softness > 0, 'softness 该被拉过 0，实际 ' + p.softness)
})
查('dominance 0 → 不动', () => {
  const p = 牵制({ valence: 0, softness: -0.5, arousal: 0, optimism: 0, dominance: 0, warmth: 0 })
  assert.equal(p.softness, -0.5)
})
查('牵制不改别的轴', () => {
  const p = 牵制({ valence: 0.8, softness: -0.5, arousal: 0.4, optimism: 0.1, dominance: 0.2, warmth: 0.3 })
  assert.equal(p.valence, 0.8)
  assert.equal(p.arousal, 0.4)
  assert.equal(p.warmth, 0.3)
})

说('== 人设振幅 ==')
查('谨慎（-1）→ 0.7', () => {
  const 幅 = 人设振幅({ dims: [{ key: '谨慎-冒进', value: -1 }] })
  assert.equal(幅, 0.7)
})
查('冒进（+1）→ 1.3', () => {
  const 幅 = 人设振幅({ dims: [{ key: '谨慎-冒进', value: 1 }] })
  assert.equal(幅, 1.3)
})
查('没这一维 → 1', () => {
  assert.equal(人设振幅({ dims: [] }), 1)
})

说('== 扰动乘振幅 ==')
查('谨慎的人抖得比冒进的人小', () => {
  const 原 = { valence: 0, softness: 0, arousal: 0, optimism: 0, dominance: 0, warmth: 0 }
  // 固定随机数：0.999 让每根轴都往正方向抖满
  const 固定 = () => 0.999
  const 小 = 加扰动({ ...原, 振幅: 0.7 }, { 随机: 固定, 歪概率: 0 })
  const 大 = 加扰动({ ...原, 振幅: 1.3 }, { 随机: 固定, 歪概率: 0 })
  assert.ok(大.valence > 小.valence, '冒进的该抖得更大：' + 小.valence + ' vs ' + 大.valence)
})

说('== 从状态造点带振幅、且过了牵制 ==')
查('造出来的点有振幅字段', () => {
  const 点 = 从状态造点({ mood: { valence: 0.1, arousal: 0.2 }, dims: [{ key: '谨慎-冒进', value: 0.5 }] })
  assert.equal(typeof 点.振幅, 'number')
  assert.ok(点.振幅 > 1, '冒进一点该 >1，实际 ' + 点.振幅)
})
查('高兴的状态造出来的点，不会又高兴又冷', () => {
  const 点 = 从状态造点({ mood: { valence: 0.9, arousal: 0.2 }, dims: [{ key: '软硬', value: -0.9 }] })
  assert.ok(点.softness >= 0.1, '该被牵制拉起来，实际 ' + 点.softness)
})

说('')
说(process.exitCode ? '✗ 有没过的' : '✅ 全过（' + 过 + ' 项）')
