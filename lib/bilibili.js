// 小肥鱼 · B 站（2026-11-06）
//
// 出门逛要真的干活：搜、看视频、读字幕、翻评论、发评论、看动态。
// 直接在 Node 里走 B 站自己的 web 接口，wbi 签名自己算 —— 不依赖 python 那套库，
// 装没装都不影响我这几个动作（库还在设置页里当「能不能用」的标记）。
//
// 凭证从 ~/.dsh/bili-duty/bili_credential.json 读；只读、不回显、不打印。
// 没登录也能搜、能看（B 站公开接口），要发评论才非得有凭证。

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const 版本 = '0.1.0'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

/** wbi 的洗牌表（B 站前端那份） */
const 洗牌表 = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52]

const md5 = (s) => createHash('md5').update(String(s)).digest('hex')

/** 凭证路径 */
export const 凭证路径 = () => join(homedir(), '.dsh', 'bili-duty', 'bili_credential.json')

const 读凭据 = () => {
  try {
    const p = 凭证路径()
    if (!existsSync(p)) return null
    const j = JSON.parse(readFileSync(p, 'utf8'))
    return j && (j.sessdata || j.bili_jct) ? j : null
  } catch (error) {
    return null
  }
}

const 造cookie = (凭) => {
  if (!凭) return ''
  const 段 = []
  if (凭.sessdata) 段.push('SESSDATA=' + 凭.sessdata)
  if (凭.bili_jct) 段.push('bili_jct=' + 凭.bili_jct)
  if (凭.buvid3) 段.push('buvid3=' + 凭.buvid3)
  if (凭.dedeuserid) 段.push('DedeUserID=' + 凭.dedeuserid)
  return 段.join('; ')
}

/** 洗掉标题里那种高亮标签 */
export const 去标签 = (s) => String(s || '').replace(/<[^>]+>/g, '').trim()

/**
 * 建一个 B 站口子。
 * @param {object} 选项 { 记账 }
 */
export function 建B站(选项 = {}) {
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  let 混钥 = ''
  let 钥取于 = 0

  /** wbi 的混合密钥（img_key + sub_key 洗一遍，取前 32 位），缓存 6 小时 */
  const 取混钥 = async () => {
    if (混钥 && Date.now() - 钥取于 < 6 * 3600 * 1000) return 混钥
    const r = await fetch('https://api.bilibili.com/x/web-interface/nav', {
      headers: { 'user-agent': UA, referer: 'https://www.bilibili.com/' },
      signal: AbortSignal.timeout(10000),
    })
    const j = await r.json().catch(() => ({}))
    const img = String(((j.data || {}).wbi_img || {}).img_url || '')
    const sub = String(((j.data || {}).wbi_img || {}).sub_url || '')
    if (!img || !sub) throw new Error('拿不到 wbi 密钥')
    const 名 = (u) => String(u).split('/').pop().split('.')[0]
    const 原 = 名(img) + 名(sub)
    混钥 = 洗牌表.map((i) => 原[i] || '').join('').slice(0, 32)
    钥取于 = Date.now()
    return 混钥
  }

  /** 参数签成 query（值都编码，键按字典序） */
  const 签 = async (参) => {
    const 钥 = await 取混钥()
    const 全 = { ...参, wts: Math.floor(Date.now() / 1000) }
    const 串 = Object.keys(全).sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(全[k]))}`)
      .join('&')
    return 串 + '&w_rid=' + md5(串 + 钥)
  }

  const 头 = (凭) => {
    const h = { 'user-agent': UA, referer: 'https://www.bilibili.com/', origin: 'https://www.bilibili.com' }
    const c = 造cookie(凭)
    if (c) h.cookie = c
    return h
  }

  /** GET 一个要 wbi 签名的接口 */
  const 取 = async (路径, 参 = {}) => {
    const qs = await 签(参)
    const r = await fetch('https://api.bilibili.com' + 路径 + '?' + qs, {
      headers: 头(读凭据()),
      signal: AbortSignal.timeout(15000),
    })
    const j = await r.json().catch(() => ({}))
    if (j.code !== 0) return { ok: false, code: Number(j.code), 说: String(j.message || '接口没回话') }
    return { ok: true, 数据: j.data }
  }

  /** POST 一个接口（表单，带 csrf） */
  const 投 = async (路径, 参 = {}) => {
    const 凭 = 读凭据()
    if (!凭 || !凭.bili_jct) return { ok: false, 说: '没登录，发不了' }
    const body = new URLSearchParams({ ...参, csrf: String(凭.bili_jct) })
    const r = await fetch('https://api.bilibili.com' + 路径, {
      method: 'POST',
      headers: { ...头(凭), 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15000),
    })
    const j = await r.json().catch(() => ({}))
    if (j.code !== 0) return { ok: false, code: Number(j.code), 说: String(j.message || '没发出去') }
    return { ok: true, 数据: j.data }
  }

  /** 搜视频 */
  const 搜 = async (关键词, 参数 = {}) => {
    const 果 = await 取('/x/web-interface/wbi/search/type', {
      search_type: 'video',
      keyword: String(关键词 || ''),
      page: Number(参数.页 || 1),
      page_size: Math.min(50, Math.max(1, Number(参数.条数 || 10))),
      order: String(参数.排序 || 'totalrank'),
    })
    if (!果.ok) return 果
    const 们 = ((果.数据 && 果.数据.result) || []).slice(0, Number(参数.条数 || 10)).map((x) => ({
      标题: 去标签(x.title),
      bvid: String(x.bvid || ''),
      播放: Number(x.play || 0),
      弹幕: Number(x.video_review || 0),
      评论数: Number(x.review || 0),
      作者: String(x.author || ''),
      时长: String(x.duration || ''),
      发布: Number(x.pubdate || 0),
      简介: 去标签(x.description).slice(0, 120),
    }))
    return { ok: true, 们 }
  }

  /** 视频信息 + 第一个分P的 cid */
  const 视频 = async (bvid) => {
    const r = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + encodeURIComponent(String(bvid || '')), {
      headers: 头(读凭据()),
      signal: AbortSignal.timeout(15000),
    })
    const j = await r.json().catch(() => ({}))
    if (j.code !== 0) return { ok: false, 说: String(j.message || '看不了这个视频') }
    const d = j.data || {}
    const cid = d.cid || ((d.pages || [{}])[0] || {}).cid || 0
    return {
      ok: true,
      bvid: String(d.bvid || bvid || ''),
      aid: Number(d.aid || 0),
      标题: String(d.title || ''),
      作者: String((d.owner || {}).name || ''),
      简介: String(d.desc || '').slice(0, 300),
      时长: Number(d.duration || 0),
      播放: Number(((d.stat || {}).view) || 0),
      点赞: Number(((d.stat || {}).like) || 0),
      评论数: Number(((d.stat || {}).reply) || 0),
      封面网页: String(d.pic || ''),
      cid,
    }
  }

  /** 封面图的本地目录：工作区的 .fishsoul/cache/covers（能直接 read_image 看） */
  const 封面目录 = String(选项.封面目录 || '') || join(process.env.DSH_WORKSPACE || process.cwd(), '.fishsoul', 'cache', 'covers')

  /**
   * 把封面图下下来存本地（2026-11-06）：模型看不见视频画面，至少能看一眼封面。
   * @returns {Promise<{ok:boolean, 文件?:string, 字节?:number, 说:string}>}
   */
  const 封面 = async (bvid) => {
    const v = await 视频(bvid)
    if (!v.ok) return v
    const pic = String(v.封面网页 || '')
    if (!pic) return { ok: false, 说: '这条没有封面' }
    const 原图 = pic.startsWith('//') ? 'https:' + pic : pic
    // 2026-11-06：别拉原图，让 B 站 CDN 直接给张小的（@480w.jpg），一百多 K 能压到几十 K
    const 缩略 = /@\d+w/i.test(原图) ? 原图 : 原图 + '@480w.jpg'
    try {
      let r = await fetch(缩略, { headers: 头(null), signal: AbortSignal.timeout(15000) })
      // 缩略图地址不认（极少数情况）就退回原图
      if (!r.ok) r = await fetch(原图, { headers: 头(null), signal: AbortSignal.timeout(15000) })
      if (!r.ok) return { ok: false, 说: '封面下载失败：HTTP ' + r.status }
      const buf = Buffer.from(await r.arrayBuffer())
      if (!buf.length) return { ok: false, 说: '封面是空的' }
      if (buf.length > 8 * 1024 * 1024) return { ok: false, 说: '封面太大了（' + Math.round(buf.length / 1048576) + 'MB）' }
      mkdirSync(封面目录, { recursive: true })
      const 文件 = join(封面目录, String(v.bvid || bvid || 'cover') + '.jpg')
      writeFileSync(文件, buf)
      return { ok: true, 文件, 字节: buf.length, 说: '封面存好了（' + Math.round(buf.length / 1024) + 'KB），拿 read_image 看一眼' }
    } catch (error) {
      return { ok: false, 说: '封面下载出错：' + String((error && error.message) || error) }
    }
  }

  /** 读字幕（AI 字幕也算；没字幕就返回空） */
  const 字幕 = async (bvid) => {
    const v = await 视频(bvid)
    if (!v.ok) return v
    if (!v.cid) return { ok: false, 说: '这个视频没有分P信息' }
    const 果 = await 取('/x/player/wbi/v2', { bvid: v.bvid, cid: v.cid })
    if (!果.ok) return 果
    const 名们 = (((果.数据 || {}).subtitle || {}).subtitles) || []
    const 出 = []
    for (const s of 名们) {
      let url = String(s.subtitle_url || '')
      if (url.startsWith('//')) url = 'https:' + url
      if (!url) continue
      try {
        const r = await fetch(url, { headers: 头(null), signal: AbortSignal.timeout(12000) })
        const j = await r.json()
        const 文 = ((j.body || []).map((x) => x.content || '').join('\n')).trim()
        if (文) 出.push({ 语言: String(s.lan || ''), 文字: 文 })
      } catch (error) {
        记账('字幕拉不下来：' + String((error && error.message) || error))
      }
    }
    return { ok: true, 视频: { bvid: v.bvid, 标题: v.标题, 作者: v.作者 }, 字幕们: 出 }
  }

  /** 翻评论（默认按热度） */
  const 评论 = async (bvid, 参数 = {}) => {
    const v = await 视频(bvid)
    if (!v.ok) return v
    if (!v.aid) return { ok: false, 说: '拿不到 aid' }
    const 果 = await 取('/x/v2/reply', {
      type: 1,
      oid: v.aid,
      pn: Number(参数.页 || 1),
      ps: Math.min(50, Math.max(1, Number(参数.条数 || 20))),
      sort: Number(参数.按时间 ? 0 : 2),
    })
    if (!果.ok) return 果
    const 们 = ((果.数据 || {}).replies || []).map((x) => ({
      用户: String(((x.member || {}).uname) || ''),
      内容: String(((x.content || {}).message) || ''),
      赞: Number(x.like || 0),
      回复数: Number(x.rcount || 0),
    }))
    return { ok: true, 视频: { bvid: v.bvid, 标题: v.标题 }, 们 }
  }

  /** 发一条评论（只在账号勾了「允许评论」时才该被调用） */
  const 发评论 = async (bvid, 文字) => {
    const 净 = String(文字 || '').trim()
    if (!净) return { ok: false, 说: '空的就别发了' }
    if (净.length > 500) return { ok: false, 说: '太长了，B 站这儿顶多 500 字' }
    const v = await 视频(bvid)
    if (!v.ok) return v
    const 果 = await 投('/x/v2/reply/add', {
      oid: v.aid,
      type: 1,
      message: 净,
      plat: 1,
    })
    if (!果.ok) return 果
    const rpid = Number(((果.数据 || {}).rpid) || 0) || Number(((果.数据 || {}).rpid_str) || 0)
    记账('在「' + v.标题.slice(0, 20) + '」下面评论了一句')
    return { ok: true, rpid, 说: '发出去了' }
  }

  /** 看某个人的动态 */
  const 动态 = async (uid, 参数 = {}) => {
    const r = await fetch('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=' +
      encodeURIComponent(String(uid || '')) + '&offset=' + encodeURIComponent(String(参数.游标 || '')), {
      headers: 头(读凭据()),
      signal: AbortSignal.timeout(15000),
    })
    const j = await r.json().catch(() => ({}))
    if (j.code !== 0) return { ok: false, 说: String(j.message || '看不了动态') }
    const 们 = ((j.data || {}).items || []).slice(0, Number(参数.条数 || 10)).map((x) => {
      const m = x.modules || {}
      const a = (m.module_author || {})
      const d = (m.module_dynamic || {})
      return {
        文字: String(((d.desc || {}).text) || '').slice(0, 200),
        时间: String(a.pub_time || ''),
        赞: Number(((m.module_stat || {}).like || {}).count || 0),
      }
    })
    return { ok: true, 们 }
  }

  return { 搜, 视频, 字幕, 评论, 发评论, 动态, 封面, 有凭证: () => Boolean(读凭据()) }
}
