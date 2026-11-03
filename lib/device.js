// 小肥鱼 · 设备码（开发板）
//
// 2026-11-02 老大提的、11-03 补的规矩：
//   用「UUID + 设备哈希」给每台机器一个码，用来区分设备、生成配置参数。
//
// 🔒 硬性要求：原始值绝不出内存
//   - MachineGuid 读进来就地哈希，原始值只活一次引用；不落盘、不进日志、不进注入、不上传。
//   - 档案里只存：uuid（随机）、盐（随机）、设备码（哈希后）。
//   - 自检脚本 tools/check-leaks.mjs 会扫档案和日志，确认没有原文痕迹。
//
// 落点：persona/device.json
//   { "uuid": "...", "盐": "...", "设备码": "32 位十六进制", "生成于": "..." }
//
// ⚠️ 开发板：先在这里长，验过才合回主插件。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

export const 版本 = '0.1.0'
/** 设备码取哈希前多少位 */
export const 码长 = 32

const 读JSON = (路径, 兜底) => {
  try {
    if (!existsSync(路径)) return 兜底
    const 原 = readFileSync(路径, 'utf8')
    return 原.trim() ? JSON.parse(原) : 兜底
  } catch (error) {
    return 兜底
  }
}

const 写JSON = (路径, 值) => {
  mkdirSync(join(路径, '..'), { recursive: true })
  writeFileSync(路径, JSON.stringify(值, null, 2) + '\n', 'utf8')
}

/**
 * 读这台机器的 MachineGuid。
 * ⚠️ 只在 建设备 内部用一次，拿到就哈希，绝不往外传、绝不写日志。
 */
function 取机器标识() {
  try {
    const r = spawnSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], {
      windowsHide: true, encoding: 'utf8',
    })
    const 出 = String((r && r.stdout) || '')
    const m = 出.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{8,})/)
    return m ? m[1] : ''
  } catch (error) {
    return ''
  }
}

/**
 * 建一个设备码本。
 * @param {object} 选项 { 根, 记账 }
 */
export function 建设备(选项 = {}) {
  const 根 = String(选项.根 || '')
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  // 测试时可以塞一个假的进来；正式跑就用系统那个
  const 取标识 = typeof 选项.取标识 === 'function' ? 选项.取标识 : 取机器标识
  const 文件 = 根 ? join(根, 'persona', 'device.json') : ''

  const 读 = () => (根 ? 读JSON(文件, null) : null)

  /** 第一次用就生成一份；已有就直接返回 */
  const 初始化 = () => {
    if (!根) return null
    const 旧 = 读()
    if (旧 && 旧.uuid) return 旧
    try {
      const uuid = randomUUID()
      const 盐 = randomBytes(16).toString('hex')
      // 机器标识只在这一段里活一次，出了这个 if 就没了
      const 机器 = 取标识()
      const 设备码 = 机器
        ? createHash('sha256').update(盐 + 机器).digest('hex').slice(0, 码长)
        : ''
      // 机器已经用完，之后只认设备码
      const 新 = { uuid, 盐, 设备码, 生成于: new Date().toISOString() }
      写JSON(文件, 新)
      记账('生成了设备码' + (设备码 ? '（' + 设备码.slice(0, 8) + '…）' : '（这台机器读不到标识，先只留 uuid）'))
      return 新
    } catch (error) {
      记账('设备码生成失败：' + String((error && error.message) || error))
      return null
    }
  }

  /** 给别处用的一小份（只带 uuid 和设备码前 8 位，够区分、不泄露） */
  const 摘要 = () => {
    const 盘 = 初始化()
    if (!盘) return { uuid: '', 短码: '', 有设备码: false }
    return {
      uuid: 盘.uuid,
      短码: 盘.设备码 ? String(盘.设备码).slice(0, 8) : '',
      有设备码: !!盘.设备码,
    }
  }

  return { 初始化, 读, 摘要 }
}
