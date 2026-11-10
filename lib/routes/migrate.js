// 搬旧数据路由（2026-11-10 从 index.js 拆出来的第五批之四）
//
// 不写死格式表，只把一条指令送给自己，让它去扫、去列预览。

export function 挂迁移路由(依赖) {
  const { 路线, 读体, 回, 记账, ctx, 迁移指令 } = 依赖

  // 搬旧数据（2026-11-04）：把一条指令送给自己，让它去扫、去列预览
  路线('/dsh-fishsoul/migrate/start', async (req, res) => {
    try {
      let agent = null
      try { agent = (ctx.agents.list() || [])[0] || null } catch (error) { agent = null }
      if (!agent || typeof agent.followup !== 'function') {
        return 回(res, { ok: false, 说: '现在没有活着的会话，等回来再说' })
      }
      const 话 = 迁移指令({ 会话名: (agent && (agent.title || agent.name)) || '' })
      Promise.resolve(agent.followup({
        id: 'migrate-' + Date.now(),
        role: 'user',
        content: [{ type: 'text', text: 话 }],
        source: { kind: 'migrate' },
      })).catch((error) => 记账('迁移指令发不出去：' + String((error && error.message) || error)))
      记账('发了一条「搬旧数据」的指令，让它自己先扫一遍')
      回(res, { ok: true, 说: '跟它说了，它会先扫一遍、列给你看，你说可以它才写' })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })
}
