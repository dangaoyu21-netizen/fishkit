// 加权抽（2026-11-12）
//
// 为什么单独拎出来：情绪影响「主动找事往哪走」——心情高多想出门、心情低多想收拾。
// 这层逻辑放 soul.js 里不好单测，拎出来就能拿固定的「随机数」验分布。
//
// 用法：
//   加权抽([['出门', 2], ['整理', 1], ['神游', 0.5]])
//   加权抽(权重们, () => 0.1)   // 传个假随机数，结果可复现

export const 版本 = '0.1.0'

/** 权重们：[[值, 权重], ...]；权重 ≤0 的等于不参与 */
export function 加权抽(权重们, 随机 = Math.random) {
  const 有效 = (权重们 || []).filter((x) => x && Number(x[1]) > 0)
  if (!有效.length) return null
  const 总 = 有效.reduce((和, x) => 和 + Number(x[1]), 0)
  let 落 = Number(随机()) * 总
  for (const [值, 权] of 有效) {
    落 -= Number(权)
    if (落 <= 0) return 值
  }
  return 有效[有效.length - 1][0]
}

/**
 * 按心情算「往哪走」的权重（2026-11-12 老大定的：情绪别只影响说话甜不甜，也影响做事往哪走）。
 *
 * @param {{ valence?: number }} 心情  抵触↔接受，-1..1；越高兴越想出门
 * @param {string[]} 平台们            这个会话勾着的平台（能出门的地方）
 * @param {{ 整理: string, 神游: string }} 名
 * @returns {Array<[string, number]>}
 */
export function 按心情算权重(心情, 平台们, 名) {
  const v = Math.max(-1, Math.min(1, Number((心情 && 心情.valence) ?? 0.3)))
  // 心情好：出门重；心情低：内向重（整理 / 神游）
  const 出门重 = Math.max(0.15, Math.min(3, 0.5 + v * 2.2))
  const 内向重 = Math.max(0.2, Math.min(2.6, 1.4 - v * 1.6))
  const 权重们 = []
  for (const p of 平台们 || []) 权重们.push([p, 出门重])
  权重们.push([名.整理, 内向重])
  权重们.push([名.神游, 内向重 * 0.7])
  return 权重们
}
