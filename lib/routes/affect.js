// 情绪形状路由（2026-11-10 从 index.js 拆出来的第五批之一）
//
// 六轴的点、判情绪用哪一档、时间隧道那条折线的数据。

import { mkdirSync, writeFileSync } from 'node:fs'

export function 挂情绪路由(依赖) {
  const { 路线, 读体, 回, 记账, 档案, 情绪点本, 读情绪配置, 情绪配置路径 } = 依赖

  路线('/dsh-fishsoul/affect', async (req, res) => {
    const 体 = await 读体(req)
    if (体 && 体.设置 && typeof 体.设置 === 'object') {
      const 允许 = ['判情绪档', '扰动幅度', '歪概率', 'provider', 'model']
      const 补 = {}
      for (const k of 允许) if (k in 体.设置) 补[k] = 体.设置[k]
      const 新 = { ...读情绪配置(), ...补 }
      try {
        mkdirSync(档案.根, { recursive: true })
        writeFileSync(情绪配置路径, JSON.stringify(新, null, 2) + '\n', 'utf8')
        记账('情绪形状设置改了：' + Object.keys(补).join('、'))
        return 回(res, { ok: true, 说: '记下了', 配置: 新 })
      } catch (error) {
        return 回(res, { ok: false, 说: String((error && error.message) || error) })
      }
    }
    if (体 && 体.补 === true) return 回(res, { ok: true, ...情绪点本.补() })
    let 隧道 = []
    try { 隧道 = 情绪点本.时间隧道({ 最多: 200 }) } catch (error) { 隧道 = [] }
    回(res, { ok: true, 配置: 读情绪配置(), 隧道, 点数: 隧道.length })
  })
}
