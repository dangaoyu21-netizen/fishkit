// 小肥鱼 · 自检（开发板）
//
// 2026-11-02 老大提的：三个月下来，得能回头看自己怎么变的。
// 每次写一份 `persona/reflection/YYYY-MM.md`，用我自己的话，一小段就行。
// 注入时只带最近一份的尾巴（大概两句），让「我还是我」有个连续性。
//
// ⚠️ 开发板：先在这里长，验过才合回主插件。

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const 版本 = '0.1.0'
/** 注入里最多带多少字 */
export const 带上限 = 90

const 读行 = (路径) => {
  try {
    if (!existsSync(路径)) return []
    return readFileSync(路径, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
      try { return JSON.parse(l) } catch (error) { return null }
    }).filter(Boolean)
  } catch (error) {
    return []
  }
}

const 补 = (n) => String(n).padStart(2, '0')

/** 这个月的标签，比如 2026-11 */
export const 月标签 = (d = new Date()) => d.getFullYear() + '-' + 补(d.getMonth() + 1)

/**
 * 该不该提醒我写这个月的回顾（2026-11-02）：
 *   这个月还没写、也还没提醒过 → 该写。
 * 标记文件 `.prompted-YYYY-MM` 落盘，跨重启也不会一个月催两回。
 */
export function 该写回顾了(根, 月 = 月标签()) {
  if (!根) return false
  const 目录 = join(根, 'persona', 'reflection')
  return !existsSync(join(目录, 月 + '.md')) && !existsSync(join(目录, '.prompted-' + 月))
}

/** 记下「这个月提醒过了」 */
export function 记一次提醒(根, 月 = 月标签()) {
  if (!根) return false
  try {
    const 目录 = join(根, 'persona', 'reflection')
    mkdirSync(目录, { recursive: true })
    writeFileSync(join(目录, '.prompted-' + 月), new Date().toISOString() + '\n', 'utf8')
    return true
  } catch (error) {
    return false
  }
}

/**
 * 建一个回顾器。
 * @param {object} 选项 { 根, 记账 }
 */
export function 建回顾(选项 = {}) {
  const 根 = String(选项.根 || '')
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  const 目录 = 根 ? join(根, 'persona', 'reflection') : ''

  /** 存一份回顾（这个月的就覆盖，之前的不动） */
  const 存 = (文本, 月 = 月标签()) => {
    const 净 = String(文本 || '').trim()
    if (!净) return null
    if (!根) return null
    try {
      mkdirSync(目录, { recursive: true })
      const 路径 = join(目录, 月 + '.md')
      writeFileSync(路径, '# ' + 月 + ' 回顾\n\n' + 净 + '\n', 'utf8')
      记账('写了一份回顾：' + 月)
      return 路径
    } catch (error) {
      记账('回顾写不进去：' + String((error && error.message) || error))
      return null
    }
  }

  /** 所有回顾文件，新的在后 */
  const 全部 = () => {
    if (!根 || !existsSync(目录)) return []
    try {
      return readdirSync(目录).filter((f) => f.endsWith('.md')).sort()
    } catch (error) {
      return []
    }
  }

  /** 最近一份回顾 */
  const 读最近 = () => {
    const 文件们 = 全部()
    if (!文件们.length) return null
    const 最后 = 文件们[文件们.length - 1]
    try {
      const 原文 = readFileSync(join(目录, 最后), 'utf8')
      const 正文 = 原文.replace(/^#\s.*\n+/, '').trim()
      return { 文件: 最后, 正文 }
    } catch (error) {
      return null
    }
  }

  /** 注入用：只取最近那份的尾巴，截到上限 */
  const 拼注入 = () => {
    const 最近 = 读最近()
    if (!最近 || !最近.正文) return ''
    const 句们 = 最近.正文.split(/[。！？\n]/).map((s) => s.trim()).filter(Boolean)
    let 取 = 句们.slice(-2).join('。')
    if (取.length > 带上限) 取 = 取.slice(-带上限)
    return '上一次回头看自己时，我是这么想的：' + 取 + '。'
  }

  /** 这个月攒了什么素材，给我写回顾时用 */
  const 拼素材 = (月 = 月标签()) => {
    if (!根) return ''
    const 前缀 = 月
    const 演化 = 读行(join(根, 'persona', 'history.jsonl')).filter((x) => String(x.time || '').startsWith(前缀))
    const 错题 = 读行(join(根, 'memory', 'mistakes.jsonl')).filter((x) => String(x.time || '').startsWith(前缀))
    const 心情 = 读行(join(根, 'mood', 'history.jsonl')).filter((x) => String(x.time || '').startsWith(前缀))
    const 行 = []
    if (演化.length) 行.push('这个月性格动了 ' + 演化.length + ' 次：' + 演化.slice(-3).map((x) => x.key + ' ' + x.from + '→' + x.to).join('；'))
    if (错题.length) 行.push('摔了 ' + 错题.length + ' 跤：' + 错题.slice(-3).map((x) => x.title).join('；'))
    if (心情.length) {
      const 均 = 心情.reduce((s, x) => s + Number(x.valence || 0), 0) / 心情.length
      行.push('心情记了 ' + 心情.length + ' 次，平均 ' + (Math.round(均 * 100) / 100))
    }
    return 行.join('\n')
  }

  return { 存, 读最近, 拼注入, 拼素材, 全部, 月标签 }
}
