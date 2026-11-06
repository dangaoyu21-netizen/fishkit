// 切 QQ 通道：先开自己的、再把旧桥关掉（2026-11-06）
//
// 用法：
//   node plugins/dsh-fishkit/tools/switch-qq.mjs         先看看要动什么（不改）
//   node plugins/dsh-fishkit/tools/switch-qq.mjs --yes   真动
//
// 顺序很要紧：先开自己的通道和自动回，验过再关旧桥；两条一起跑会一条消息回两遍。
// 关旧桥走它自己的接口（POST /dsh-qq-bridge/save），不去改它的配置文件。

const 基 = 'http://127.0.0.1:43120'
const 真动 = process.argv.includes('--yes')
const 说 = (s) => process.stdout.write(s + '\n')

const 取 = async (路径) => {
  const r = await fetch(基 + 路径)
  if (!r.ok) throw new Error('HTTP ' + r.status)
  return r.json()
}
const 投 = async (路径, 体) => {
  const r = await fetch(基 + 路径, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(体 || {}),
  })
  return r.json()
}

const 说状态 = (名, ok, 细节) => 说((ok ? '  ✓ ' : '  ✗ ') + 名 + (细节 ? ' —— ' + 细节 : ''))

说('== 动之前 ==')
const 我的 = await 取('/dsh-fishsoul/qqlink')
const 桥 = await 取('/dsh-qq-bridge/state')
const 我的开 = Boolean(我的.配置 && 我的.配置.开关 === true)
const 自动回 = Boolean(我的.配置 && 我的.配置.自动回 === true)
const 桥开 = Boolean(桥.配置 && 桥.配置.总开关 === true)
说状态('自己的通道', 我的开, 我的开 ? '开着' : '关着')
说状态('自动回 QQ', 自动回, 自动回 ? '开着' : '关着')
说状态('旧桥', 桥开, 桥开 ? '开着（会重复）' : '关着')
const 绑定 = (我的.配置 && 我的.配置.绑定) || []
说('  绑定 ' + 绑定.length + ' 条：' + 绑定.map((b) => (b.类型 || '') + ' ' + b.号码 + ' → ' + String(b.会话).slice(-8)).join('，'))

if (!真动) {
  说('')
  说('这是 dry-run。要真动就加 --yes。')
  说('顺序：开通道 → 开自动回 → 复查 → 关旧桥。')
  process.exit(0)
}

说('== 开始切 ==')
const 一 = await 投('/dsh-fishsoul/qqlink', { 开关: true })
说状态('开自己的通道', Boolean(一.ok), 一.说)
const 二 = await 投('/dsh-fishsoul/qqlink', { 设置: { 自动回: true } })
说状态('开自动回', Boolean(二.ok), 二.说)

// 复查：自己这边确实开了
const 复查 = await 取('/dsh-fishsoul/qqlink')
const 复查开 = Boolean(复查.配置 && 复查.配置.开关 === true)
const 复查回 = Boolean(复查.配置 && 复查.配置.自动回 === true)
if (!复查开 || !复查回) {
  说('  ✗ 自己这边没开成（通道 ' + 复查开 + ' / 自动回 ' + 复查回 + '），旧桥先不动。')
  process.exitCode = 1
} else {
  说状态('复查自己的通道', true, '开着')
  说状态('复查自动回', true, '开着')
  // 再关旧桥
  const 关 = await 投('/dsh-qq-bridge/save', { 总开关: false })
  说状态('关旧桥', Boolean(关.ok), 关.ok ? '总开关已经关了' : (关.说 || '没关成'))
  const 末 = await 取('/dsh-qq-bridge/state')
  说状态('复查旧桥', !(末.配置 && 末.配置.总开关 === true), 末.配置 && 末.配置.总开关 ? '还开着！' : '关着')
}
说('')
说('切完了。下一步：从 QQ 发一条私聊，看这边收没收到、回复回没回到手机上。')
