// 出门相关的路由（2026-11-10 从 index.js 拆出来的第一批）
//
// 扫码登录、出门逛、出门记录，三条都跟「B 站 / 出门」有关，搬在一起。
// index.js 只剩「起服务、把请求递给模块」，不再一条条写路由。
//
// 挂法：
//   import { 挂出门路由 } from './routes/browse.js'
//   挂出门路由({ 路线, 读体, 回, 扫码, 站, 账号本, 出门本 })

export function 挂出门路由(依赖) {
  const { 路线, 读体, 回, 扫码, 站, 账号本, 出门本 } = 依赖

  // ── 扫码登录（2026-11-06）：子窗口里点一下，出码、轮询、落凭证 ──
  路线('/dsh-fishsoul/qr', async (req, res) => {
    const 体 = await 读体(req)
    if (体 && 体.动作 === '开始') return 回(res, await 扫码.开始())
    if (体 && 体.动作 === '查') return 回(res, await 扫码.查(体.key))
    回(res, { ok: true, 说: '要扫码就把动作写「开始」' })
  })

  // ── 出门逛（2026-11-06）：真动作接上了 —— 搜 / 看视频 / 读字幕 / 翻评论 / 发评论 / 动态 ──
  // 走 B 站自己的 web 接口（wbi 签名自己算），不依赖 python 那套库。
  路线('/dsh-fishsoul/browse', async (req, res) => {
    const 体 = await 读体(req)
    const 动作 = String((体 && 体.动作) || '搜')
    const 参 = (体 && 体.参数) || {}
    try {
      if (!账号本.允许('B站')) return 回(res, { ok: false, 说: 'B站 的勾关着，别自己去用' })
      let 果 = null
      if (动作 === '搜') 果 = await 站.搜(参.关键词, 参)
      else if (动作 === '视频') 果 = await 站.视频(参.bvid)
      else if (动作 === '字幕') 果 = await 站.字幕(参.bvid)
      else if (动作 === '评论') 果 = await 站.评论(参.bvid, 参)
      else if (动作 === '动态') 果 = await 站.动态(参.uid || 1989705, 参)
      else if (动作 === '发评论') {
        if (!账号本.允许评论('B站')) return 回(res, { ok: false, 说: '评论的勾没开，我不发' })
        果 = await 站.发评论(参.bvid, 参.文字)
      } else return 回(res, { ok: false, 说: '不认得这个动作：' + 动作 })
      回(res, 果)
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  // 出门记录（2026-11-07）：轻量接口，设置页用来轮询「在不在逛」
  路线('/dsh-fishsoul/walk', async (req, res) => {
    回(res, { ok: true, 出门: 出门本.一句话(), 记录: 出门本.读() })
  })
}
