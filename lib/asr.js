// 小肥鱼 · 语音转写（2026-11-05）
//
// 用 faster-whisper 的 small 模型，纯 CPU 跑。
// 依赖和模型都不进包：第一次用之前点一下「装依赖」，之后就直接转。
// 跟平台那套一个规矩：查依赖 / 装依赖 / 真要用了才动。
//
// ⚠️ 依赖装在本机（借用 bili-duty 那间 venv），模型下到 `~/.dsh/fishkit-asr/models`。

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

export const ASR根 = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'fishkit-asr')
export const 模型根 = join(ASR根, 'models')
export const 模型名 = 'small'
export const 包名 = 'faster-whisper'

function 取Python() {
  const 候选 = [
    join(homedir(), '.dsh', 'bili-duty', '.venv', 'Scripts', 'python.exe'),
    join(homedir(), '.dsh', 'bili-duty', '.venv', 'bin', 'python'),
  ]
  for (const x of 候选) if (existsSync(x)) return x
  return 'python'
}

/** 跑个命令，收尾 */
function 跑(命令, 参数 = [], 超时 = 120000) {
  return new Promise((解决) => {
    let 出 = ''
    let 错 = ''
    let 完 = false
    let 子 = null
    try {
      子 = spawn(命令, 参数, { windowsHide: true })
    } catch (error) {
      return 解决({ ok: false, 出: '', 错: String((error && error.message) || error) })
    }
    子.stdout.on('data', (d) => { 出 += String(d) })
    子.stderr.on('data', (d) => { 错 += String(d) })
    子.on('error', (error) => {
      if (完) return
      完 = true
      解决({ ok: false, 出, 错: String((error && error.message) || error) })
    })
    子.on('close', (码) => {
      if (完) return
      完 = true
      解决({ ok: 码 === 0, 出, 错 })
    })
    const 闹钟 = setTimeout(() => {
      if (完) return
      完 = true
      try { 子.kill() } catch (error) {}
      解决({ ok: false, 出, 错: 错 + '\n（超时了）' })
    }, 超时)
    子.on('close', () => clearTimeout(闹钟))
  })
}

/** 依赖装没装 */
export async function 探ASR() {
  const python = 取Python()
  const 果 = await 跑(python, ['-c', 'import faster_whisper; print("ok")'], 30000)
  if (果.ok && /ok/.test(果.出)) return { ok: true, 已装: true, python, 说: '依赖在' }
  if (/ENOENT|not recognized|找不到/i.test(果.错)) return { ok: false, 已装: false, python, 说: '找不到 Python' }
  if (/EPERM|spawn/i.test(果.错)) return { ok: false, 已装: false, python, 说: '起不了进程' }
  return { ok: true, 已装: false, python, 说: '还没装' }
}

/** 装依赖（后台装，进度写日志） */
export async function 装ASR(记账 = () => {}) {
  const python = 取Python()
  mkdirSync(ASR根, { recursive: true })
  记账('开始装语音转写依赖：' + 包名)
  const 果 = await 跑(python, ['-m', 'pip', 'install', '--disable-pip-version-check', 包名], 900000)
  if (!果.ok) {
    记账('装 ' + 包名 + ' 没成：' + (果.错 || 果.出 || '').split('\n').slice(-2).join(' ').slice(0, 200))
    return { ok: false, 说: '没装上，看下面那行' }
  }
  const 再查 = await 探ASR()
  记账('语音转写依赖：' + (再查.已装 ? '装好了' : '装完还是导不进来'))
  return { ok: 再查.已装, 说: 再查.已装 ? '装好了' : '装完却导不进来，看看日志' }
}

const 脚本 = `import sys, os
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
from faster_whisper import WhisperModel
模型 = WhisperModel(sys.argv[1], device="cpu", compute_type="int8", download_root=sys.argv[2])
段们, _ = 模型.transcribe(sys.argv[3], language="zh", beam_size=1, vad_filter=True)
print("".join(段.text for 段 in 段们).strip())
`

/**
 * 把一段语音转成文字。
 * @param {string} 音频地址 本地文件或 http(s) 地址
 * @returns {Promise<{ok:boolean, 文字:string, 说:string}>}
 */
export async function 转写(音频地址, 选项 = {}) {
  const 地址 = String(音频地址 || '').trim()
  if (!地址) return { ok: false, 文字: '', 说: '没给音频' }
  const 查 = await 探ASR()
  if (!查.ok || !查.已装) return { ok: false, 文字: '', 说: 查.说 || '转写依赖没装' }
  const 脚本路径 = join(ASR根, 'transcribe.py')
  try {
    mkdirSync(ASR根, { recursive: true })
    writeFileSync(脚本路径, 脚本, 'utf8')
  } catch (error) {
    return { ok: false, 文字: '', 说: '写不进脚本：' + String((error && error.message) || error) }
  }
  const 果 = await 跑(查.python, [脚本路径, 模型名, 模型根, 地址], Number(选项.超时秒 || 120) * 1000)
  if (!果.ok) {
    const 人话 = /No such file|not found|cannot find/i.test(果.错) ? '音频拉不下来或者文件不在' : (果.错 || 果.出 || '').split('\n').slice(-1)[0]
    return { ok: false, 文字: '', 说: '转写失败：' + String(人话 || '').slice(0, 160) }
  }
  const 文字 = String(果.出 || '').trim()
  if (!文字) return { ok: true, 文字: '', 说: '转出来是空的（可能没说话）' }
  return { ok: true, 文字, 说: '' }
}
