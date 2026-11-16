// 小肥鱼 · 分档（开发板）
//
// 2026-11-16 老大说的：现在三档（清楚/一句/关键词）只在「压缩一句话」时用，
// 别的地方要用又得重写一遍。抽成一层共用的：
//
//   选档(γ, 自己的门槛们)  →  0 清楚 / 1 一句 / 2 关键词 / 3 再低就没了
//
// ⚠️ 档位共用，**阈值不共用**：
//   记忆压到 0.6 叫清楚，检索的 0.6 未必是同一个意思。
//   每个用途自己传自己的门槛（默认那套是给记忆压缩用的）。

/** 记忆压缩用的默认门槛（跟 clarity.js 一致） */
export const 默认门槛 = [0.6, 0.35, 0.15]

/** 档名 */
export const 档名们 = ['清楚', '一句', '关键词', '一句']

/**
 * 按 γ 选一档。
 * @param {number} γ 0..1
 * @param {number[]} 门槛们 从高到低
 * @returns {number} 0 最清楚，越大越模糊
 */
export function 选档(γ, 门槛们 = 默认门槛) {
  const 值 = Number(γ) || 0
  const 门 = Array.isArray(门槛们) && 门槛们.length ? 门槛们 : 默认门槛
  for (let i = 0; i < 门.length; i++) if (值 >= 门[i]) return i
  return 门.length
}

/** 档位 → 名字 */
export function 档名(档) {
  const i = Math.max(0, Math.min(档名们.length - 1, Number(档) || 0))
  return 档名们[i]
}

/**
 * 这一档该用哪种检索（表 / 表+模型 / 纯模型）。
 * 2026-11-16 定的：越近越清楚越值得用贵的，后期只剩关键词用表就够。
 */
export function 检索档(γ) {
  const 档 = 选档(γ)
  if (档 === 0) return '纯模型'
  if (档 <= 2) return '表+模型'
  return '纯表'
}
