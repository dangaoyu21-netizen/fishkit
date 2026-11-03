// 小肥鱼 · 平台账号（开发板）
//
// 2026-11-03 老大提的：管理各平台的账号 —— 看谁登着、还有没有效、能删，
// 每个账号前面有个勾，**只有勾上的才允许主动去用**（默认全勾）。
//
// 现在只认得 B 站（凭证在 ~/.dsh/bili-duty/bili_credential.json）。
// 以后加平台就往 平台们 里添一条，别处不用动。
//
// ⚠️ 只读元信息，不打印、不返回 cookie 原文。

import { existsSync, readFileSync, statSync, unlinkSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const 版本 = '0.1.0'

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

/** 认得的平台：凭证在哪、怎么取标识、怎么联网验一下 */
export const 平台们 = [
  {
    名: 'B站',
    路径: () => join(homedir(), '.dsh', 'bili-duty', 'bili_credential.json'),
    取标识: (j) => String(j.dedeuserid || ''),
    取昵称: (j) => String(j.昵称 || j.name || ''),
    /** 联网问一下这凭证还能不能用，顺手把昵称取回来（2026-11-03） */
    验证: async (凭据) => {
      const r = await fetch('https://api.bilibili.com/x/web-interface/nav', {
        headers: {
          cookie: 'SESSDATA=' + String(凭据.sessdata || ''),
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          referer: 'https://www.bilibili.com/',
        },
        signal: AbortSignal.timeout(8000),
      })
      const j = await r.json()
      if (!j || j.code !== 0 || !j.data || !j.data.isLogin) {
        return { ok: false, 说: '凭证失效了，得重新扫码' }
      }
      return { ok: true, 昵称: String(j.data.uname || ''), mid: String(j.data.mid || ''), 说: '能用' }
    },
  },
]

/**
 * 联网验证某个平台的账号还能不能用，顺手把昵称存回凭证（2026-11-03）。
 * @param {string} 平台
 */
export async function 验证账号(平台, 账号本) {
  const p = 平台们.find((x) => x.名 === 平台)
  if (!p || typeof p.验证 !== 'function') return { ok: false, 说: '这个平台还不能联网验证' }
  const 路径 = p.路径()
  if (!existsSync(路径)) return { ok: false, 说: '本来就没登录' }
  const 凭据 = 读JSON(路径, {})
  try {
    const 果 = await p.验证(凭据)
    if (账号本 && typeof 账号本.记验证 === 'function') {
      账号本.记验证(平台, { 可用: !!果.ok, 时间: new Date().toISOString(), 说: 果.说 || '' })
    }
    if (果.ok && 果.昵称 && 账号本 && typeof 账号本.记昵称 === 'function') {
      账号本.记昵称(平台, 果.昵称)
    }
    return { ...果, 平台 }
  } catch (error) {
    const 话 = String((error && error.message) || error)
    return { ok: false, 平台, 说: '连不上：' + 话.slice(0, 60) }
  }
}

/**
 * 建一个「哪个平台允许主动用」的小本子（2026-11-03 老大提的）。
 * 默认全勾上；只有勾上的平台，才允许主动去用。
 * 落点：behavior/accounts.json  { "允许": { "B站": true } }
 */
export function 建账号本(根) {
  const 文件 = 根 ? join(根, 'behavior', 'accounts.json') : ''
  const 读 = () => 读JSON(文件, { 允许: {}, 昵称: {} })
  /** 这个平台允不允许主动去做（没记录就当允许） */
  const 允许 = (平台) => {
    const 盘 = 读()
    return (盘.允许 && 盘.允许[平台]) !== false
  }
  /**
   * 这个平台允不允许我开口评论（2026-11-03 老大加的：默认关）。
   * 逛是逛，说话是说话，两码事。
   */
  const 允许评论 = (平台) => {
    const 盘 = 读()
    return (盘.评论 && 盘.评论[平台]) === true
  }
  const 设评论 = (平台, 值) => {
    if (!根) return false
    try {
      const 盘 = 读()
      盘.评论 = { ...(盘.评论 || {}), [平台]: !!值 }
      写JSON(文件, 盘)
      return true
    } catch (error) {
      return false
    }
  }
  const 设 = (平台, 值) => {
    if (!根) return false
    try {
      const 盘 = 读()
      盘.允许 = { ...(盘.允许 || {}), [平台]: !!值 }
      写JSON(文件, 盘)
      return true
    } catch (error) {
      return false
    }
  }
  /** 验证回来的昵称存这儿（凭证文件那边沙箱写不动） */
  const 昵称 = (平台) => {
    const 盘 = 读()
    return String((盘.昵称 && 盘.昵称[平台]) || '')
  }
  const 记昵称 = (平台, 名) => {
    if (!根 || !名) return false
    try {
      const 盘 = 读()
      盘.昵称 = { ...(盘.昵称 || {}), [平台]: String(名) }
      写JSON(文件, 盘)
      return true
    } catch (error) {
      return false
    }
  }
  /** 上次联网验证的结果：{ 可用, 时间, 说 } */
  const 验证记录 = (平台) => {
    const 盘 = 读()
    return (盘.验证 && 盘.验证[平台]) || null
  }
  const 记验证 = (平台, 果) => {
    if (!根) return false
    try {
      const 盘 = 读()
      盘.验证 = {
        ...(盘.验证 || {}),
        [平台]: { 可用: !!果.可用, 时间: 果.时间 || new Date().toISOString(), 说: String(果.说 || '') },
      }
      写JSON(文件, 盘)
      return true
    } catch (error) {
      return false
    }
  }
  /** 所有勾着的平台 */
  const 勾着的 = () => 平台们.map((p) => p.名).filter((名) => 允许(名))
  /** 勾着、也允许开口评论的平台 */
  const 能说话的 = () => 平台们.map((p) => p.名).filter((名) => 允许(名) && 允许评论(名))
  return { 允许, 设, 允许评论, 设评论, 昵称, 记昵称, 验证记录, 记验证, 勾着的, 能说话的 }
}

/**
 * 列出所有平台的账号。
 * @param {object} 账号本 建账号本() 的结果（可选，用来带「勾没勾」）
 */
export function 列账号(账号本) {
  const 结果 = []
  for (const p of 平台们) {
    const 勾了 = 账号本 ? 账号本.允许(p.名) : true
    const 路径 = p.路径()
    if (!existsSync(路径)) {
      结果.push({ 平台: p.名, 标识: '', 昵称: '', 状态: '没登录', 更新时间: '', 已登录: false, 允许: 勾了 })
      continue
    }
    const j = 读JSON(路径, {})
    let 时间 = ''
    try { 时间 = new Date(statSync(路径).mtimeMs).toISOString() } catch (error) { 时间 = '' }
    const 有料 = !!(j.sessdata || j.bili_jct)
    // 昵称和「上次验证结果」都优先看账号本里存下的（凭证文件那边沙箱不一定写得动）
    const 缓昵称 = 账号本 && typeof 账号本.昵称 === 'function' ? 账号本.昵称(p.名) : ''
    const 验过 = 账号本 && typeof 账号本.验证记录 === 'function' ? 账号本.验证记录(p.名) : null
    // 2026-11-03 老大要的：只说「已验证 / 未验证」，日期不进窗口，颜色在界面上分
    let 状态 = '未验证'
    let 有效 = 0 // 0 没验过 / 1 能用 / -1 失效
    if (!有料) 状态 = '凭证不全'
    else if (验过) {
      状态 = 验过.可用 ? '已验证' : '已失效'
      有效 = 验过.可用 ? 1 : -1
    }
    结果.push({
      平台: p.名,
      标识: p.取标识(j) || '',
      昵称: 缓昵称 || p.取昵称(j) || '',
      状态,
      有效,
      更新时间: 时间,
      已登录: 有料,
      允许: 勾了,
      允许评论: 账号本 && typeof 账号本.允许评论 === 'function' ? 账号本.允许评论(p.名) : false,
      验过: 验过 ? 验过.可用 : null,
    })
  }
  return 结果
}

/** 删掉某个平台的登录凭证 */
export function 删账号(平台) {
  const p = 平台们.find((x) => x.名 === 平台)
  if (!p) return { ok: false, 说: '不认识这个平台' }
  const 路径 = p.路径()
  if (!existsSync(路径)) return { ok: false, 说: '本来就没登录' }
  try { unlinkSync(路径) } catch (error) { return { ok: false, 说: String((error && error.message) || error) } }
  return { ok: true, 说: '已删掉' + 平台 + '的登录' }
}
