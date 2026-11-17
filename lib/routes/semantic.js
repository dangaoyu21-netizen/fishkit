// 语义模块的可选下载（2026-11-16）
//
// 老大要的：像 Mnemosyne 那样，给个「一键下载」，别让人自己去翻路径。
//
// 「可选」的意思是「可以不要」，不是「做不了」——别人可能用别的模型、别的后端，
// 所以这里按可插拔来长：
//   · 模型放 .fishsoul/models/<名字>/，不写死 bge；
//   · 配置里记「现在用哪个」（.fishsoul/models/current.json）；
//   · 运行库放 libs/，谁装谁有。
// 想换 bge-large、m3e、或者接别家 API，只换目录或一条配置，不用改代码。
//
// 有个坑要说清楚：真正算向量还得有 onnxruntime 的**运行库**——
// node 版二百九十三兆、web 版一百四十三兆，都太重，不自动下。
// 这里只负责**模型**（二十四兆），运行库由用户自己决定装不装；状态分开报。

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** 内置的一种来源（能用就下，不能用别人自己换） */
export const 模型源 = {
  名: 'bge-small-zh-v1.5',
  地址: 'https://hf-mirror.com/Xenova/bge-small-zh-v1.5/resolve/main',
  文件们: [
    ['onnx/model_quantized.onnx', 'model_quantized.onnx'],
    ['tokenizer.json', 'tokenizer.json'],
    ['config.json', 'config.json'],
  ],
}

export const 模型根 = (档案根) => join(String(档案根 || ''), 'models')

export function 模型目录(档案根, 名 = 模型源.名) {
  return join(模型根(档案根), String(名 || 模型源.名))
}

/** 现在用哪个模型（没写就是内置那个） */
export function 当前模型(档案根) {
  try {
    const p = join(模型根(档案根), 'current.json')
    if (existsSync(p)) {
      const j = JSON.parse(readFileSync(p, 'utf8'))
      if (j && j.名) return String(j.名)
    }
  } catch (error) {}
  return 模型源.名
}

/** 某个模型装没装 */
export function 模型状态(档案根, 名) {
  const 用名 = 名 || 当前模型(档案根)
  const 目录 = 模型目录(档案根, 用名)
  const 文件们 = 用名 === 模型源.名 ? 模型源.文件们 : 模型源.文件们
  const 已有 = []
  for (const [, 文件名] of 文件们) {
    const p = join(目录, 文件名)
    if (existsSync(p)) {
      let 大小 = 0
      try { 大小 = statSync(p).size } catch (error) {}
      已有.push({ 名: 文件名, 大小 })
    }
  }
  return {
    名: 用名,
    目录,
    齐了: 已有.length === 文件们.length,
    个数: 已有.length,
    应有: 文件们.length,
    文件: 已有,
  }
}

/** 档案里有哪些模型目录（换过的都列出来） */
export function 列模型(档案根) {
  const 根 = 模型根(档案根)
  const 出 = []
  try {
    for (const 项 of readdirSync(根, { withFileTypes: true })) {
      if (!项.isDirectory()) continue
      出.push(模型状态(档案根, 项.name))
    }
  } catch (error) {}
  return 出
}

/** 顺带看一眼运行库在不在（插件用的是 JS 那份，在 libs/node_modules 里）
 *  本目录传进来的是 lib/ ——要退三级才到工作区根（lib → 插件 → plugins → 根） */
export function 运行库状态(本目录) {
  const libs = join(String(本目录 || ''), '..', '..', '..', 'libs')
  const 试 = [
    ['onnxruntime-node', join(libs, 'node_modules', 'onnxruntime-node')],
    ['onnxruntime-common', join(libs, 'node_modules', 'onnxruntime-common')],
    ['tokenizers', join(libs, 'node_modules', '@huggingface', 'tokenizers')],
  ]
  const 有 = []
  const 缺 = []
  for (const [名, p] of 试) (existsSync(p) ? 有 : 缺).push(名)
  return { 目录: libs, 有, 缺, 齐了: 缺.length === 0 }
}

export function 挂语义路由(依赖) {
  const { 路线, 回, 记账, 档案, 本目录, 模型本, 检索 } = 依赖

  // 2026-11-17：探一下「能不能真调到模型」，顺便看模型重排效果
  路线('/dsh-fishsoul/semantic/ping', async (req, res) => {
    try {
      const 模 = 模型本
      if (!模 || typeof 模.有 !== 'function') return 回(res, { ok: false, 说: '没接模型本' })
      const 有 = 模.有()
      if (!有) return 回(res, { ok: false, 说: '宿主没给 llm 服务' })
      const url = new URL(req.url || '/', 'http://x')
      const 线索 = String(url.searchParams.get('q') || '修东西')
      const 果 = await 模.问({ 提示: '用一句话回答：你是什么模型？', 最多字: 200, 超时: 20000 })
      回(res, {
        ok: 果.ok,
        模型: typeof 模.说 === 'function' ? 模.说() : '',
        回答: 果.文本.slice(0, 120),
        说: 果.说,
      })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error).slice(0, 160) })
    }
  })

  // 模型重排（异步，供整理/手动调用，不占注入那条同步路）
  路线('/dsh-fishsoul/semantic/rerank', async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://x')
      const 线索 = String(url.searchParams.get('q') || '')
      if (!线索) return 回(res, { ok: false, 说: '给个 q=线索' })
      if (!检索 || typeof 检索.模型重排 !== 'function') return 回(res, { ok: false, 说: '检索没挂上' })
      const 条数 = Math.max(1, Math.min(12, Number(url.searchParams.get('n')) || 6))
      const 果 = await 检索.模型重排(线索, { 条数, 模型本 })
      回(res, {
        ok: true,
        条数: 果.length,
        们: 果.map((e) => ({ 关系: e.关系 || '', 摘要: String((e && e.summary) || '').slice(0, 60) })),
      })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error).slice(0, 160) })
    }
  })

  /** 看现在什么状态 */
  路线('/dsh-fishsoul/semantic/status', async (req, res) => {
    try {
      回(res, {
        ok: true,
        当前: 当前模型(档案.根),
        模型: 模型状态(档案.根),
        全部: 列模型(档案.根),
        运行库: 运行库状态(本目录),
        说: '模型能一键下；运行库（onnxruntime）太大，得自己装——没它语义还是用不了。'
          + '模型按目录分开放，想换别的只换目录或写 models/current.json。',
      })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })

  /** 下模型（只下模型，不碰运行库） */
  路线('/dsh-fishsoul/semantic/install', async (req, res) => {
    try {
      const 目录 = 模型目录(档案.根)
      mkdirSync(目录, { recursive: true })
      const 结果 = []
      for (const [源, 名] of 模型源.文件们) {
        const 目标 = join(目录, 名)
        if (existsSync(目标)) { 结果.push({ 名, 跳过: true }); continue }
        const r = await fetch(模型源.地址 + '/' + 源, { signal: AbortSignal.timeout(180000) })
        if (!r.ok) { 结果.push({ 名, 失败: 'HTTP ' + r.status }); continue }
        const b = Buffer.from(await r.arrayBuffer())
        writeFileSync(目标, b)
        结果.push({ 名, 字节: b.length })
        记账('语义模型：下了 ' + 名 + '（' + Math.round(b.length / 1024) + 'KB）')
      }
      const 状态 = 模型状态(档案.根)
      回(res, {
        ok: 状态.齐了,
        结果,
        模型: 状态,
        说: 状态.齐了 ? '模型齐了。还差运行库（onnxruntime）才真能算。' : '有文件没下成，看结果。',
      })
    } catch (error) {
      回(res, { ok: false, 说: String((error && error.message) || error) })
    }
  })
}
