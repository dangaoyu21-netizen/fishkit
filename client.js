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

    const PAGES = ['态度', '记忆', '情绪', '人设', '行为', '更新历史']

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
                e('input', { className: 'fk-search fk-num', inputMode: 'numeric', defaultValue: p.value, onChange: (ev) => {
                  const 干净 = ev.target.value.replace(/[^0-9]/g, '')
                  if (干净 !== ev.target.value) ev.target.value = 干净
                }, onBlur: (ev) => {
                  const v = Math.max(0, Math.min(100, parseInt(ev.target.value || '0', 10)))
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
            e('input', { className: 'fk-search', style: { width: '38%' }, defaultValue: p.whoAreYou || '', onBlur: (ev) => { if (ev.target.value !== (p.whoAreYou || '')) 改({ pinned: { whoAreYou: ev.target.value } }) } }))),
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
              : (状态.moodHistory || []).slice(-5).map((h, i) => e('div', { key: i },
                (String(h.time || '').slice(11, 16)) + '　' + (h.emotion || '') + '（' + Number(h.valence || 0).toFixed(2) + ' / ' + Number(h.arousal || 0).toFixed(2) + '）' + (h.reason ? '　' + h.reason : ''))))),
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
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '补充指令'), e('input', { className: 'fk-search fk-grow', defaultValue: base.instructions || '', onBlur: (ev) => { if (ev.target.value !== (base.instructions || '')) 改({ base: { instructions: ev.target.value } }) } }))),
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

    // ── 行为页 ─────────────────────────────────────────────
    const 行为页 = ({ 状态, 改 }) => {
      const r = 状态.rules || {}
      const idle = r.idle || { enabled: true, idleMinutes: 120, maxPerDay: 2 }
      return e('div', null,
        e('div', { className: 'fk-switch-row' }, e('span', { className: 'fk-name' }, '行为'), e(Switch, { on: (状态.manifest && 状态.manifest.modules && 状态.manifest.modules.behavior) !== false, onChange: (v) => 改({ manifest: { ...(状态.manifest || {}), modules: { ...((状态.manifest || {}).modules || {}), behavior: v } } }) })),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '群聊规矩')),
          e('div', { className: 'fk-win', style: { maxHeight: 150, overflow: 'auto' } },
            (r.rules || []).filter((x) => ['no-politic-scandals', 'repeat-hiss', 'group-five-seconds'].includes(x.id))
              .map((x) => e('div', { key: x.id }, '· ' + x.text)))),
        e('div', { className: 'fk-card' },
          e('div', { className: 'fk-row' }, e('span', { className: 'fk-name' }, '其他规矩')),
          e('div', { className: 'fk-win', style: { maxHeight: 100, overflow: 'auto' } },
            (r.rules || []).filter((x) => !['no-politic-scandals', 'repeat-hiss', 'group-five-seconds'].includes(x.id))
              .map((x) => e('div', { key: x.id }, '· ' + x.text)))),
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
            } })))),
        e(Note, null, '闲着的时候自己翻翻记忆、想想话题；说「安静」就停。'))
    }

    // ── 更新历史页 ─────────────────────────────────────────
    const 更新页 = ({ 备份信息 }) => e('div', null,
      e('div', { className: 'fk-repo' }, REPO),
      e('div', { className: 'fk-win', style: { maxHeight: 260, overflow: 'auto' } },
        e('div', { className: 'fk-card', style: { marginBottom: 8 } },
          e('span', { className: 'fk-doc-title' }, 'v0.1'), e('span', { className: 'fk-sub' }, '　2026-10-31'))),
      e(Note, null, '图纸放 Git 仓库，插件里只留目录。'),
      e('div', { className: 'fk-say' }, 备份信息 || ''))

    // ── 设置页 ─────────────────────────────────────────────
    function FishSoulSettings() {
      const [page, setPage] = useState(0)
      const [状态, set状态] = useState(null)
      const [错, set错] = useState(null)
      const [备份信息, set备份信息] = useState('')
      const [更新信息, set更新信息] = useState('')
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
          e('span', { className: 'fk-ver' }, 'v' + VERSION),
          e('span', { className: 'fk-ver' }, '档案格式 v' + SCHEMA),
          e('span', { className: 'fk-grow' }),
          e('button', { className: 'fk-btn', onClick: 备份, title: '把当前档案备份一份（带校验码）' }, '备份'),
          e('button', { className: 'fk-btn', onClick: () => {
            set更新信息('正在检查…')
            void fetch('/dsh-fishsoul/update').then((r) => r.json()).then((d) => {
              if (!d.ok) return set更新信息('检查失败')
              if (d.有新版本) return set更新信息('有新版本：' + d.最新 + '（' + d.仓库 + '）')
              set更新信息(d.错误 ? ('暂时查不到新版本：' + d.错误) : ('已经是最新的 v' + d.当前))
            }).catch((error) => set更新信息('检查失败：' + String(error)))
          } }, '检查更新')),
        e('div', { className: 'fk-badge' }, e('span', { className: 'fk-note' }, 更新信息 || (错 ? '档案没连上：' + 错 : (!状态 ? '正在读档案…' : '（没有新版本时这里留空）')))),
        e('div', { className: 'fk-tabs' },
          PAGES.map((p, i) => e('button', { key: p, className: 'fk-tab' + (i === page ? ' active' : ''), onClick: () => setPage(i) }, p))),
        !状态
          ? e('div', { className: 'fk-card' }, e('div', { className: 'fk-note' }, '正在读档案…'))
          : e('div', null,
            page === 0 && e(态度页, { 状态, 改 }),
            page === 1 && e(记忆页, { 状态, 改 }),
            page === 2 && e(情绪页, { 状态, 改 }),
            page === 3 && e(人设页, { 状态, 改, 载入: () => { void 拉状态().then((d) => { if (d && d.ok !== false) set状态(d) }).catch(() => {}) } }),
            page === 4 && e(行为页, { 状态, 改 }),
            page === 5 && e(更新页, { 备份信息 })))
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
