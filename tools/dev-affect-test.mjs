// 情绪形状 · 本地验证（2026-11-06）
// 跑法：node plugins/dsh-fishkit/tools/dev-affect-test.mjs

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  判规则, 加扰动, 形状相似, 形状分, 形状向量, 从状态造点,
  建点本, 点的键, 抠JSON, 判情绪点, 轴们,
} from '../lib/affect.js'

const 说 = (s) => process.stdout.write(s + '\n')
let 过 = 0
const 查 = async (名, fn) => {
  try { await fn(); 过 += 1; 说('  ✓ ' + 名) } catch (error) { 说('  ✗ ' + 名 + ' —— ' + String((error && error.message) || error)); process.exitCode = 1 }
}

说('== 规则判 ==')
await 查('夸一句：效价正、是高兴', () => {
  const 点 = 判规则('好耶，今天真开心！')
  assert.ok(点.valence > 0.4, 'valence=' + 点.valence)
  assert.ok(点.arousal > 0.4, 'arousal=' + 点.arousal)
  assert.equal(点.emotion, '开心')
})
await 查('丧一句：效价负', () => {
  const 点 = 判规则('好难过，烦死了')
  assert.ok(点.valence < -0.4, 'valence=' + 点.valence)
})
await 查('没情绪词是平静', () => {
  assert.equal(判规则('今天下午三点开会').emotion, '平静')
})
await 查('「不得不」是被推着走', () => {
  assert.ok(判规则('不得不把这事儿办了').dominance < 0)
})
await 查('「我决定」是我说了算', () => {
  assert.ok(判规则('我决定今晚早点睡').dominance > 0)
})
await 查('「一起」偏热络', () => {
  assert.ok(判规则('咱们一起吃饭吧').warmth > 0)
})
await 查('「随便」偏疏离', () => {
  assert.ok(判规则('随便吧，不想理了').warmth < 0)
})
await 查('「嘛呀～」偏温和', () => {
  assert.ok(判规则('别急嘛～').softness > 0)
})
await 查('「必须」偏强硬', () => {
  assert.ok(判规则('必须马上给我').softness < 0)
})
await 查('六根轴都在 -1~1', () => {
  const 点 = 判规则('啊啊啊！！！好烦好烦，必须现在给我！一起走吧嘛～')
  for (const 轴 of 轴们) {
    assert.ok(Number.isFinite(点[轴.键]), 轴.键 + ' 不是数')
    const 低 = 轴.键 === 'arousal' ? 0 : -1
    assert.ok(点[轴.键] >= 低 && 点[轴.键] <= 1, 轴.键 + '=' + 点[轴.键])
  }
})

说('== 扰动 ==')
await 查('不抖就不变', () => {
  const 原 = { valence: 0.5, arousal: 0.5, dominance: 0, warmth: 0.2, optimism: 0.1, softness: 0.3 }
  const 新 = 加扰动(原, { 幅度: 0, 歪概率: 0, 随机: () => 0.5 })
  for (const 轴 of 轴们) assert.equal(新[轴.键], 原[轴.键])
})
await 查('平时只抖一点点', () => {
  const 原 = { valence: 0.5, arousal: 0.5, dominance: 0, warmth: 0.2, optimism: 0.1, softness: 0.3 }
  const 新 = 加扰动(原, { 幅度: 0.05, 歪概率: 0, 随机: () => 0.99 })
  const 变 = 轴们.map((轴) => Math.abs(新[轴.键] - 原[轴.键]))
  assert.ok(Math.max(...变) <= 0.05 + 1e-9, '抖得太狠：' + Math.max(...变))
})
await 查('小概率会歪出去一根', () => {
  const 原 = { valence: 0, arousal: 0.5, dominance: 0, warmth: 0, optimism: 0, softness: 0 }
  // 随机恒 0：歪概率判定 0 < 0.02 成立，接着挑轴 / 方向
  const 新 = 加扰动(原, { 幅度: 0, 歪概率: 1, 随机: () => 0 })
  assert.ok(新.歪了, '应该记下歪的是哪根')
  assert.ok(Math.abs(新[新.歪了]) > 0.25, '歪得不够明显：' + 新[新.歪了])
})

说('== 形状 ==')
await 查('一模一样的形状 = 1', () => {
  const a = { valence: 0.8, arousal: 0.8, dominance: 0.2, warmth: 0.6, optimism: 0.7, softness: 0.5 }
  assert.ok(Math.abs(形状相似(a, a) - 1) < 1e-9)
})
await 查('完全反过来的形状 = -1', () => {
  const a = { valence: 0.8, arousal: 0.8, dominance: 0.2, warmth: 0.6, optimism: 0.7, softness: 0.5 }
  const b = {}
  for (const 轴 of 轴们) b[轴.键] = -a[轴.键]
  assert.ok(Math.abs(形状相似(a, b) + 1) < 1e-9)
})
await 查('只差整体大小，形状还算一样', () => {
  const a = { valence: 0.4, arousal: 0.4, dominance: 0.1, warmth: 0.3, optimism: 0.35, softness: 0.25 }
  const b = { valence: 0.8, arousal: 0.8, dominance: 0.2, warmth: 0.6, optimism: 0.7, softness: 0.5 }
  assert.ok(形状相似(a, b) > 0.99, '比例一样就该像：' + 形状相似(a, b))
})
await 查('形状分落在 0~1', () => {
  const a = { valence: 0.8, arousal: 0.1 }
  const b = { valence: -0.8, arousal: 0.9 }
  const s = 形状分(a, b)
  assert.ok(s >= 0 && s <= 1, 's=' + s)
})
await 查('形状向量减掉了自己的均值', () => {
  const v = 形状向量({ valence: 1, arousal: 1, dominance: 1, warmth: 1, optimism: 1, softness: 1 })
  assert.ok(v.every((x) => Math.abs(x) < 1e-9))
})

说('== 从状态造点 ==')
await 查('心情和人设维都借过来', () => {
  const 点 = 从状态造点({
    mood: { valence: -0.3, arousal: 0.6 },
    dims: [{ key: '热络-疏离', value: 0.2 }, { key: '乐观-悲观', value: -0.4 }, { key: '温和-强硬', value: 0.1 }],
  })
  assert.equal(点.valence, -0.3)
  assert.equal(点.arousal, 0.6)
  assert.equal(点.warmth, 0.2)
  assert.equal(点.optimism, -0.4)
  assert.equal(点.softness, 0.1)
})
await 查('什么都没有也给个中性点', () => {
  const 点 = 从状态造点(null)
  for (const 轴 of 轴们) assert.ok(Number.isFinite(点[轴.键]))
})

说('== 点本 ==')
const 目录 = mkdtempSync(join(tmpdir(), 'fishkit-affect-'))
mkdirSync(join(目录, 'memory'), { recursive: true })
const 点本 = 建点本({ 根: 目录, 记账: () => {} })
await 查('记一个点就读得回来', () => {
  assert.ok(点本.记({ time: '2026-11-06T10:00:00+08:00', 摘要: '测试一句', emotion: '开心', valence: 0.7, arousal: 0.6, 来源: 'rule' }))
  const 们 = 点本.读()
  assert.equal(们.length, 1)
  assert.equal(们[0].emotion, '开心')
})
await 查('同一时间 + 摘要，后来者盖前面的', () => {
  点本.记({ time: '2026-11-06T10:00:00+08:00', 摘要: '测试一句', emotion: '平静', valence: 0.1, 来源: 'model' })
  const 表 = 点本.索引()
  assert.equal(表.size, 1)
  assert.equal(表.get(点的键({ time: '2026-11-06T10:00:00+08:00', summary: '测试一句' })).来源, 'model')
})
await 查('老事件补点：不重复补', () => {
  writeFileSync(join(目录, 'memory', 'events.jsonl'), [
    JSON.stringify({ time: '2026-11-05T09:00:00+08:00', summary: '老事件一', valence: 0.2, arousal: 0.3, emotion: '平静' }),
    JSON.stringify({ time: '2026-11-05T09:01:00+08:00', summary: '老事件二' }),
    JSON.stringify({ time: '2026-11-05T09:02:00+08:00', summary: '老事件三', valence: -0.5, arousal: 0.8, emotion: '生气' }),
  ].join('\n') + '\n', 'utf8')
  const 一 = 点本.补()
  assert.equal(一.补了, 2, '两条有情绪的该补')
  const 二 = 点本.补()
  assert.equal(二.补了, 0, '第二次不该重复补')
})
await 查('时间隧道按顺序给出来', () => {
  const 线 = 点本.时间隧道({ 最多: 10 })
  assert.ok(线.length >= 2)
  assert.ok(线.every((x) => typeof x.valence === 'number' && typeof x.arousal === 'number'))
})

说('== 模拟模型档 ==')
await 查('抠 JSON：带废话也抠得出来', () => {
  const j = 抠JSON('好的，这是结果：{"valence":0.5,"arousal":0.3,"emotion":"高兴"} 完毕')
  assert.equal(j.emotion, '高兴')
  assert.equal(抠JSON('没有 json'), null)
})
await 查('档=规则 时不碰模型', async () => {
  const 点 = await 判情绪点({ 文本: '好开心！', 档: '规则' })
  assert.equal(点.来源, 'rule')
})
await 查('规则打底 + 模型兜底：有词就不调模型', async () => {
  let 调了 = 0
  const ctx = { llm: { stream: async function* () { 调了 += 1; yield { type: 'text-delta', text: '{}' } } } }
  const 点 = await 判情绪点({ 文本: '好开心呀', 档: '规则+模型', ctx })
  assert.equal(点.来源, 'rule')
  assert.equal(调了, 0)
})
await 查('规则认不出、话又不短：才去问模型', async () => {
  const ctx = {
    llm: {
      stream: async function* () {
        yield { type: 'text-delta', text: '{"valence":0.2,"arousal":0.3,"dominance":0.1,"warmth":0.4,"optimism":0.3,"softness":0.5,"emotion":"平静"}' }
      },
    },
  }
  const 点 = await 判情绪点({ 文本: '那个东西放在桌子的左边上面', 档: '规则+模型', ctx })
  assert.equal(点.来源, 'model')
  assert.equal(点.warmth, 0.4)
})
await 查('模型挂了就退回规则，不报错', async () => {
  const ctx = { llm: { stream: async function* () { throw new Error('断网') } } }
  const 点 = await 判情绪点({ 文本: '那个东西放在桌子的左边上面', 档: '模型', ctx })
  assert.ok(点.来源.startsWith('rule'))
})

rmSync(目录, { recursive: true, force: true })
说('')
说(process.exitCode ? '有没过的' : '全过了：' + 过 + ' 项')
