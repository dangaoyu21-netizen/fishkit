// 小肥鱼 · 人格插件 —— 设置页（client 半）
//
// 纯 JS + React jsx-runtime，不依赖 JSX 构建。
// 数据从 host 的 /dsh-fishsoul/* 读写；host 没起来时显示占位。

window.__ModuleLoader__.load({
  id: 'dsh-fishkit',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const { jsx: h, jsxs: hs } = require('react/jsx-runtime')
    const React = require('react')

    const e = (type, props, ...children) => {
      const p = props || {}
      if (children.length === 0) return h(type, p)
      if (children.length === 1) return h(type, { ...p, children: children[0] })
      return hs(type, { ...p, children })
    }

    const { useState, useEffect, useRef } = React

    const VERSION = '0.1.0'
    const SCHEMA = 1
    const REPO = 'https://github.com/dangaoyu21-netizen/fishkit'

    const CSS = `
      .fk-wrap { padding:4px 2px 24px; font-size:13px; color:var(--text-primary, #e8e8e8); background:rgba(127,127,127,.05); border-radius:8px; }
      .fk-top { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
      .fk-brand { font-weight:700; font-size:15px; }
      .fk-ver { color:#8f8f8f; font-size:12px; }
      .fk-top .fk-grow { flex:1; }
      .fk-btn { background: transparent; border:1px solid rgba(127,127,127,.35); color:var(--text-primary, #e8e8e8); border-radius:6px; padding:3px 10px; font-size:12px; cursor:pointer; font-weight:700; }
      .fk-btn:hover { border-color: rgba(127,127,127,.55); }
      .fk-badge { border:1px solid rgba(127,127,127,.28); background:rgba(127,127,127,.06); border-radius:8px; padding:8px 10px; margin-bottom:10px; min-height:34px; display:flex; align-items:center; gap:10px; }
      .fk-tabs { display:flex; gap:6px; margin-bottom:10px; }
      .fk-tab { flex:1; text-align:center; background:transparent; border:1px solid rgba(127,127,127,.35); border-radius:8px; color:#9a9a9a; padding:6px 4px; cursor:pointer; font-size:13px; }
      .fk-tab:hover { border-color: rgba(127,127,127,.55); }
      .fk-tab.active { color:#e8e8e8; border-color:#679EFE; background:rgba(103,158,254,.12); font-weight:700; }
      .fk-switch-row { display:flex; align-items:center; justify-content:space-between; padding:8px 2px; }
      .fk-name { font-weight:700; font-size:14px; }
      .fk-sub { color:#8f8f8f; font-size:12px; }
      .fk-switch { width:38px; height:20px; border-radius:10px; background:rgba(127,127,127,.35); border:none; position:relative; cursor:pointer; flex:0 0 auto; }
      .fk-switch.on { background:#4a7cf0; }
      .fk-switch i { position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:8px; background:#fff; transition:left .15s; }
      .fk-switch.on i { left:20px; background:#fff; }
      .fk-card { border:1px solid rgba(127,127,127,.28); background:rgba(127,127,127,.08); border-radius:8px; padding:10px 12px; margin:0 0 10px 0; }
      .fk-row { display:flex; align-items:center; gap:8px; padding:3px 0; }
      .fk-grow { flex:1; }
      .fk-win { border:1px solid rgba(127,127,127,.28); background:rgba(127,127,127,.06); color:var(--text-primary, #e8e8e8); border-radius:6px; padding:10px 12px; line-height:1.5; }
      .fk-w2 { min-height:40px; font-size:12px; max-height:40px; overflow:auto; }
      .fk-w5 { max-height:96px; font-size:12px; overflow:auto; }
      .fk-note { color:#8f8f8f; font-size:12px; font-style:italic; text-align:center; margin:8px 0; }
      .fk-search { background:rgba(127,127,127,.10); border:1px solid rgba(127,127,127,.35); border-radius:6px; color:var(--text-primary, #e8e8e8); padding:5px 8px; font-size:13px; }
      .fk-person { display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid rgba(127,127,127,.18); }
      .fk-pct { font-weight:700; font-variant-numeric:tabular-nums; }
      .fk-trash { background:transparent; border:none; cursor:pointer; padding:0 2px; line-height:0; }
      .fk-dim { display:grid; grid-template-columns: 34px 1fr 34px 20px 46px; align-items:center; gap:8px; padding:4px 0; border-bottom:1px solid rgba(127,127,127,.14); }
      .fk-dim.picked { background:rgba(103,158,254,.10); }
      .fk-dim .fk-lab { width:34px; text-align:right; color:#9a9a9a; font-size:12px; }
      .fk-dim .fk-lab.r { text-align:left; }
      .fk-range { -webkit-appearance:none; appearance:none; width:100%; height:24px; background:transparent; cursor:pointer; position:relative; z-index:2; }
      .fk-range::-webkit-slider-runnable-track { height:4px; border-radius:2px; background:rgba(127,127,127,.35); }
      .fk-range::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px; border-radius:6px; background:#e8e8e8; margin-top:-4px; }
      .fk-range.fk-line-thumb::-webkit-slider-thumb { -webkit-appearance:none; width:4px; height:18px; border-radius:2px; background:#e8e8e8; margin-top:-7px; }
      .fk-range:disabled { cursor: default; opacity:.55; }
      .fk-lock { background:transparent; border:none; cursor:pointer; padding:0; color:#e8e8e8; line-height:0; opacity:.35; }
      .fk-lock.on { opacity:1; }
      .fk-zero { position:absolute; left:50%; top:50%; height:8px; width:2px; background:rgba(127,127,127,.65); transform:translate(-50%,-50%); pointer-events:none; z-index:1; }
      .fk-track-wrap { position:relative; flex:1; }
      .fk-mark { position:absolute; top:50%; height:14px; width:2px; transform:translate(-50%,-50%); pointer-events:none; }
      .fk-mark.base { background:rgba(127,127,127,.6); }
      .fk-flat { display:flex; gap:12px; margin-bottom:10px; }
      .fk-doc-title { font-weight:700; }
      .fk-num { width:52px; text-align:right; }
      .fk-pc { color:#8f8f8f; }
      .fk-repo { color:#8f8f8f; font-size:12px; margin-bottom:8px; word-break:break-all; }
      .fk-say { color:#8f8f8f; font-size:12px; margin:0 0 8px 0; text-align:center; }
    `

    const PAGES = ['态度', '记忆', '情绪', '人设', '成长', '行为', '更新历史']

    // ── 跟 host 说话 ────────────────────────────────────────
    const 拉状态 = () => fetch('/dsh-fishsoul/state', { cache: 'no-store' }).then((r) => r.json())
    const 存档案 = (补丁) => fetch('/dsh-fishsoul/save', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(补丁),
    }).then((r) => r.json())

    function use保存() {
      const 计时 = useRef(null)
      return (补丁) => {
        if (计时.current) clearTimeout(计时.current)
        计时.current = setTimeout(() => { void 存档案(补丁).catch(() => {}) }, 500)
      }
    }

    // ── 小组件 ──────────────────────────────────────────────
    const Switch = ({ on, onChange }) =>
      e('button', { className: 'fk-switch' + (on ? ' on' : ''), onClick: () => onChange && onChange(!on), 'aria-pressed': on }, e('i', null))

    const Trash = ({ onClick }) =>
      e('button', { className: 'fk-trash', title: '删除', onClick },
        e('svg', { width: 14, height: 14, viewBox: '0 0 14 14' },
          e('rect', { x: 3, y: 2, width: 8, height: 1.6, fill: '#d04040' }),
          e('rect', { x: 5, y: 0.6, width: 4, height: 1.6, fill: '#d04040' }),
          e('rect', { x: 3.6, y: 4, width: 6.8, height: 8, rx: 1.2, fill: 'none', stroke: '#d04040', strokeWidth: 1.2 }),
          e('line', { x1: 5.4, y1: 5.2, x2: 5.4, y2: 10.8, stroke: '#d04040', strokeWidth: 1 }),
          e('line', { x1: 7, y1: 5.2, x2: 7, y2: 10.8, stroke: '#d04040', strokeWidth: 1 }),
          e('line', { x1: 8.6, y1: 5.2, x2: 8.6, y2: 10.8, stroke: '#d04040', strokeWidth: 1 }),
        ))

    const Note = ({ children }) => e('div', { className: 'fk-note' }, children)

    const Range = ({ value, min = -1, max = 1, step = 0.01, snap = 0.05, onChange, cls, disabled }) =>
      e('input', {
        className: 'fk-range' + (cls ? ' ' + cls : ''), type: 'range', min, max, step, value, disabled,
        onChange: (ev) => {
          let v = parseFloat(ev.target.value)
          if (Math.abs(v) < snap) v = 0
          onChange && onChange(v)
        },
      })

    const ZeroTrack = ({ children }) =>
      e('div', { className: 'fk-track-wrap' }, e('div', { className: 'fk-zero' }), children)

    const MoodTrack = ({ value, base, onChange, disabled, min = -1, max = 1 }) => {
      const pos = (v) => ((v - min) / (max - min)) * 100
      return e('div', { className: 'fk-track-wrap' },
        e('div', { className: 'fk-mark base', style: { left: pos(base) + '%' } }),
        e(Range, { value, onChange, cls: 'fk-line-thumb', disabled, min, max }))
    }

    // ── 态度页 ─────────────────────────────────────────────
    const 态度页 = ({ 状态, 改 }) => {
      const [q, setQ] = useState('')
      const 人 = (状态.attitude && 状态.attitude.people) || []
      const 归一 = (t) => String(t || '').toLowerCase().replace(/\s+/g, '')
      const 列 = 人.filter((p) => !q || 归一(p.name).includes(归一(q)) || 归一(p.id).includes(归一(q)))
      const 存人 = (下一个) => 改({ attitude: { ...状态.attitude, people: 下一个 } })
      return e('div', null,
        e('div', { className: 'fk-switch-row' }, e('span', { className: 'fk-name' }, '态度'), e(Switch, { on: (状态.manifest && 状态.manifest.modules && 状态.manifest.modules.attitude) !== false, onChange: (v) => 改({ manifest: { ...(状态.manifest || {}), modules: { ...((状态.manifest || {}).modules || {}), attitude: v } } }) })),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' },
            e('input', { className: 'fk-search', style: { width: '50%' }, placeholder: '搜索', value: q, onChange: (ev) => setQ(ev.target.value) })),
          e('div', { className: 'fk-win', style: { maxHeight: 170, marginTop: 8 } },
            列.length === 0 ? e('div', { className: 'fk-note' }, '还没有人，等第一次聊天') : 列.map((p, i) =>
              e('div', { className: 'fk-person', key: p.id },
                e('span', { title: p.name, style: { width: '90px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.name),
                e('span', { className: 'fk-pc', style: { whiteSpace: 'nowrap' } }, '讨厌'),
                e('div', { style: { flex: 1, display: 'flex', alignItems: 'center', gap: 6 } },
                  e('input', { className: 'fk-range', type: 'range', min: 0, max: 100, step: 1, value: p.value, onChange: (ev) => {
                    const v = parseFloat(ev.target.value)
                    存人(人.map((x, j) => (j === i ? { ...x, value: v } : x)))
                  } })),
                e('span', { className: 'fk-pc', style: { whiteSpace: 'nowrap' } }, '喜欢'),
                e('input', { className: 'fk-search fk-num', inputMode: 'numeric', value: p.value, onChange: (ev) => {
                  const t = String(ev.target.value).replace(/[^0-9]/g, '')
                  if (!t) return
                  const v = Math.max(0, Math.min(100, parseInt(t, 10)))
                  存人(人.map((x, j) => (j === i ? { ...x, value: v } : x)))
                } }),
                e('span', { className: 'fk-pc' }, '%'),
                e(Trash, { onClick: () => 存人(人.filter((x, j) => j !== i)) }))))),
        e(Note, null,
          e('div', null, '新人第一次对话进来，初始好感不超过 20%。'),
          e('div', null, '增减克制，会天然回落：高于 15% 时最低 15%，否则最低 5%。')))
    }

    // ── 记忆页 ─────────────────────────────────────────────
    const 记忆页 = ({ 状态, 改 }) => {
      const p = 状态.pinned || {}
      return e('div', null,
        e('div', { className: 'fk-switch-row' }, e('span', { className: 'fk-name' }, '记忆'), e(Switch, { on: (状态.manifest && 状态.manifest.modules && 状态.manifest.modules.memory) !== false, onChange: (v) => 改({ manifest: { ...(状态.manifest || {}), modules: { ...((状态.manifest || {}).modules || {}), memory: v } } }) })),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' },
            e('span', { style: { whiteSpace: 'nowrap' } }, '我是谁：'),
            e('input', { className: 'fk-search', style: { width: '38%' }, defaultValue: p.whoAmI || '', onBlur: (ev) => { if (ev.target.value !== (p.whoAmI || '')) 改({ pinned: { whoAmI: ev.target.value } }) } }),
            e('span', { style: { whiteSpace: 'nowrap' } }, '你是谁：'),
            e('input', { className: 'fk-search', style: { width: '38%' }, defaultValue: p.whoAreYou || '', onBlur: (ev) => { if (ev.target.value !== (p.whoAreYou || '')) 改({ pinned: { whoAreYou: ev.target.value } }) } })),
          e('div', { className: 'fk-row' },
            e('span', { style: { whiteSpace: 'nowrap' } }, '用户背景：'),
            e('input', { className: 'fk-search fk-grow', defaultValue: p.userBio || '', onBlur: (ev) => { if (ev.target.value !== (p.userBio || '')) 改({ pinned: { userBio: ev.target.value } }) } }))),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '初遇：')),
          e('div', { className: 'fk-win fk-w2' }, p.firstMeet || ''),
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '承诺：')),
          e('div', { className: 'fk-win fk-w2' }, p.promise || '')),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-switch-row' },
            e('span', { className: 'fk-name' }, '错题本'),
            e('label', null, e('input', { type: 'checkbox', defaultChecked: true }))),
          e('div', { className: 'fk-win', style: { maxHeight: 110, overflow: 'auto' } },
            (状态.mistakes || []).length === 0
              ? e('div', { className: 'fk-note' }, '（还没有错题）')
              : (状态.mistakes || []).slice(-3).map((m, i) => e('div', { key: i },
                (String(m.time || '').slice(5, 10)) + '　' + (m.title || '') + '　[' + (m.status || '') + ']')))),
        e(Note, null, '她会尝试整理思考过程'),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '摘要：')),
          e('div', { className: 'fk-win fk-w5' },
            (状态.events || []).length === 0 ? '（还没有整理出来的摘要）' : (状态.events || []).slice(-5).map((x, i) => e('div', { key: i }, '· ' + (x.summary || x.text || ''))))),
        e(Note, null, '你做了什么，她都记得'))
    }

    // ── 情绪页 ─────────────────────────────────────────────
    const 情绪页 = ({ 状态, 改 }) => {
      const m = 状态.mood || {}
      const 存 = (补丁) => 改({ mood: { ...m, ...补丁 } })
      return e('div', null,
        e('div', { className: 'fk-switch-row' }, e('span', { className: 'fk-name' }, '情绪'), e(Switch, { on: (状态.manifest && 状态.manifest.modules && 状态.manifest.modules.mood) !== false, onChange: (v) => 改({ manifest: { ...(状态.manifest || {}), modules: { ...((状态.manifest || {}).modules || {}), mood: v } } }) })),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '主情绪词：'), e('span', null, m.emotion || '平静'))),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' },
            e('span', null, '抵触'),
            e(ZeroTrack, null, e(MoodTrack, { value: m.valence ?? 0.3, base: m.baseValence ?? 0.1, onChange: (v) => 存({ valence: v }), disabled: true })),
            e('span', null, '接受'),
            e('span', { className: 'fk-sub' }, '修正速率'), e('input', { className: 'fk-search', style: { width: '56px' }, defaultValue: (m.recovery && m.recovery.valence) ?? 0.3, readOnly: true }),
            e('span', { className: 'fk-sub' }, '阻尼'), e('input', { className: 'fk-search', style: { width: '56px' }, defaultValue: (m.damping && m.damping.valence) ?? 0.6, readOnly: true }))),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' },
            e('span', null, '平静'),
            e(MoodTrack, { value: m.arousal ?? 0.4, base: m.baseArousal ?? 0.2, onChange: (v) => 存({ arousal: v }), disabled: true, min: 0, max: 1 }),
            e('span', null, '激动'),
            e('span', { className: 'fk-sub' }, '修正速率'), e('input', { className: 'fk-search', style: { width: '56px' }, defaultValue: (m.recovery && m.recovery.arousal) ?? 0.2, readOnly: true }),
            e('span', { className: 'fk-sub' }, '阻尼'), e('input', { className: 'fk-search', style: { width: '56px' }, defaultValue: (m.damping && m.damping.arousal) ?? 0.7, readOnly: true }))),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '最近心情：')),
          e('div', { className: 'fk-win', style: { maxHeight: 120, overflow: 'auto' } },
            (状态.moodHistory || []).length === 0
              ? e('div', { className: 'fk-note' }, '还没有记录')
              : (状态.moodHistory || []).slice(0, 5).map((h, i) => e('div', { key: i },
                (String(h.time || '').slice(11, 16)) + '　' + (h.emotion || '') + '（' + Number(h.valence || 0).toFixed(2) + ' / ' + Number(h.arousal || 0).toFixed(2) + '）' + (h.reason ? '　' + String(h.reason).slice(0, 30) : ''))))),
        e(Note, null,
          e('div', null, '修正速率为当前状态随时间向基准线靠近的速率。'),
          e('div', null, '阻尼为情绪走向极端的难度。')))
    }

    // ── 人设页 ─────────────────────────────────────────────
    const 人设页 = ({ 状态, 改, 载入 }) => {
      const [pick, setPick] = useState(1)
      const base = 状态.base || {}
      const dims = 状态.dims || []
      const cur = dims[pick] || dims[0] || {}
      const 存维 = (下一个) => 改({ dims: 下一个 })
      const 改维 = (i, v) => 存维(dims.map((d, j) => (j === i ? { ...d, value: v, manual: true, locked: true } : d)))
      const 锁 = (i) => 存维(dims.map((d, j) => (j === i ? { ...d, locked: !d.locked } : d)))
      return e('div', null,
        e('div', { className: 'fk-switch-row' }, e('span', { className: 'fk-name' }, '人设'), e(Switch, { on: (状态.manifest && 状态.manifest.modules && 状态.manifest.modules.persona) !== false, onChange: (v) => 改({ manifest: { ...(状态.manifest || {}), modules: { ...((状态.manifest || {}).modules || {}), persona: v } } }) })),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '底色'), e('input', { className: 'fk-search fk-grow', defaultValue: base.base || '', onBlur: (ev) => { if (ev.target.value !== (base.base || '')) 改({ base: { base: ev.target.value } }) } })),
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '人设'), e('input', { className: 'fk-search fk-grow', defaultValue: base.persona || '', onBlur: (ev) => { if (ev.target.value !== (base.persona || '')) 改({ base: { persona: ev.target.value } }) } })),
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '补充指令'), e('input', { className: 'fk-search fk-grow', defaultValue: base.instructions || '', onBlur: (ev) => { if (ev.target.value !== (base.instructions || '')) 改({ base: { instructions: ev.target.value } }) } })),
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '回复风格'), e('input', { className: 'fk-search fk-grow', defaultValue: base.style || '', onBlur: (ev) => { if (ev.target.value !== (base.style || '')) 改({ base: { style: ev.target.value } }) } }))),
        e('div', { className: 'fk-flat' },
          e('div', { style: { flex: 2 } },
            e('div', { className: 'fk-win', style: { height: 160, overflow: 'auto' } },
              dims.map((d, i) =>
                e('div', { className: 'fk-dim' + (d.manual ? ' picked' : ''), key: d.key, onClick: () => setPick(i) },
                  e('span', { className: 'fk-lab' }, d.left),
                  e(ZeroTrack, null, e(Range, { value: d.value, onChange: (v) => 改维(i, v), cls: 'fk-line-thumb' })),
                  e('span', { className: 'fk-lab r' }, d.right),
                  e('button', { className: 'fk-lock' + (d.locked ? ' on' : ''), onClick: (ev) => { ev.stopPropagation(); 锁(i) } },
                    e('svg', { width: 13, height: 13, viewBox: '0 0 14 14' },
                      e('rect', { x: 2.5, y: 6.2, width: 9, height: 6.5, rx: 1.5, fill: 'currentColor' }),
                      e('path', { d: d.locked ? 'M4.6 6.2V5a2.4 2.4 0 0 1 4.8 0v1.2' : 'M4.6 6.2V5a2.4 2.4 0 0 1 4.8 0', stroke: 'currentColor', strokeWidth: 1.6, fill: 'none' }))),
                  e('span', { className: 'fk-pct' }, Number(d.value || 0).toFixed(2)))))),
          e('div', { style: { flex: 1 } },
            e('div', { className: 'fk-win', style: { height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } },
              e('div', null,
                e('div', { className: 'fk-doc-title' }, '证据：' + (cur.key || '')),
                e('div', { className: 'fk-note' }, cur.manual ? '好吧，你说了算' : '（自动算的：记忆里几条事撑起来的）'))))),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' },
            e('span', { className: 'fk-name' }, '档案模式'),
            e('span', { className: 'fk-sub' }, 状态.mode === 'shared' ? '共享：所有工作区同一个我' : '独立：每个工作区各一条鱼')),
          e('div', { className: 'fk-row' },
            e('label', null, e('input', { type: 'radio', name: 'fsmode', checked: 状态.mode !== 'shared', onChange: () => {
              void fetch('/dsh-fishsoul/mode', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'independent' }) })
            } }), ' 独立'),
            e('label', { style: { marginLeft: '16px' } }, e('input', { type: 'radio', name: 'fsmode', checked: 状态.mode === 'shared', onChange: () => {
              void fetch('/dsh-fishsoul/mode', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'shared' }) })
            } }), ' 共享'))),
        e(Note, null, '滑块拖到 0 附近会轻轻吸到 0；锁上就不会被演化自动推走。'),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' },
            e('span', { className: 'fk-name' }, '演化记录：'),
            e('span', { className: 'fk-grow' }),
            e('button', { className: 'fk-btn', onClick: () => {
              void fetch('/dsh-fishsoul/digest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
                .then((x) => x.json()).then(() => 载入 && 载入()).catch(() => {})
            } }, '整理')),
          e('div', { className: 'fk-win', style: { maxHeight: 66, overflow: 'auto' } },
            (状态.history || []).length === 0
              ? e('div', { className: 'fk-note' }, '还没有演化记录')
              : (状态.history || []).slice(-3).map((h, i) => e('div', { key: i },
                (h.time || '').slice(0, 10) + '　' + h.key + ' ' + (Number(h.to) >= 0 ? '+' : '') + Number(h.to || 0).toFixed(2) + '（' + (h.reason || '') + '）')))))
    }

    // ── 成长页（2026-11-03）：认知、起点、环境、兴趣、回顾 ──
    // 这一页都是它自己长出来的，不是设出来的，所以只有「看」，没有「改」。
    // 起点和环境指纹不进窗口了（2026-11-03 老大定的）：鱼自己读得到就行，
    // 有人问它「初始怎么设的」，让它自己讲。
    const 成长页 = ({ 状态 }) => {
      const 认 = 状态.cognition || []


      const 兴 = (状态.interests || []).slice().sort((a, b) => Number(b.分 || 0) - Number(a.分 || 0))
      const 回 = 状态.reflection || null
      const 一条 = (键, 左, 右, 值) => e('div', { key: 键, className: 'fk-row' },
        e('span', { className: 'fk-sub' }, 左),
        e(MoodTrack, { value: Number(值) || 0, base: 0, disabled: true, onChange: () => {} }),
        e('span', { className: 'fk-sub' }, 右),
        e('span', { className: 'fk-num' }, Number(值 || 0).toFixed(2)))
      return e('div', null,
        e(Note, null, '这一页是它自己长出来的，改不动，但它会变'),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '脑子怎么转')),
          认.length === 0
            ? e('div', { className: 'fk-note' }, '还没长出来')
            : 认.map((d) => 一条(d.key, d.left, d.right, d.value))),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '兴趣')),
          兴.length === 0
            ? e('div', { className: 'fk-note' }, '还没出门逛过，兴趣还空着')
            : 兴.map((x) => e('div', { key: x.名, className: 'fk-row' },
              e('span', { className: 'fk-sub' }, x.名),
              e(MoodTrack, { value: Number(x.分) || 0, base: 0, disabled: true, onChange: () => {} }),
              e('span', { className: 'fk-num' }, Number(x.分 || 0).toFixed(2)),
              e('span', { className: 'fk-sub' }, Number(x.次数 || 0) + ' 次')))),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '回头看自己')),
          回
            ? e('div', { className: 'fk-win', style: { maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap' } }, 回.正文)
            : e('div', { className: 'fk-note' }, '还没写过回顾')))
    }

    // ── 行为页 ─────────────────────────────────────────────
    const 行为页 = ({ 状态, 改, 载入 }) => {
      const r = 状态.rules || {}
      const idle = r.idle || { enabled: true, idleMinutes: 120, maxPerDay: 2 }
      const [编辑, set编辑] = useState('')
      // 2026-11-04 老大要的：两块规矩改成各一个多行框，一行一条。      //   「群聊规矩 / 其他规矩」这个分法保留；加规矩只要多写一行，不用动代码。
      const 群组 = ['no-politic-scandals', 'repeat-hiss', 'group-five-seconds']
      const 群们 = (r.rules || []).filter((x) => 群组.includes(x.id))
      const 别的们 = (r.rules || []).filter((x) => !群组.includes(x.id))
      const 拼文本 = (列) => (列 || []).map((x) => x.text).join('\n')
      /** 这一块按行切开：能对上的沿用老 id（别把开关丢了），对不上的当新加的 */
      const 存块 = (旧们, 文本) => {
        const 行们 = String(文本 || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        const 旧按文 = new Map((旧们 || []).map((x) => [String(x.text).trim(), x]))
        const 新们 = 行们.map((行, i) => {
          const 命中 = 旧按文.get(行)
          return 命中 ? { ...命中, text: 行 } : { id: '自定-' + Date.now().toString(36) + '-' + i, text: 行, enabled: true }
        })
        // 新加的替回原来的位置，别把顺序打乱
        const 旧id = new Set((旧们 || []).map((x) => x.id))
        let 游标 = 0
        const 合并 = []
        for (const x of (r.rules || [])) {
          if (旧id.has(x.id)) {
            if (游标 < 新们.length) 合并.push(新们[游标++])
          } else 合并.push(x)
        }
        while (游标 < 新们.length) 合并.push(新们[游标++])
        改({ rules: { ...r, rules: 合并 } })
      }
      return e('div', null,
        e('div', { className: 'fk-switch-row' }, e('span', { className: 'fk-name' }, '行为'), e(Switch, { on: (状态.manifest && 状态.manifest.modules && 状态.manifest.modules.behavior) !== false, onChange: (v) => 改({ manifest: { ...(状态.manifest || {}), modules: { ...((状态.manifest || {}).modules || {}), behavior: v } } }) })),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '群聊规矩')),
          e('textarea', {
            className: 'fk-search',
            style: { width: '100%', minHeight: 76, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' },
            defaultValue: 拼文本(群们),
            onBlur: (ev) => 存块(群们, ev.target.value),
          }),
          e('div', { className: 'fk-note', style: { textAlign: 'left' } }, '一行一条')),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '其他规矩')),
          e('textarea', {
            className: 'fk-search',
            style: { width: '100%', minHeight: 76, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' },
            defaultValue: 拼文本(别的们),
            onBlur: (ev) => 存块(别的们, ev.target.value),
          }),
          e('div', { className: 'fk-note', style: { textAlign: 'left' } }, '一行一条')),
        e('div', { className: 'fk-switch-row' }, e('span', { className: 'fk-name' }, '主动找事做'), e(Switch, { on: idle.enabled !== false, onChange: (v) => 改({ rules: { ...r, idle: { ...idle, enabled: v } } }) })),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' },
            e('span', null, '空闲'),
            e('input', { className: 'fk-search', style: { width: '56px', textAlign: 'center' }, inputMode: 'numeric', defaultValue: idle.idleMinutes || 120, onChange: (ev) => {
              const t = String(ev.target.value).replace(/[^0-9]/g, '')
              if (t !== ev.target.value) ev.target.value = t
            }, onBlur: (ev) => {
              const v = Math.max(1, Math.min(1440, parseInt(String(ev.target.value).replace(/[^0-9]/g, '') || '120', 10)))
              改({ rules: { ...r, idle: { ...idle, idleMinutes: v } } })
            } }),
            e('span', null, '分钟后'),
            e('span', null, '每天最多'),
            e('input', { className: 'fk-search', style: { width: '56px', textAlign: 'center' }, inputMode: 'numeric', defaultValue: idle.maxPerDay || 2, onChange: (ev) => {
              const t = String(ev.target.value).replace(/[^0-9]/g, '')
              if (t !== ev.target.value) ev.target.value = t
            }, onBlur: (ev) => {
              const v = Math.max(1, Math.min(50, parseInt(String(ev.target.value).replace(/[^0-9]/g, '') || '2', 10)))
              改({ rules: { ...r, idle: { ...idle, maxPerDay: v } } })
            } }),
            e('span', null, '次')),
          e('div', { className: 'fk-row' },
            e('span', null, '只在谷时启用'),
            e('label', null, e('input', { type: 'checkbox', checked: idle.valleyOnly === true, onChange: (ev) => {
              改({ rules: { ...r, idle: { ...idle, valleyOnly: ev.target.checked } } })
            } }))),
          // 每个会话：开不开「主动找事做」＋出门的方向（2026-11-04 加了开关、限高五行）
          e('div', { className: 'fk-row', style: { marginTop: 6 } }, e('span', { className: 'fk-name' }, '每个会话的主动找事做')),
          (状态.会话们 || []).length === 0
            ? e('div', { className: 'fk-note' }, '还没见过活着的会话')
            // ⚠ 限高：一屏只露五行，多了在框里滚（老大 2026-11-04 要的）
            : e('div', { className: 'fk-win', style: { maxHeight: 5 * 34, overflowY: 'auto' } },
              (状态.会话们 || []).map((s) => e('div', { key: s.id, className: 'fk-row' },
                e(Switch, {
                  on: s.开着 !== false,
                  onChange: (v) => {
                    void fetch('/dsh-fishsoul/sessions/toggle', {
                      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: s.id, 开着: v }),
                    }).then((r) => r.json()).then((d) => { if (d.ok) { if (载入) 载入() } }).catch(() => {})
                  },
                }),
                e('span', { className: 'fk-grow', title: s.id }, (s.名 && s.名 !== s.id.slice(-6)) ? s.名 : ('会话 ' + String(s.id).slice(-6))),
                // 注释固定在下拉左边、留恒定宽度：切换选项时下拉不会左右跳
                e('span', {
                  className: 'fk-sub',
                  style: { width: 132, textAlign: 'right', visibility: s.方向 === '跟随全局' ? 'visible' : 'hidden' },
                }, '（听平台账号那边勾的）'),
                e('select', {
                  className: 'fk-search',
                  defaultValue: s.方向 || '跟随全局',
                  onChange: (ev) => {
                    void fetch('/dsh-fishsoul/sessions/set', {
                      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: s.id, 方向: ev.target.value }),
                    }).then((r) => r.json()).then((d) => { if (d.ok) { if (载入) 载入() } }).catch(() => {})
                  },
                },
                  ['无', '跟随全局', ...(状态.平台名 || [])].map((o) => e('option', { key: o, value: o }, o))))))),
        e(Note, null, '闲着的时候自己翻翻记忆、想想话题；说「安静」就停。'),
        // 平台账号（2026-11-03）：看登着谁、能删；左边勾上的才允许主动去用
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' },
            e('span', { className: 'fk-name' }, '平台账号'),
            // 2026-11-04：右边加个按钮，点开是「添加账号」子窗口（选平台 → 查依赖 → 装）
            e('button', {
              className: 'fk-btn',
              style: { marginLeft: 'auto' },
              onClick: () => {
                if (!加号) {
                  void fetch('/dsh-fishsoul/platforms').then((r) => r.json()).then((d) => { if (d && d.ok) set平台表(d.平台们 || []) }).catch(() => {})
                }
                set加号(!加号)
              },
            }, 加号 ? '收起' : '+ 添加账号')),
          加号 ? e(添加账号窗, { 平台表, 关掉: () => set加号(false) }) : null,
          (状态.账号们 || []).length === 0
            ? e('div', { className: 'fk-note' }, '还没认出任何平台')
            : (状态.账号们 || []).map((a) => e('div', { key: a.平台, className: 'fk-row' },
              e(Switch, {
                on: a.允许 !== false,
                onChange: (v) => {
                  void fetch('/dsh-fishsoul/accounts/toggle', {
                    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ 平台: a.平台, 允许: v }),
                  }).then((r) => r.json()).then((d) => { if (d.ok && 载入) 载入() }).catch(() => {})
                },
              }),
              e('span', { className: 'fk-sub', style: { minWidth: 46 } }, a.平台),
              e('span', { className: 'fk-sub', style: { minWidth: 58 } }, '能评论'),
              e(Switch, {
                on: a.允许评论 === true,
                onChange: (v) => {
                  void fetch('/dsh-fishsoul/accounts/comment', {
                    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ 平台: a.平台, 允许: v }),
                  }).then((r) => r.json()).then((d) => { if (d.ok && 载入) 载入() }).catch(() => {})
                },
              }),
              e('span', { className: 'fk-grow', title: a.标识 || '' },
                (a.昵称 ? a.昵称 + '　' : ''),
                e('span', {
                  style: {
                    color: a.有效 === 1 ? '#3fa34d' : '#d04040', // 已验证绿；未验证 / 失效红
                    fontWeight: 600,
                  },
                }, a.状态 || '未验证')),
              a.已登录
                ? e('button', {
                    className: 'fk-btn', title: '联网看看这个账号还能不能用', onClick: (ev) => {
                      const 旧 = ev.target.textContent
                      ev.target.textContent = '验证中…'
                      void fetch('/dsh-fishsoul/accounts/verify', {
                        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ 平台: a.平台 }),
                      }).then((r) => r.json()).then((d) => {
                        ev.target.textContent = 旧
                        window.alert(d.ok
                          ? ('✅ ' + a.平台 + '：' + (d.昵称 || '') + '，' + (d.说 || '能用') + '\n（刷新一下就能看到新昵称）')
                          : ('⚠ ' + (d.说 || '验证不了')))
                      }).catch((e) => { ev.target.textContent = 旧; window.alert('⚠ ' + String(e)) })
                    },
                  }, '验证')
                : null,
              a.已登录
                ? e('button', {
                    className: 'fk-btn', title: '把这个平台的登录删掉', onClick: () => {
                      if (!window.confirm('真的删掉「' + a.平台 + '」的登录吗？删了要重新扫码。')) return
                      void fetch('/dsh-fishsoul/accounts/delete', {
                        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ 平台: a.平台 }),
                      }).then((r) => r.json()).then(() => { if (载入) 载入() }).catch(() => {})
                    },
                  }, '删除')
                : null))),
        e(Note, null, '只有勾上的平台才允许主动去做；删掉只清那边的登录凭证，别的不动。'),
        // 搬旧数据（2026-11-04）：插件不认格式表，只把一条指令递给它，让它自己扫、自己列预览
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '搬旧数据')),
          e('div', { className: 'fk-note', style: { textAlign: 'left' } },
            '从别的插件搬记忆 / 人设 / 心情过来。它会先扫一遍、列给你看，你说可以才写。'),
          e('div', { className: 'fk-row' },
            e('button', {
              className: 'fk-btn',
              onClick: (ev) => {
                const 旧 = ev.target.textContent
                ev.target.textContent = '跟它说…'
                void fetch('/dsh-fishsoul/migrate/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
                  .then((r) => r.json()).then((d) => {
                    ev.target.textContent = 旧
                    window.alert(d.ok ? ('✅ ' + (d.说 || '说了')) : ('⚠ ' + (d.说 || '没发出去')))
                  }).catch((e2) => { ev.target.textContent = 旧; window.alert('⚠ ' + String(e2)) })
              },
            }, '让它去搬')),
          e('div', { className: 'fk-note', style: { textAlign: 'left' } },
            '只读旧文件、只追加不覆盖、密码令牌这类不搬。')))
    }

    // ── 更新历史页 ─────────────────────────────────────────
    const 更新页 = ({ 备份信息 }) => {
      const [记录, set记录] = useState('')
      useEffect(() => {
        void fetch('/dsh-fishsoul/changelog').then((r) => r.json()).then((d) => { if (d && d.ok) set记录(String(d.文 || '')) }).catch(() => {})
      }, [])
      const 正文 = 记录.replace(/^# .*\n+/, '').trim().replace(/^## /, '')
      const 段 = 正文.split(/\n## /).filter(Boolean).map((x) => x.trim())
      return e('div', null,
        e('div', { className: 'fk-doc-title', style: { margin: '2px 0 8px' } }, '更新历史'),
        e('div', { className: 'fk-repo' }, REPO),
        e('div', { className: 'fk-win', style: { maxHeight: 300, overflow: 'auto' } },
          段.length === 0
            ? e('div', { className: 'fk-note' }, '还没有更新记录')
            : 段.map((x, i) => e('div', { className: 'fk-card', key: i, style: { marginBottom: 8 } },
              e('div', { className: 'fk-doc-title' }, 'v' + x.split(' · ')[0].replace(/^v/, '')),
              e('span', { className: 'fk-sub' }, '　' + String(x.split(' · ')[1] || '').split('\n')[0]),
              e('div', { className: 'fk-note', style: { textAlign: 'left', margin: '6px 0 0' } },
                x.split('\n').slice(1).filter((l) => l.startsWith('- ')).map((l) => l.slice(2)).join('；'))))),
        e(Note, null, '图纸放 Git 仓库，插件里只留目录。'),
        e('div', { className: 'fk-say' }, 备份信息 || ''))
    }

    // ── 添加账号（子窗口）──────────────────────────────────
    // 2026-11-04 老大定的：平台账号那一行加个按钮，点开先选平台，
    //   选完再当场看那套库在不在（库不进包，只在这里按需装）。
    function 添加账号窗({ 平台表, 关掉 }) {
      const [选, set选] = useState('')
      const [检查, set检查] = useState(null)
      const [说, set说] = useState('')
      const [忙, set忙] = useState(false)
      const [装中, set装中] = useState(false)
      const [转数, set转数] = useState(0)
      const 此 = (平台表 || []).find((x) => x.名 === 选) || null

      const 查某个 = (名, 安静) => {
        if (!名) return
        if (!安静) { set忙(true); set说('在查…') }
        void fetch('/dsh-fishsoul/platforms/check', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ 平台: 名 }),
        }).then((r) => r.json()).then((d) => {
          set检查(d)
          if (!安静) set说(d.已装 ? '这套库在机器上，能动' : (d.说 || '还没装'))
        }).catch((error) => { if (!安静) set说('查不了：' + String(error)) }).finally(() => { if (!安静) set忙(false) })
      }

      // 装是后台跑的，这里每 2.5 秒问一次，问到「好了 / 失败了」就停
      useEffect(() => {
        if (!装中 || !选) return
        let 活 = true
        const 轮 = () => {
          void fetch('/dsh-fishsoul/platforms/check', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ 平台: 选 }),
          }).then((r) => r.json()).then((d) => {
            if (!活) return
            set检查(d)
            if (d.已装) { set装中(false); set说('装好了') }
            else if (d.装 && d.装.状态 === '失败') { set装中(false); set说('装失败了：' + (d.装.说 || '去看日志')) }
            else set转数((n) => n + 1)
          }).catch(() => {})
        }
        const t = setInterval(轮, 2500)
        return () => { 活 = false; clearInterval(t) }
      }, [装中, 选])

      // 转太久就收手，别让它一直转
      useEffect(() => {
        if (装中 && 转数 > 240) { set装中(false); set说('等太久了，去看看日志吧') }
      }, [转数, 装中])

      const 装 = () => {
        if (!此 || 装中) return
        set忙(true)
        void fetch('/dsh-fishsoul/platforms/install', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ 平台: 此.名 }),
        }).then((r) => r.json()).then((d) => {
          set说(d.说 || '开始装了')
          set转数(0)
          set装中(true)
        }).catch(() => set说('没发出去')).finally(() => set忙(false))
      }

      // 四种状态：未安装 / 正在安装 / 安装失败 / 已安装
      const 态 = 装中 ? '正在安装'
        : !检查 ? '未安装'
        : 检查.已装 ? '已安装'
        : (检查.装 && 检查.装.状态 === '失败') ? '安装失败'
        : '未安装'
      const 态色 = 态 === '已安装' ? '#3fa34d' : 态 === '正在安装' ? '#c9963a' : 态 === '安装失败' ? '#d04040' : 'inherit'

      return e('div', { className: 'fk-win', style: { marginTop: 8 } },
        e('div', { className: 'fk-row' },
          e('span', { className: 'fk-name' }, '添加账号'),
          e('button', { className: 'fk-btn', style: { marginLeft: 'auto' }, onClick: 关掉 }, '收起来')),
        e('div', { className: 'fk-row' },
          e('span', { className: 'fk-sub' }, '平台'),
          e('select', {
            className: 'fk-search',
            defaultValue: '',
            onChange: (ev) => {
              const v = ev.target.value
              set选(v)
              set检查(null)
              set说('')
              if (v) 查某个(v)
            },
          },
            e('option', { value: '' }, '选一个'),
            (平台表 || []).map((p) => e('option', { key: p.名, value: p.名 }, p.名)))),
        此
          ? e('div', null,
            e('div', { className: 'fk-note', style: { textAlign: 'left' } }, 此.能干 || ''),
            e('div', { className: 'fk-sub', style: { textAlign: 'left' } },
              '用 ' + 此.包 + '（' + 此.作者 + ' · ' + 此.许可 + '）'),
            e('div', { className: 'fk-sub', style: { textAlign: 'left', wordBreak: 'break-all' } }, 此.仓库),
            // 依赖获取状态（2026-11-04）：未安装 / 正在安装 / 安装失败 / 已安装
            e('div', { className: 'fk-row' },
              e('span', { className: 'fk-sub' }, '依赖'),
              e('span', { style: { color: 态色, fontWeight: 600 } }, 态)),
            e('div', { className: 'fk-row' },
              e('button', { className: 'fk-btn', disabled: 忙 || 装中, onClick: () => 查某个(选) }, '检查依赖'),
              e('button', { className: 'fk-btn', disabled: 忙 || 装中 || (检查 && 检查.已装 === true), onClick: 装 }, 装中 ? '正在安装…' : '装一下')),
            e('div', { className: 'fk-note', style: { textAlign: 'left' } }, 说))
          : e('div', { className: 'fk-note' }, '先选个平台吧'))
    }

    // ── 设置页 ─────────────────────────────────────────────
    function FishSoulSettings() {
      const [page, setPage] = useState(0)
      const [状态, set状态] = useState(null)
      const [错, set错] = useState(null)
      const [备份信息, set备份信息] = useState('')
      const [更新信息, set更新信息] = useState('')
      const [加号, set加号] = useState(false)
      const [平台表, set平台表] = useState([])
      const 防抖 = use保存()

      useEffect(() => {
        let 活 = true
        void 拉状态().then((d) => { if (活 && d && d.ok !== false) set状态(d) }).catch((error) => { if (活) set错(String(error)) })
        return () => { 活 = false }
      }, [])

      const 改 = (补丁) => {
        set状态((旧) => {
          const 新 = { ...(旧 || {}) }
          for (const [键, 值] of Object.entries(补丁 || {})) {
            const 是对象 = 值 && typeof 值 === 'object' && !Array.isArray(值)
            const 旧对象 = 新[键] && typeof 新[键] === 'object' && !Array.isArray(新[键])
            if (是对象 && 旧对象) 新[键] = { ...新[键], ...值 }
            else 新[键] = 值
          }
          return 新
        })
        防抖(补丁)
      }

      const 备份 = () => {
        set备份信息('正在备份…')
        void fetch('/dsh-fishsoul/backup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
          .then((r) => r.json())
          .then((d) => set备份信息(d.ok ? '✅ ' + (d.说 || '备份好了') : '⚠ ' + (d.说 || '备份失败')))
          .catch((error) => set备份信息('⚠ 备份失败：' + String(error)))
      }

      return e('div', { className: 'fk-wrap' },
        e('div', { className: 'fk-top' },
          e('span', { className: 'fk-brand' }, '小肥鱼 · 人格'),
          e('span', { className: 'fk-ver' }, 'v' + ((状态 && 状态.版本) || VERSION)),
          e('span', { className: 'fk-grow' }),
          e('button', { className: 'fk-btn', onClick: 备份, title: '把当前档案备份一份（带校验码）' }, '备份'),
          e('button', { className: 'fk-btn', onClick: () => {
            set更新信息('正在检查…')
            void fetch('/dsh-fishsoul/update').then((r) => r.json()).then((d) => {
              if (!d.ok) return set更新信息('检查失败')
              if (d.有新版本) return set更新信息('有新版本：' + d.最新 + '（' + d.仓库 + '）')
              set更新信息(d.错误 ? ('暂时查不到新版本：' + d.错误) : ('已经是最新的 v' + d.当前))
            }).catch((error) => set更新信息('检查失败：' + String(error)))
          } }, '检查更新'),
          e('button', { className: 'fk-btn', onClick: () => {
            set更新信息('正在更新…')
            void fetch('/dsh-fishsoul/update/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
              .then((r) => r.json())
              .then((d) => set更新信息(d.ok ? '✅ ' + (d.说 || '更新完成') : '⚠ ' + (d.说 || '更新失败')))
              .catch((error) => set更新信息('更新失败：' + String(error)))
          } }, '更新')),
        (更新信息 || 错 || !状态) ? e('div', { className: 'fk-badge' }, e('span', { className: 'fk-note' }, 更新信息 || (错 ? '档案没连上：' + 错 : '正在读档案…'))) : null,
        e('div', { className: 'fk-tabs' },
          PAGES.map((p, i) => e('button', { key: p, className: 'fk-tab' + (i === page ? ' active' : ''), onClick: () => setPage(i) }, p))),
        !状态
          ? e('div', { className: 'fk-card' }, e('div', { className: 'fk-note' }, '正在读档案…'))
          : e('div', null,
            page === 0 && e(态度页, { 状态, 改 }),
            page === 1 && e(记忆页, { 状态, 改 }),
            page === 2 && e(情绪页, { 状态, 改 }),
            page === 3 && e(人设页, { 状态, 改, 载入: () => { void 拉状态().then((d) => { if (d && d.ok !== false) set状态(d) }).catch(() => {}) } }),
            page === 4 && e(成长页, { 状态 }),
            page === 5 && e(行为页, { 状态, 改, 载入: () => { void 拉状态().then((d) => { if (d && d.ok !== false) set状态(d) }).catch(() => {}) } }),
            page === 6 && e(更新页, { 备份信息 })))
    }

    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-fishsoul', '1')
        style.textContent = CSS
        document.head.appendChild(style)
        return () => {
          try { style.remove() } catch (error) {}
        }
      }, 'dsh-fishkit: settings styles')

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'fishsoul-settings',
        order: 60,
        label: () => '小肥鱼',
      }, FishSoulSettings))
    }

    const inject = ['slots']
    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
