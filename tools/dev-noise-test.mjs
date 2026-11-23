// 噪音过滤的测试：系统注入不能进记忆。
//
// 2026-11-23 起的：一天从记忆里清出两百多条系统注入，清完改一次 AGENTS.md 又长四条。
// 所以把过滤挪到了入口（lastText）和第二道关（记这一轮），这个测试盯着它别再漏。
//
// 跑法：node plugins/dsh-fishkit-dev/tools/dev-noise-test.mjs

import { 是系统注入 } from '../lib/soul.js'

let 过 = 0
let 挂 = 0
const 试 = (名, 真, 期望) => {
  const 好 = 真 === 期望
  if (好) 过++
  else 挂++
  console.log((好 ? '  ✓ ' : '  ✗ ') + 名 + (好 ? '' : `（期望 ${期望}，实际 ${真}）`))
}

console.log('该拦下的：')

试('上一轮带进来的 runtime context', 是系统注入('Current runtime context. This snapshot supersedes...'), true)
试('带进来的时间采样', 是系统注入('Time sampled while preparing turn 901, step 1: 2026-11-23T...'), true)
试('闲着叫醒那句', 是系统注入('（没人找你，你闲着。这个会话能主动用的平台：B站。'), true)
试('定时提醒', 是系统注入('[SCHEDULE REMINDER]\nschedule_id_json: "schedule-abc"'), true)
试('定时提醒（旧格式）', 是系统注入('This is a scheduled message from the user'), true)
试('AGENTS.md 更新通知', 是系统注入('Updated instructions from: AGENTS.md\n\n# 这台机器上的规矩'), true)
试('包了 system-reminder 标签的', 是系统注入('<system-reminder>\nThe available skill catalog changed.'), true)
试('技能目录变更', 是系统注入('The available skill catalog changed. This complete catalog replaces...'), true)
试('前面有空白和换行的', 是系统注入('\n\n  （没人找你，你忙着。）'), true)

console.log('该放过去的：')

试('普通一句话', 是系统注入('饭饭——饭饭——'), false)
试('带括号但不是那句', 是系统注入('（笑）你这也太可爱了'), false)
试('提到 AGENTS.md 的聊天', 是系统注入('我准备看看你 AGENTS.md 里写了点什么'), false)
试('提到提醒的聊天', 是系统注入('你那个提醒设了几点？'), false)
试('提到 system-reminder 这个词的聊天', 是系统注入('为什么会有 system-reminder 这种东西'), false)
试('空的', 是系统注入(''), false)
试('只有空白', 是系统注入('   \n  '), false)
试('undefined', 是系统注入(undefined), false)

console.log('')
console.log(挂 === 0 ? `全过（${过} 项）` : `挂了 ${挂} 项，过了 ${过} 项`)
process.exitCode = 挂 === 0 ? 0 : 1
