// 小肥鱼 · B 站扫码登录（2026-11-06）
//
// 走 B 站自己的扫码接口：
//   ① 要一张码  GET  /x/passport-login/web/qrcode/generate
//   ② 问扫了没  GET  /x/passport-login/web/qrcode/poll?qrcode_key=…
// 成功了把 SESSDATA / bili_jct / DedeUserID 写进 bili-duty 的凭证文件，
// 然后把昵称取回来（只回显昵称，不回显任何凭证）。
//
// 二维码图片是本地画的（tools/qr_make.py，用 venv 里的 qrcode），不往第三方发链接。

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const 版本 = '0.1.0'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const 本目录 = dirname(fileURLToPath(import.meta.url))

/** 凭证文件（跟 bili-duty 用同一个） */
export const 凭证文件 = () => join(homedir(), '.dsh', 'bili-duty', 'bili_credential.json')

/** 找 venv 的 python，找不到退回 PATH 里的 python */
const 找python = () => {
  const 候选 = [
    join(homedir(), '.dsh', 'bili-duty', '.venv', 'Scripts', 'python.exe'),
    join(homedir(), '.dsh', 'bili-duty', '.venv', 'bin', 'python'),
  ]
  for (const p of 候选) if (existsSync(p)) return p
  return 'python'
}

/** 跑一次 python，把 stdout 收回来 */
const 跑 = (命令, 参数, 输入) =>
  new Promise((解决) => {
    let 出 = ''
    let 错 = ''
    let 完 = false
    let 子 = null
    try {
      子 = spawn(命令, 参数, { windowsHide: true })
    } catch (error) {
      return 解决({ ok: false, 出: '', 错: String((error && error.message) || error) })
    }
    子.stdout.on('data', (d) => { 出 += String(d) })
    子.stderr.on('data', (d) => { 错 += String(d) })
    子.on('error', (error) => {
      if (完) return
      完 = true
      解决({ ok: false, 出, 错: String((error && error.message) || error) })
    })
    子.on('close', (码) => {
      if (完) return
      完 = true
      解决({ ok: 码 === 0, 出, 错 })
    })
    try {
      if (输入 != null) 子.stdin.end(String(输入), 'utf8')
      else 子.stdin.end()
    } catch (error) {}
    setTimeout(() => {
      if (完) return
      完 = true
      try { 子.kill() } catch (error) {}
      解决({ ok: false, 出, 错: '画码超时' })
    }, 20000)
  })

/** 兜底：宿主 Electron 里自带的 qrcode 库（DSH 桌面有），直接从 resources 里借 */
const 试宿主码库 = async (文字) => {
  const 资源 = String(process.resourcesPath || '')
  const 候选 = [
    process.env.DSH_APP_DIR,
    资源 ? join(资源, 'app') : '',
  ].filter(Boolean)
  for (const 目录 of 候选) {
    try {
      const p = join(目录, 'node_modules', 'qrcode', 'lib', 'index.js')
      if (!existsSync(p)) continue
      const m = await import(pathToFileURL(p).href)
      const 码 = m.default || m
      const url = await 码.toDataURL(文字, { margin: 1, width: 240 })
      if (String(url).startsWith('data:image/')) return String(url)
    } catch (error) { /* 这条路不通就走下一条 */ }
  }
  return ''
}

/**
 * 建一个扫码器。
 * @param {object} 选项 { 记账 }
 */
export function 建扫码(选项 = {}) {
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}

  /** ① 要一张新码 */
  const 开始 = async () => {
    let j = null
    try {
      const r = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate?source=main-fe-header', {
        headers: { 'user-agent': UA, referer: 'https://www.bilibili.com/' },
        signal: AbortSignal.timeout(12000),
      })
      j = await r.json()
    } catch (error) {
      return { ok: false, 说: '连不上 B 站的登录口：' + String((error && error.message) || error) }
    }
    if (!j || j.code !== 0 || !j.data || !j.data.qrcode_key) return { ok: false, 说: 'B 站没给码：' + String((j && j.message) || '') }
    const key = String(j.data.qrcode_key)
    const 链接 = String(j.data.url || '')
    // 本地画成图（不把链接发给第三方）：先试 python，再试宿主自带的库
    const 画 = await 跑(找python(), [join(本目录, '..', 'tools', 'qr_make.py')], 链接)
    let 图 = String(画.出 || '').trim().split('\n').pop() || ''
    if (!String(图).startsWith('data:image/')) 图 = await 试宿主码库(链接)
    if (!String(图).startsWith('data:image/')) {
      记账('二维码没画出来：' + String(画.错 || '').slice(0, 120))
      return { ok: true, key, 链接, 图: '', 说: '码拿到了，但图没画出来（' + String(画.错 || '看看 python').slice(0, 60) + '）' }
    }
    记账('出了一张登录二维码')
    return { ok: true, key, 链接, 图, 说: '用手机 B 站扫一下' }
  }

  /** ② 问扫了没；好了就落凭证 */
  const 查 = async (key) => {
    const k = String(key || '').trim()
    if (!k) return { ok: false, 说: '没给 key' }
    let j = null
    try {
      const r = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=' + encodeURIComponent(k) +
        '&source=main-fe-header', {
        headers: { 'user-agent': UA, referer: 'https://www.bilibili.com/' },
        signal: AbortSignal.timeout(12000),
      })
      j = await r.json()
    } catch (error) {
      return { ok: false, 说: '问不了：' + String((error && error.message) || error), 状态: 'waiting' }
    }
    const d = (j && j.data) || {}
    const 码 = Number(d.code)
    if (码 === 86101) return { ok: true, 状态: 'waiting', 说: '还没扫' }
    if (码 === 86090) return { ok: true, 状态: 'scanned', 说: '扫了，手机上点一下确认' }
    if (码 === 86038) return { ok: true, 状态: 'expired', 说: '码过期了，重新出一张' }
    if (码 !== 0) return { ok: false, 说: '登录没成：' + String(d.message || 码), 状态: 'error' }

    // 成功了：从返回的 url 里抠 cookie
    const 参 = new URL(String(d.url || '')).searchParams
    const 凭 = {
      sessdata: 参.get('SESSDATA') || '',
      bili_jct: 参.get('bili_jct') || '',
      dedeuserid: 参.get('DedeUserID') || '',
      buvid3: 参.get('buvid3') || '',
    }
    if (!凭.sessdata) return { ok: false, 说: '登录是成功了，但没拿到 SESSDATA', 状态: 'error' }
    try {
      const p = 凭证文件()
      mkdirSync(dirname(p), { recursive: true })
      // 原来的 buvid3 如果没有就沿用旧的
      let 旧 = {}
      try { if (existsSync(p)) 旧 = JSON.parse(readFileSync(p, 'utf8')) || {} } catch (error) { 旧 = {} }
      const 全 = { ...旧, ...凭 }
      if (!全.buvid3) 全.buvid3 = String(旧.buvid3 || '')
      writeFileSync(p, JSON.stringify(全, null, 2) + '\n', 'utf8')
      记账('B 站登录成功，凭证已经写到 bili-duty 那边')
    } catch (error) {
      return { ok: false, 说: '登录成功了，但凭证存不上：' + String((error && error.message) || error), 状态: 'error' }
    }
    // 顺手取昵称（只回昵称）
    let 昵称 = ''
    try {
      const r = await fetch('https://api.bilibili.com/x/web-interface/nav', {
        headers: {
          'user-agent': UA, referer: 'https://www.bilibili.com/',
          cookie: `SESSDATA=${凭.sessdata}; bili_jct=${凭.bili_jct}; DedeUserID=${凭.dedeuserid}`,
        },
        signal: AbortSignal.timeout(10000),
      })
      const nj = await r.json()
      昵称 = String((nj && nj.data && nj.data.uname) || '')
    } catch (error) { 昵称 = '' }
    return { ok: true, 状态: 'ok', 说: '登上了' + (昵称 ? '：' + 昵称 : ''), 昵称 }
  }

  return { 开始, 查 }
}
