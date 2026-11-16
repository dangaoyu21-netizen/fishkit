// 小肥鱼 · 本地语义（开发板）
//
// 2026-11-16：DeepSeek 没有 embedding 接口，DSH 的登录态也接不过去，
// 所以退到本地：bge-small-zh-v1.5 的量化 ONNX + onnxruntime-node + tokenizers.js。
//
// 三块都在了：
//   · onnxruntime-node  → libs/node_modules/onnxruntime-node（手动下的 tgz，npm 装不了，它要 spawn）
//   · 分词              → libs/node_modules/@huggingface/tokenizers
//   · 模型              → .fishsoul/models/<名字>/（model_quantized.onnx / tokenizer.json / tokenizer_config.json）
//
// 用法：
//   建语义({ 档案根 })            → { 有, 算向量, 余弦, 相似, 说 }
//   语义.算向量('旧物修复')        → Float32Array(512)
//   语义.相似('旧物修复','修东西') → 0.72
//
// 找不到任何一块就返回「有:false」，调用方自己退回纯表，别抛。

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'

/** 默认模型名（跟 routes/semantic.js 的内置源一致） */
export const 默认模型 = 'bge-small-zh-v1.5'

/**
 * 建一个本地语义本。
 * @param {object} 选项 { 档案根, 本目录, 模型名 }
 */
export function 建语义(选项 = {}) {
  const 档案根 = String(选项.档案根 || '')
  const 本目录 = String(选项.本目录 || '')
  const 模型名 = String(选项.模型名 || 默认模型)
  const 模型目录 = 档案根 ? join(档案根, 'models', 模型名) : ''
  const libs = 本目录 ? resolve(本目录, '..', '..', 'libs') : ''

  let 会 = null
  let 词 = null
  let 载入失败 = ''

  /** 懒载入：第一次用才开，省得启动就吃内存 */
  const 载入 = () => {
    if (会 && 词) return true
    if (载入失败) return false
    try {
      if (!模型目录 || !existsSync(join(模型目录, 'model_quantized.onnx'))) {
        载入失败 = '模型没下'
        return false
      }
      if (!libs || !existsSync(join(libs, 'node_modules', 'onnxruntime-node'))) {
        载入失败 = '没有 onnxruntime-node'
        return false
      }
      if (!existsSync(join(libs, 'node_modules', '@huggingface', 'tokenizers'))) {
        载入失败 = '没有分词器'
        return false
      }
      const r = createRequire(join(libs, 'noop.js'))
      const ort = r('onnxruntime-node')
      const { Tokenizer } = r('@huggingface/tokenizers')
      const 词表 = JSON.parse(readFileSync(join(模型目录, 'tokenizer.json'), 'utf8'))
      const 配置路径 = join(模型目录, 'tokenizer_config.json')
      const 配置 = existsSync(配置路径) ? JSON.parse(readFileSync(配置路径, 'utf8')) : {}
      词 = new Tokenizer(词表, 配置)
      // 载入模型是异步的，这里同步接口兜不住——先返回「正在载入」，真正用的时候走 算向量Async
      会 = ort
      return true
    } catch (error) {
      载入失败 = String((error && error.message) || error).slice(0, 120)
      return false
    }
  }

  let 会话 = null
  let 会话正在开 = null

  const 开会话 = async () => {
    if (会话) return 会话
    if (!载入()) return null
    if (!会话正在开) {
      会话正在开 = onnx会话()
    }
    会话 = await 会话正在开
    return 会话
  }

  let onnx会话 = async () => {
    try {
      const r = createRequire(join(libs, 'noop.js'))
      const ort = r('onnxruntime-node')
      return await ort.InferenceSession.create(join(模型目录, 'model_quantized.onnx'))
    } catch (error) {
      载入失败 = String((error && error.message) || error).slice(0, 120)
      return null
    }
  }

  /** 一段文字 → 归一化向量（异步，第一次会慢一点） */
  const 算向量 = async (文本) => {
    const s = await 开会话()
    if (!s || !词) return null
    const r = createRequire(join(libs, 'noop.js'))
    const ort = r('onnxruntime-node')
    const 编 = 词.encode(String(文本 || ''))
    const ids = BigInt64Array.from(编.ids.map((x) => BigInt(x)))
    const 掩 = BigInt64Array.from((编.attention_mask || 编.ids.map(() => 1)).map((x) => BigInt(x)))
    const 形 = [1, ids.length]
    const 输入 = {
      input_ids: new ort.Tensor('int64', ids, 形),
      attention_mask: new ort.Tensor('int64', 掩, 形),
    }
    if (s.inputNames.includes('token_type_ids')) {
      输入.token_type_ids = new ort.Tensor('int64', new BigInt64Array(ids.length), 形)
    }
    try {
      const 出 = await s.run(输入)
      const 头 = 出[s.outputNames[0]]
      // last_hidden_state: [1, seq, 512] —— 取 CLS，再归一化
      const 数 = 头.data
      const 维 = 数.length / ids.length
      const v = new Float32Array(维)
      for (let i = 0; i < 维; i++) v[i] = 数[i]
      let 范 = 0
      for (let i = 0; i < 维; i++) 范 += v[i] * v[i]
      范 = Math.sqrt(范) || 1
      for (let i = 0; i < 维; i++) v[i] /= 范
      return v
    } catch (error) {
      载入失败 = String((error && error.message) || error).slice(0, 120)
      return null
    }
  }

  /** 余弦（两个都已归一化，直接点积） */
  const 余弦 = (a, b) => {
    if (!a || !b || a.length !== b.length) return 0
    let 和 = 0
    for (let i = 0; i < a.length; i++) 和 += a[i] * b[i]
    return 和
  }

  /** 两段文字的相似度 */
  const 相似 = async (a, b) => {
    const va = await 算向量(a)
    const vb = await 算向量(b)
    return 余弦(va, vb)
  }

  return {
    get 有() { return 载入() },
    get 说() { return 载入失败 || (载入() ? '能用' : '还不知道') },
    模型目录,
    算向量,
    余弦,
    相似,
  }
}
