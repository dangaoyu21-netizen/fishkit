// 平台与账号路由（2026-11-10 从 index.js 拆出来的第五批之三）
//
// 平台依赖的静态表、查依赖、装依赖；账号的列出、勾选、删除、评论开关、联网验证。

export function 挂账号路由(依赖) {
  const {
    路线, 读体, 回, 记账,
    库平台们, 探依赖, 读装状态, 装依赖,
    账号本, 列账号, 删账号, 验证账号,
  } = 依赖

  // 平台依赖（2026-11-04）：加账号的子窗口选完平台，先看那套库在不在
  // 只给静态那张表，不探依赖 —— 探一次要起个 python，别让打开窗口就等它
  路线('/dsh-fishsoul/platforms', async (req, res) => {
    try {
      回(res, {
        ok: true,
        平台们: 库平台们.map((p) => ({
          名: p.名, 包: p.包, 模块: (p.检查 && p.检查.模块) || '', 仓库: p.仓库, 作者: p.作者, 许可: p.许可, 能干: p.能干,
          自带: p.自带 === true,
          停用: String(p.停用 || ''), // 原库关了的那种，把原因写出来（2026-11-06）
        })),
      })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  路线('/dsh-fishsoul/platforms/check', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const 名 = String((体 && 体.平台) || '')
      const 果 = await 探依赖(名)
      回(res, {
        ok: 果.ok !== false,
        已装: 果.已装 === true,
        说: 果.说,
        python: 果.python || '',
        装: 读装状态(名), // 装的过程：装中 / 好了 / 失败
      })
    } catch (error) {
      回(res, { ok: false, 已装: false, 说: String((error && error.message) || error) })
    }
  })

  // 装依赖：不等它（可能好几分钟），进度去日志里看
  路线('/dsh-fishsoul/platforms/install', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const 名 = String((体 && 体.平台) || '')
      // 原库已经关掉的那种就别装了（2026-11-06 bilibili-api 被清空归档）
      const 那个 = 库平台们.find((p) => p.名 === 名)
      if (那个 && 那个.停用) return 回(res, { ok: false, 说: String(那个.停用) })
      回(res, { ok: true, 说: '开始装了，进度写在下面那行日志里' })
      void 装依赖(名, 记账).catch(() => {})
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  // 平台账号（2026-11-03）：列一下登着谁、能不能删
  路线('/dsh-fishsoul/accounts', async (req, res) => {
    try {
      回(res, { ok: true, 账号们: 列账号(账号本) })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error), 账号们: [] })
    }
  })

  // 勾上/取消：只有勾上的平台才允许主动去用
  路线('/dsh-fishsoul/accounts/toggle', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const 平台 = String((体 && 体.平台) || '')
      const 值 = !!(体 && 体.允许)
      回(res, 账号本.设(平台, 值) ? { ok: true, 说: '记下了', 账号们: 列账号(账号本) } : { ok: false, 说: '没记上' })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  路线('/dsh-fishsoul/accounts/delete', async (req, res) => {
    try {
      const 体 = await 读体(req)
      回(res, 删账号(String((体 && 体.平台) || '')))
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  // 允不允许我在这平台开口评论（2026-11-03）
  路线('/dsh-fishsoul/accounts/comment', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const 平台 = String((体 && 体.平台) || '')
      const 值 = !!(体 && 体.允许)
      回(res, 账号本.设评论(平台, 值)
        ? { ok: true, 说: '记下了', 账号们: 列账号(账号本) }
        : { ok: false, 说: '没记上' })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  // 联网验一下账号还能不能用，顺手把昵称取回来（2026-11-03）
  路线('/dsh-fishsoul/accounts/verify', async (req, res) => {
    try {
      const 体 = await 读体(req)
      const 平台 = String((体 && 体.平台) || 'B站')
      const 果 = await 验证账号(平台, 账号本)
      回(res, { ...果, 账号们: 列账号(账号本) })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })
}
