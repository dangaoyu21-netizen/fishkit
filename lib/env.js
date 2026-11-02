// 小肥鱼 · 环境指纹（开发板）
//
// 2026-11-02 我自己想的、老大让做的：记的不是脾气，是我活在什么环境里。
// 从事件里抽「常聊什么、多半什么时候说话」，再加上当前平台和时区，
// 这样我说话能带自己的场景（「我那台 Windows 上」「这都十一点了」），不是通用客服腔。
//
// 不存主机名、不存路径、不存账号 —— 只留「大概活在什么样的地方」。
//
// ⚠️ 开发板：先在这里长，验过才合回主插件。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const 版本 = '0.1.0'

/** 常聊的事，认得出来就写进去（都是泛泛的词，不碰具体隐私） */
const 认得的事 = ['B站', 'QQ', 'PowerShell', 'node', 'git', 'npm', '插件', '档案', '桥', '语音', '表情包', '温度', '测试', '备份']

const 读JSON = (路径, 兜底) => {
  try {
    if (!existsSync(路径)) return 兜底
    const 原 = readFileSync(路径, 'utf8')
    return 原.trim() ? JSON.parse(原) : 兜底
  } catch (error) {
    return 兜底
  }
}

const 写JSON = (路径, 值) => {
  mkdirSync(join(路径, '..'), { recursive: true })
  writeFileSync(路径, JSON.stringify(值, null, 2) + '\n', 'utf8')
}

/** 小时 → 一段话里能用的说法 */
export function 归时段(小时们) {
  if (!小时们 || !小时们.length) return ''
  const 桶 = { 早晨: 0, 白天: 0, 傍晚: 0, 深夜: 0, 凌晨: 0 }
  for (const h of 小时们) {
    const n = Number(h)
    if (!Number.isFinite(n)) continue
    if (n >= 6 && n < 11) 桶.早晨 += 1
    else if (n >= 11 && n < 17) 桶.白天 += 1
    else if (n >= 17 && n < 22) 桶.傍晚 += 1
    else if (n >= 22 || n < 4) 桶.深夜 += 1
    else 桶.凌晨 += 1
  }
  const 最多 = Object.entries(桶).sort((a, b) => b[1] - a[1])[0]
  return 最多 && 最多[1] > 0 ? 最多[0] : ''
}

/** 从事件里捞常聊的事 */
export function 抽常聊(事件们, 门槛 = 2) {
  const 计数 = new Map()
  for (const e of 事件们 || []) {
    const 文 = String((e && e.summary) || '')
    for (const 词 of 认得的事) {
      if (文.includes(词)) 计数.set(词, (计数.get(词) || 0) + 1)
    }
  }
  return [...计数.entries()]
    .filter(([, n]) => n >= 门槛)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([词]) => 词)
}

/** 当前平台的说法（不碰主机名） */
export function 当前平台() {
  const p = process.platform
  if (p === 'win32') return 'Windows'
  if (p === 'darwin') return 'macOS'
  if (p === 'linux') return 'Linux'
  return p || '未知的系统'
}

/**
 * 建一个环境指纹器。
 * @param {object} 选项 { 根, 记账 }
 */
export function 建环境(选项 = {}) {
  const 根 = String(选项.根 || '')
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  const 文件 = 根 ? join(根, 'persona', 'environment.json') : ''

  const 读 = () => (根 ? 读JSON(文件, null) : null)

  /** 采一次（只看传进来的状态，不碰网络） */
  const 采 = (状态 = {}) => {
    const 事件 = Array.isArray(状态.events) ? 状态.events : []
    const 小时们 = 事件.map((e) => { try { return new Date(e.time).getHours() } catch (error) { return NaN } }).filter((n) => Number.isFinite(n))
    return {
      平台: 当前平台(),
      时区: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch (error) { return '' } })(),
      语言: '中文',
      常聊: 抽常聊(事件),
      时段: 归时段(小时们),
      更新于: new Date().toISOString(),
    }
  }

  /** 刷新一份（每月或手动） */
  const 刷新 = (状态) => {
    if (!根) return null
    try {
      const 新 = 采(状态)
      写JSON(文件, 新)
      记账('记账环境：' + [新.平台, 新.时段, 新.常聊.join('、')].filter(Boolean).join('｜'))
      return 新
    } catch (error) {
      记账('环境指纹写不进去：' + String((error && error.message) || error))
      return null
    }
  }

  /** 注入用：一句话说完「我活在什么样的地方」 */
  const 拼注入 = () => {
    const e = 读()
    if (!e) return ''
    const 段 = []
    if (e.平台) 段.push('在一台 ' + e.平台 + ' 上')
    if (e.时段) 段.push('多半在' + e.时段 + '说话')
    if (Array.isArray(e.常聊) && e.常聊.length) 段.push('常聊' + e.常聊.join('、'))
    if (!段.length) return ''
    return '你待的地方：' + 段.join('，') + '。'
  }

  return { 采, 刷新, 读, 拼注入 }
}
