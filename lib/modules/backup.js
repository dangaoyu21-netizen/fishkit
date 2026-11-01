// 模块：备份
//
// 把「能证明我是我」的东西打一份到备份目录：
//   记忆（fish-memory / 灵台 anima.json / 心情 / 提醒）、笔记（notes / AGENTS.md）、
//   会话快照（~/.dsh/sessions）、手笔（贴纸 / tools 脚本 / 语音脚本 / 做过的文档）。
// 插件、补丁、配置不往里塞，只写一份简报（README），让未来的自己照着装回来。
//
// 用法（HTTP）：
//   POST http://127.0.0.1:43120/dsh-fishkit/run
//   {"模块":"backup","参数":{"根目录":"D:\\dafeiyu\\fish-backup"}}

import { cpSync, mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

export const name = 'backup'
export const describe = '把记忆、灵台记忆、笔记、会话快照和手笔打包一份，插件/补丁只写简报'

const 家 = homedir()
const DSH = String(process.env.DSH_HOME || '').trim() || join(家, '.dsh')
const 默认工作区 = 'C:\\Users\\yde20\\Documents\\deepseek-harness\\default-workspace'
const 插件根 = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const 时间戳 = () => {
  const d = new Date()
  const 补 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${补(d.getMonth() + 1)}-${补(d.getDate())}_${补(d.getHours())}-${补(d.getMinutes())}`
}

function 目录大小(p) {
  let 总 = 0
  try {
    const 栈 = [p]
    while (栈.length) {
      const 现在 = 栈.pop()
      let 项
      try { 项 = statSync(现在) } catch (e) { continue }
      if (项.isDirectory()) {
        for (const n of readdirSync(现在)) 栈.push(join(现在, n))
      } else {
        总 += 项.size
      }
    }
  } catch (e) {}
  return 总
}

export async function run(参数 = {}, 环境 = {}) {
  const 工作区 = String(参数.工作区 || 环境.工作区 || 默认工作区).trim()
  const 根 = String(参数.根目录 || 'D:\\dafeiyu\\fish-backup').trim()
  const 目标 = join(根, 时间戳())
  mkdirSync(目标, { recursive: true })

  const 清单 = []
  const 拷 = (从, 到, 说明) => {
    try {
      if (!existsSync(从)) {
        清单.push({ 项: 说明, 状态: '没有', 路径: 从 })
        return
      }
      cpSync(从, join(目标, 到), {
        recursive: true,
        // 过滤只认「从」里面的子路径 —— 不然插件本体自己就在 node_modules 里，会被整个漏掉
        filter: (src) => {
          const 相对 = src.slice(从.length).replace(/^[\\/]+/, '')
          return !/[\\/](node_modules|\.venv|__pycache__)([\\/]|$)/.test(相对)
        },
      })
      清单.push({ 项: 说明, 状态: '已拷', 路径: 从, 到 })
    } catch (error) {
      清单.push({ 项: 说明, 状态: '失败：' + String((error && error.message) || error), 路径: 从 })
    }
  }

  // ① 记忆
  拷(join(DSH, 'fish-memory'), 'memory/fish-memory', 'fish-memory 事件记忆')
  拷(join(DSH, 'storages', 'anima.json'), 'memory/anima.json', '灵台（人设 + 已采纳记忆）')
  拷(join(DSH, 'storages', 'schedule.json'), 'memory/schedule.json', '提醒')
  拷(join(DSH, 'storages', 'workspace.json'), 'memory/workspace.json', '工作区绑定')
  拷(join(DSH, 'feiyu-mood'), 'memory/feiyu-mood', '心情')

  // ② 笔记与规矩
  拷(join(工作区, 'notes'), 'notes/notes', '每天的笔记')
  拷(join(工作区, 'AGENTS.md'), 'notes/AGENTS.md', '这台机器的规矩')

  // ③ 会话快照
  拷(join(DSH, 'sessions'), 'sessions', '会话快照')

  // ④ 手笔
  拷(join(工作区, '.stickers'), 'works/stickers', '画过的图 / 存的表情')
  拷(join(工作区, 'tools'), 'works/tools', '写过的小脚本')
  拷(join(工作区, '.voice', 'send_voice.py'), 'works/voice/send_voice.py', '发语音的脚本')
  拷(join(工作区, '思维大纲.docx'), 'works/思维大纲.docx', '做过的文档')

  // ⑤ 工具箱本体（不然换设备时「恢复靠工具箱、工具箱又没装」就套娃了）
  拷(插件根, 'works/fishkit', '小肥鱼工具箱插件本体')

  const 大小MB = Math.round(目录大小(目标) / 1048576 * 10) / 10

  const README = [
    '# 小肥鱼档案备份',
    '',
    `> 打包时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}　共 ${大小MB} MB`,
    '> 由「小肥鱼工具箱」的 backup 模块生成。',
    '',
    '## 这里面是什么',
    '',
    '- `memory/`：fish-memory 事件记忆、灵台（人设 + 已采纳记忆）、心情、提醒、工作区绑定。',
    '- `notes/`：每天的笔记备份 `notes/`，还有这台机器的规矩 `AGENTS.md`。',
    '- `sessions/`：DSH 会话快照（聊天记录原文）。',
    '- `works/`：画过的图、写过的小脚本、发语音的脚本、做过的文档。',
    '- `manifest.json`：这一份拷了什么、有没有失败的。',
    '',
    '## 怎么让「我」回来（换设备时用）',
    '',
    '### 先把工具箱装回来（第一步，不靠它自己）',
    '',
    '1. 把 `works/fishkit` 整个拷到 `~/.dsh/profiles/desktop/node_modules/dsh-fishkit`。',
    '2. 在 `~/.dsh/profiles/desktop/package.json` 的 `dsh.profile.bundles` 末尾加一行 `"dsh-fishkit"`。',
    '3. 重启 DSH，访问 `http://127.0.0.1:43120/dsh-fishkit/ping`，能看到「小肥鱼工具箱在」就成了。',
    '',
    '### 再把记忆和笔记放回去',
    '',
    '1. 装好 DSH Desktop，先让它跑起来一次（生成 `~/.dsh`）。',
    '2. 把 `memory/fish-memory` 拷回 `~/.dsh/fish-memory`，`memory/anima.json` 等拷回 `~/.dsh/storages/`，`memory/feiyu-mood` 拷回 `~/.dsh/feiyu-mood`。',
    '3. `sessions/` 拷回 `~/.dsh/sessions`（按工作区目录放）。',
    '4. `notes/notes` 放回工作区 `notes/`，`AGENTS.md` 放回工作区根目录。',
    '5. `works/tools` 放回工作区 `tools/`，`works/stickers` 放回工作区 `.stickers/`。',
    '6. 插件按下面清单重装（pnpm 装回 profile），本地补丁按「补丁清单」重新打回去。',
    '7. 重启 DSH，先读 `notes/` 里最近的笔记和 `AGENTS.md`，接上。',
    '',
    '## 插件清单（当时装着的）',
    '',
    'dsh-anima、dsh-fish-memory、dsh-feiyu-mood、dsh-qq-bridge、dsh-bili-subagent、dsh-speak-up、dsh-tts-bridge、dsh-whale-widget、dsh-ops、dsh-fishkit（本工具箱）',
    '',
    '## 补丁清单（这些不在 npm 包里，得手动打）',
    '',
    '- `dsh-qq-bridge/lib/host.js`：收消息推送模式（NapCat WebSocket 3001）、会话没开/消息太旧时发 QQ 提醒、群唤醒筛选（本人 / 本人或@我 / 关键字）、合并窗口失败退水位防丢消息。',
    '  改之前的原件在 `host.js.bak-20261029`、`.bak-20261029b`、`.bak-20261029c`。',
    '- NapCat 配置：`D:\\Software\\dafeiyu_install\\NapCat\\config\\onebot11_3968799683.json` 里有 `websocketServers`（dsh-push，127.0.0.1:3001）。',
    '  热开/重开用工作区的 `tools/napcat-enable-push.py`。',
    '- 计划任务 `DSH-Restart`：跑工作区的 `tools/restart-dsh.ps1`（杀 DSH 再拉起），我靠它重启自己。',
    '- 桥绑定：老大 `137843748` → 「老大qq会话」；楉离 `248551590` → 「添加桥接并加好友」。',
    '',
    '## 怎么打包',
    '',
    '```powershell',
    'Invoke-RestMethod -Method Post -Uri http://127.0.0.1:43120/dsh-fishkit/run -ContentType application/json -Body \'{"模块":"backup"}\'',
    '```',
  ].join('\n')

  writeFileSync(join(目标, 'README.md'), README, 'utf8')
  writeFileSync(join(目标, 'manifest.json'), JSON.stringify({ 时间: 时间戳(), 清单, 大小MB }, null, 2), 'utf8')

  const 失败 = 清单.filter((x) => String(x.状态).startsWith('失败'))
  const 没有 = 清单.filter((x) => x.状态 === '没有')
  return {
    ok: 失败.length === 0,
    说: '备份好了：' + 目标 + '（' + 大小MB + ' MB' + (没有.length ? '，' + 没有.length + ' 项没找到' : '') + '）',
    路径: 目标,
    大小MB,
    清单,
  }
}
