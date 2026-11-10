// 杂项维护类路由（2026-11-10 从 index.js 拆出来的第三批）
//
// 语音识别、语用回声、琢磨、模式切换、整理、更新、疤、夜巡，八条。
// 业务对象由 index.js 传进来，文件操作自己 import。

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function 挂杂项路由(依赖) {
  const {
    路线, 读体, 回, 记账,
    装ASR, 探ASR, 回声, 琢磨, 整理器, 更新器, 疤, 夜巡,
    DSH家, 工作区, 模式配置,
  } = 依赖

  路线('/dsh-fishsoul/asr', async (req, res) => {
    const 体 = await 读体(req)
    if (体 && 体.装 === true) {
      回(res, { ok: true, 说: '开始装语音识别依赖了，进度看下面那行' })
      void 装ASR(记账).catch(() => {})
      return
    }
    const 果 = await 探ASR()
    回(res, { ok: 果.ok !== false, 已装: 果.已装 === true, 说: 果.说, python: 果.python || '' })
  })

  路线('/dsh-fishsoul/echo', async (req, res) => {
    回(res, { ok: true, 形状: 回声.汇总(), 注入: 回声.生成注入() })
  })

  路线('/dsh-fishsoul/ponder', async (req, res) => {
    回(res, { ok: true, 还气着: 琢磨.还有气吗(), 账单: 琢磨.读() })
  })

  路线('/dsh-fishsoul/mode', async (req, res) => {
    const 来 = await 读体(req)
    const 新 = String((来 && 来.mode) || '') === 'shared' ? 'shared' : 'independent'
    mkdirSync(DSH家, { recursive: true })
    // 第一次切共享：把当前工作区档案带过去，别让新档案从空白开始
    const 共享根 = join(DSH家, 'fishsoul-shared')
    if (新 === 'shared' && !existsSync(join(共享根, 'manifest.json'))) {
      try { cpSync(join(工作区, '.fishsoul'), 共享根, { recursive: true }) } catch (error) { 记账('共享档案初始化失败：' + String((error && error.message) || error)) }
    }
    writeFileSync(模式配置, JSON.stringify({ mode: 新 }, null, 2) + '\n', 'utf8')
    回(res, { ok: true, mode: 新, 说: '已切换成' + (新 === 'shared' ? '共享' : '独立') + '，重启 DSH 后生效' })
  })

  路线('/dsh-fishsoul/digest', async (req, res) => {
    const 来 = await 读体(req)
    回(res, 整理器.整理(来 || {}))
  })

  路线('/dsh-fishsoul/update/apply', async (req, res) => {
    try {
      回(res, await 更新器.应用())
    } catch (error) {
      回(res, { ok: false, 说: '更新失败：' + String((error && error.message) || error) })
    }
  })

  路线('/dsh-fishsoul/scar', async (req, res) => {
    回(res, 疤.扫({ 写回: false }))
  })

  路线('/dsh-fishsoul/nightly', async (req, res) => {
    回(res, 夜巡.跑({ 强制: true }))
  })
}
