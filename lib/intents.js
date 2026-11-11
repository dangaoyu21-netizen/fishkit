// 意图本（2026-11-11）
//
// 为什么要它：以前「主动找事」是定时器塞一句「你闲着，去逛逛吧」，方向是配置给的。
// 有了它，我空闲时先翻自己写下的「想做的事」，做完补一句结果；翻空了才走老路子。
// 也允许写「今天不想动」——那是我的判断，不是提示词替我决定的。
//
// 存在 .fishsoul/behavior/intents.jsonl，一行一条：
//   { id, 写于, 想做什么, 为什么, 状态, 结果 }
//   状态：想做 / 在做 / 做完了 / 不做了 / 不想动

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const 版本 = '0.1.0'

export const 状态们 = ['想做', '在做', '做完了', '不做了', '不想动']

/** 读一堆 jsonl，坏行跳过 */
const 读行 = (文件) => {
  if (!existsSync(文件)) return []
  const 出 = []
  for (const 行 of readFileSync(文件, 'utf8').split('\n')) {
    if (!行.trim()) continue
    try { 出.push(JSON.parse(行)) } catch (error) { /* 坏行跳过 */ }
  }
  return 出
}

export function 建意图本({ 根, 记账 = () => {} } = {}) {
  const 文件 = 根 ? join(根, 'behavior', 'intents.jsonl') : ''

  const 读 = () => 读行(文件)

  /** 写一条新意图。想做什么不能空。 */
  const 记 = ({ 想做什么, 为什么 = '' } = {}) => {
    const 话 = String(想做什么 || '').trim()
    if (!文件 || !话) return null
    try {
      mkdirSync(join(根, 'behavior'), { recursive: true })
      const 行 = {
        id: 'int-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        写于: new Date().toISOString(),
        想做什么: 话,
        为什么: String(为什么 || '').trim(),
        状态: '想做',
        结果: '',
      }
      // 文件可能还不存在，先判一下再读
      const 旧 = existsSync(文件) ? readFileSync(文件, 'utf8') : ''
      writeFileSync(文件, 旧 + JSON.stringify(行) + '\n', 'utf8')
      记账('写了一条意图：' + 话.slice(0, 30))
      return 行
    } catch (error) {
      记账('意图存不上：' + String((error && error.message) || error))
      return null
    }
  }

  /** 改一条的状态（顺便可以补结果） */
  const 标 = (id, 状态, 结果 = '') => {
    if (!文件 || !id) return false
    const 全 = 读()
    const 找 = 全.find((x) => x && x.id === id)
    if (!找) return false
    找.状态 = 状态们.includes(状态) ? 状态 : '想做'
    if (结果) 找.结果 = String(结果)
    try {
      writeFileSync(文件, 全.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8')
      记账('意图「' + String(找.想做什么 || '').slice(0, 20) + '」标成：' + 找.状态)
      return true
    } catch (error) {
      记账('意图改状态失败：' + String((error && error.message) || error))
      return false
    }
  }

  /** 挑一条该做的：先看「不想动」管不管今天，再看最早的「想做」 */
  const 挑一条 = (现在 = new Date()) => {
    const 全 = 读().filter((x) => x && x.状态)
    // 今天写过「不想动」→ 今天就歇着，不挑
    const 今天 = 现在.toISOString().slice(0, 10)
    const 歇着 = 全.some((x) => x.状态 === '不想动' && String(x.写于 || '').slice(0, 10) === 今天)
    if (歇着) return { 歇着: true, 条: null }
    const 想做 = 全.filter((x) => x.状态 === '想做')
    if (!想做.length) return { 歇着: false, 条: null }
    // 写在前面的先做（别老挑最新的，容易永远做刚写的）
    return { 歇着: false, 条: 想做[0] }
  }

  /** 设置页/注入用的短句 */
  const 一句话 = () => {
    const 全 = 读()
    const 想做 = 全.filter((x) => x.状态 === '想做')
    const 做完 = 全.filter((x) => x.状态 === '做完了')
    if (!全.length) return ''
    return '想做 ' + 想做.length + ' 件' + (做完.length ? '，做完 ' + 做完.length + ' 件' : '')
      + (想做.length ? '：' + 想做.slice(0, 3).map((x) => String(x.想做什么 || '').slice(0, 12)).join('、') : '')
  }

  return { 版本, 记, 读, 标, 挑一条, 一句话, 文件 }
}
