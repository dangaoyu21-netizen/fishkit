// 小肥鱼 · 平台（开发板）
//
// 2026-11-04 老大定的口径：
//   - 要发评论、发私信、看动态 → 用现成的库，别自己抠。
//   - 库不进包（GPL 会传染），只在运行时「检查有没有、没有就装」。
//   - 所以这里只记：平台叫什么、用哪个包、模块名、仓库、作者、许可证。
//   - README 里要写明包是谁的、仓库在哪；不用再补「不是咱们的」那种话。
//
// ⚠️ 这一层只负责「依赖在不在、装没装」，不碰任何账号凭证。

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

export const 版本 = '0.1.0'

/** 认得的平台。加平台就往这儿添一条，设置页、检查、安装都跟着走。 */
export const 平台们 = [
  {
    名: 'B站',
    包: 'bilibili-api-python',
    仓库: 'https://github.com/Nemo2011/bilibili-api',
    作者: 'Nemo2011',
    许可: 'GPL-3.0-or-later',
    能干: '搜视频、读字幕、翻评论、发评论、私信、动态',
    /** 怎么查它装没装 */
    检查: { 类型: '导入', 模块: 'bilibili_api' },
    /** 怎么装它 */
    装法: { 类型: 'pip', 包: 'bilibili-api-python' },
    /** 这个平台的依赖装在哪套 Python 里（现在就是 bili-duty 那间 venv） */
    python目录: () => join(homedir(), '.dsh', 'bili-duty', '.venv'),
  },
  {
    // 2026-11-04 老大定的：有现成的就用，写清楚是谁的；作者哪天说不让用再想别的。
    名: '小黑盒',
    包: 'xiaoheihe-cli',
    仓库: 'https://github.com/AaronZ345/xiaoheihe-cli',
    作者: 'AaronZ345',
    许可: 'MIT',
    能干: '游戏记录和短评、社区帖子、评论和楼中楼、搜索、发帖',
    检查: { 类型: '命令', 命令: 'xiaoheihe-cli', 参数: ['--version'] },
    装法: { 类型: 'git', 地址: 'https://github.com/AaronZ345/xiaoheihe-cli.git', 包: 'xiaoheihe-cli' },
    python目录: () => join(homedir(), '.dsh', 'bili-duty', '.venv'),
  },
]

const 平台找 = (名) => 平台们.find((x) => x.名 === 名) || null

/**
 * 装的状态（2026-11-04 老大要的四态：未安装 / 正在安装 / 安装失败 / 已安装）。
 * 「未安装」「已安装」由现查决定；这里只记装的过程 —— 装中、失败了。
 */
const 装状态 = new Map()

/** 读某个平台这会儿的安装状态（没装过就 null） */
export function 读装状态(平台名) {
  const x = 装状态.get(String(平台名))
  return x ? { ...x } : null
}

function 取Python(p) {
  const 目录 = p && typeof p.python目录 === 'function' ? p.python目录() : ''
  const 候选 = 目录
    ? [
        join(目录, 'Scripts', 'python.exe'), // Windows
        join(目录, 'bin', 'python'), // 别的系统
      ]
    : []
  for (const x of 候选) if (existsSync(x)) return x
  return 'python'
}

/** 把一个命令跑完，收 stdout/stderr；超时掐掉。 */
function 跑(命令, 参数 = [], 超时 = 120000) {
  return new Promise((解决) => {
    let 出 = ''
    let 错 = ''
    let 完 = false
    let 子 = null
    try {
      子 = spawn(命令, 参数, { windowsHide: true })
    } catch (error) {
      return 解决({ ok: false, 码: -1, 出: '', 错: String((error && error.message) || error) })
    }
    子.stdout.on('data', (d) => { 出 += String(d) })
    子.stderr.on('data', (d) => { 错 += String(d) })
    子.on('error', (error) => {
      if (完) return
      完 = true
      解决({ ok: false, 码: -1, 出, 错: String((error && error.message) || error) })
    })
    子.on('close', (码) => {
      if (完) return
      完 = true
      解决({ ok: 码 === 0, 码, 出, 错 })
    })
    const 闹钟 = setTimeout(() => {
      if (完) return
      完 = true
      try { 子.kill() } catch (error) {}
      解决({ ok: false, 码: -2, 出, 错: 错 + '\n（超时了）' })
    }, 超时)
    子.on('close', () => clearTimeout(闹钟))
  })
}

/**
 * 查依赖：它装在不在。
 * 两种查法：导入一个 Python 模块，或者跑一下那条命令。
 * @param {string} 平台名
 * @returns {Promise<{ok:boolean, 已装:boolean, 说:string, python?:string}>}
 */
export async function 探依赖(平台名) {
  const p = 平台找(平台名)
  if (!p) return { ok: false, 已装: false, 说: '不认得这个平台' }
  const python = 取Python(p)
  const 检查 = p.检查 || { 类型: '导入', 模块: p.模块 }
  const 果 = 检查.类型 === '命令'
    ? await 跑(检查.命令 || p.包, Array.isArray(检查.参数) ? 检查.参数 : ['--version'], 20000)
    : await 跑(python, ['-c', 'import ' + 检查.模块 + '; print("ok")'], 20000)
  if (果.ok && /ok|version|\d+\.\d+/i.test(果.出 || '')) {
    return { ok: true, 已装: true, python, 说: '依赖在' }
  }
  // ⚠ 先认「进程根本起不来」：这跟「库没装」是两回事，别混着说
  if (/ENOENT|not recognized|不是内部或外部命令|找不到|command not found/i.test(果.错)) {
    return { ok: true, 已装: false, python, 说: '还没装' }
  }
  if (/EPERM|spawn/i.test(果.错)) {
    return { ok: false, 已装: false, python, 说: '起不了进程（' + String(果.错).split('\n')[0].slice(0, 80) + '）' }
  }
  if (/No module named/.test(果.错 + 果.出)) {
    return { ok: true, 已装: false, python, 说: '还没装' }
  }
  if (!果.ok) {
    return { ok: true, 已装: false, python, 说: (果.错 || 果.出 || '没装上').split('\n')[0].slice(0, 120) }
  }
  return { ok: true, 已装: true, python, 说: '依赖在' }
}

/**
 * 装依赖（后台装、进度写日志）。
 * @param {string} 平台名
 * @param {(行:string)=>void} 记账
 * @returns {Promise<{ok:boolean, 说:string}>}
 */
export async function 装依赖(平台名, 记账 = () => {}) {
  const p = 平台找(平台名)
  if (!p) return { ok: false, 说: '不认得这个平台' }
  const python = 取Python(p)
  const 装法 = p.装法 || { 类型: 'pip', 包: p.包 }
  装状态.set(String(平台名), { 状态: '装中', 说: '正在装…', 开始: Date.now() })
  记账('开始装 ' + p.名 + ' 的依赖：' + p.包)
  const 目标 = 装法.类型 === 'git' ? ('git+' + 装法.地址) : 装法.包
  const 果 = await 跑(python, ['-m', 'pip', 'install', '--disable-pip-version-check', 目标], 600000)
  if (!果.ok) {
    装状态.set(String(平台名), { 状态: '失败', 说: (果.错 || 果.出 || '没装上').split('\n')[0].slice(0, 120), 开始: Date.now() })
    记账('装 ' + 目标 + ' 没成：' + (果.错 || 果.出 || '').split('\n').slice(-3).join(' ').slice(0, 240))
    return { ok: false, 说: '没装上，看下面那行' }
  }
  const 再查 = await 探依赖(平台名)
  装状态.set(String(平台名), {
    状态: 再查.已装 ? '好了' : '失败',
    说: 再查.已装 ? '装好了' : '装完还是查不到',
    开始: Date.now(),
  })
  记账('装好了：' + p.包 + '（' + (再查.已装 ? '能用' : '装完还是查不到') + '）')
  return { ok: 再查.已装, 说: 再查.已装 ? '装好了' : '装完了但查不到，看看日志' }
}

/** 设置页要的那份：平台表 + 每个平台的依赖状态 */
export async function 一览() {
  const 出 = []
  for (const p of 平台们) {
    const 依 = await 探依赖(p.名)
    出.push({
      名: p.名,
      包: p.包,
      模块: (p.检查 && p.检查.模块) || '',
      仓库: p.仓库,
      作者: p.作者,
      许可: p.许可,
      能干: p.能干,
      已装: 依.已装 === true,
      说: 依.说,
    })
  }
  return 出
}
