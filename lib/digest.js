// 小肥鱼人格 · 沉淀（整理器）
//
// 把最近攒下的事件，按规则小步写进八维；锁着或手动调过的维度不动。
// 第一版不调模型：情绪方向影响乐观/悲观，互动频率影响粘人/独立。

const 平均 = (数们) => (数们.length ? 数们.reduce((a, b) => a + b, 0) / 数们.length : 0)

export function 建整理器(档案, 记账) {
  const 整理 = (参数 = {}) => {
    const 状态 = 档案.读状态()
    const 取数 = Math.max(1, Math.min(100, Number(参数.最近) || 20))
    const 事件们 = (状态.events || []).slice(-取数)
    if (!事件们.length) return { ok: true, 说: '还没有可整理的事件', 变了: [] }

    const 平均效价 = 平均(事件们.map((e) => Number(e.valence) || 0))
    const 条数 = 事件们.length
    const 维度们 = (状态.dims || []).map((d) => ({ ...d }))
    const 变了 = []

    const 动 = (key, 幅度) => {
      const d = 维度们.find((x) => x.key === key)
      if (!d || d.locked) return
      const 旧 = Number(d.value) || 0
      const 新值 = Math.max(-1, Math.min(1, Math.round((旧 + 幅度) * 100) / 100))
      if (新值 === 旧) return
      d.value = 新值
      d.manual = false
      变了.push({ key, from: 旧, to: 新值 })
    }

    // 情绪方向 → 乐观/悲观（最多一步 0.04）
    动('乐观-悲观', Math.max(-0.04, Math.min(0.04, 平均效价 * 0.06)))
    // 互动多 → 粘人（每多 10 条动 0.01，最多 0.03）
    动('粘人-独立', Math.min(0.03, Math.max(0, (条数 - 8) * 0.001)))
    // 连续多事还平稳 → 温和一点
    动('温和-强硬', 条数 >= 10 ? 0.01 : 0)

    if (!变了.length) return { ok: true, 说: '整理过了，这次没有要动的', 变了 }

    // 写回（保存里对 dims 的变化会自动记演化历史）
    档案.保存({ dims: 维度们 })
    记账('整理：动了 ' + 变了.map((x) => x.key + ' ' + (x.to >= 0 ? '+' : '') + x.to.toFixed(2)).join('、'))
    return { ok: true, 说: '整理好了：' + 变了.map((x) => x.key).join('、'), 变了, 平均效价: Math.round(平均效价 * 100) / 100, 条数 }
  }

  return { 整理 }
}
