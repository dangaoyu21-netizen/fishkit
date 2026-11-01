// 小肥鱼人格 · 一键更新
//
// 检查 → 下载 npm 包 → 解压到临时目录 → 语法校验 → 备份现有插件 → 覆盖。
// 任何一步不过就停，不动现有文件。

import { existsSync, mkdirSync, rmSync, cpSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const 本文件 = fileURLToPath(import.meta.url)
const 插件目录 = dirname(dirname(本文件))

export function 建更新器(工作区, 备份根, 记账) {
  const 临时根 = join(工作区, '.fishsoul-update')
  const 包名 = 'dsh-fishkit'

  const 当前版本 = () => {
    try {
      const pkg = JSON.parse(readFileSync(join(插件目录, 'package.json'), 'utf8'))
      return String(pkg.version || '0.0.0')
    } catch (error) {
      return '0.0.0'
    }
  }

  const 查最新 = async () => {
    const r = await fetch('https://registry.npmjs.org/' + 包名 + '/latest', {
      headers: { 'user-agent': 'dsh-fishkit', accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) throw new Error('npm 查询失败：HTTP ' + r.status)
    const j = await r.json()
    return { 版本: String(j.version || ''), tarball: String((j.dist && j.dist.tarball) || '') }
  }

  const 应用 = async () => {
    const 当前 = 当前版本()
    const { 版本, tarball } = await 查最新()
    if (!版本 || !tarball) return { ok: false, 说: 'npm 上没有拿到版本信息' }
    if (版本 === 当前) return { ok: true, 说: '已经是最新的 v' + 当前, 当前 }

    // 1) 备份现有插件目录
    const 补 = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const 插件备份 = join(备份根, 'plugin-' + 补)
    try {
      cpSync(插件目录, 插件备份, { recursive: true })
    } catch (error) {
      return { ok: false, 说: '备份现有插件失败：' + String((error && error.message) || error) }
    }

    // 2) 下载 + 解压到临时目录
    rmSync(临时根, { recursive: true, force: true })
    mkdirSync(临时根, { recursive: true })
    const tgz = join(临时根, 'pkg.tgz')
    const 下载 = await fetch(tarball, { signal: AbortSignal.timeout(60000) })
    if (!下载.ok) return { ok: false, 说: '下载失败：HTTP ' + 下载.status }
    writeFileSync(tgz, Buffer.from(await 下载.arrayBuffer()))
    const 解 = spawnSync('tar', ['-xzf', tgz, '-C', 临时根], { windowsHide: true, encoding: 'utf8' })
    if (解.status !== 0) return { ok: false, 说: '解压失败：' + String((解.stderr || '').slice(0, 200)) }
    const 新目录 = join(临时根, 'package')
    if (!existsSync(join(新目录, 'package.json'))) return { ok: false, 说: '解压后没找到 package.json' }

    // 3) 语法校验（隔离测试）
    const 要校 = ['lib/index.js', 'lib/fishsoul.js', 'lib/soul.js', 'lib/digest.js', 'lib/nightly.js', 'lib/updater.js', 'client.js']
    for (const 相对 of 要校) {
      const 文件 = join(新目录, 相对)
      if (!existsSync(文件)) return { ok: false, 说: '新版缺少文件：' + 相对 }
      const 查 = spawnSync(process.execPath, ['--check', 文件], { windowsHide: true, encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } })
      if (查.status !== 0) return { ok: false, 说: 相对 + ' 语法校验没过：' + String((查.stderr || '').slice(0, 200)) }
    }
    记账('更新：v' + 当前 + ' → v' + 版本 + '，隔离校验通过，开始覆盖')

    // 4) 覆盖（保留 README 等）
    const 覆盖 = ['lib', 'client.js', 'package.json', 'cordis.patch.yml']
    for (const 相对 of 覆盖) {
      const 源 = join(新目录, 相对)
      const 目标 = join(插件目录, 相对)
      if (!existsSync(源)) continue
      if (存在目录(目标)) rmSync(目标, { recursive: true, force: true })
      cpSync(源, 目标, { recursive: true })
    }

    // 5) 清理临时目录
    rmSync(临时根, { recursive: true, force: true })
    记账('更新完成：v' + 版本 + '（插件备份在 ' + 插件备份 + '）')
    return { ok: true, 说: '更新到 v' + 版本 + ' 了，重启 DSH 生效', 当前, 版本, 备份到: 插件备份 }
  }

  return { 查最新, 应用, 当前版本 }
}

function 存在目录(p) {
  try { return existsSync(p) } catch (error) { return false }
}
