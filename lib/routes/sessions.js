// 会话设置路由（2026-11-10 从 index.js 拆出来的第五批之二）
//
// 每个会话的出门方向、每个会话单独开关「主动找事做」。

export function 挂会话路由(依赖) {
  const { 路线, 读体, 回, 会话本 } = 依赖

  // 每个会话的出门方向
  路线('/dsh-fishsoul/sessions/set', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const sid = String((体 && 体.id) || '')
      const 方向 = String((体 && 体.方向) || '')
      if (!sid) return 回(res, { ok: false, 说: '没给会话 id' })
      回(res, 会话本.设方向(sid, 方向)
        ? { ok: true, 说: '记下了', 会话们: 会话本.一览() }
        : { ok: false, 说: '没记上' })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  // 每间会话单独开关「主动找事做」（2026-11-04）
  路线('/dsh-fishsoul/sessions/toggle', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const sid = String((体 && 体.id) || '')
      if (!sid) return 回(res, { ok: false, 说: '没给会话 id' })
      const 开 = 体 && 体.开着 !== false
      回(res, 会话本.设开着(sid, 开)
        ? { ok: true, 说: 开 ? '这间会话又开始自己找事做了' : '这间会话不再自己找事做', 会话们: 会话本.一览() }
        : { ok: false, 说: '没记上' })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })
}
