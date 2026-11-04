// 小肥鱼 · 记忆检索（开发板）
//
// 2026-11-03 老大点的：新小鱼可能只装鱼缸一个，记忆得自己扛。
// 所以不能再「把最近几条摆出来」，得按他这句话去找对得上的那条。
//
// 打分三样相乘：
//   ① 词重叠 —— 中文按两字滑窗切，英文数字按空格；到处都是的词（老大、插件）权重低
//   ② 时间衰减 —— 30 天减半，旧事慢慢淡
//   ③ 情绪权重 —— 当时情绪越重（weight 越大）越容易想起来
//
// 全是本地算，不调模型。
//
// ⚠️ 开发板：先在这里长，验过才合回主插件。

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const 版本 = '0.1.0'
/** 记忆多久减半（天） */
export const 半衰天数 = 30
/** 注入里最多带几条 */
export const 默认条数 = 6

const 读行 = (路径) => {
  try {
    if (!existsSync(路径)) return []
    return readFileSync(路径, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
      try { return JSON.parse(l) } catch (error) { return null }
    }).filter(Boolean)
  } catch (error) {
    return []
  }
}

/** 要不要跳过这两个字（语气词、连词之类，拿来比没意义） */
const 空字 = new Set(['的', '了', '是', '在', '和', '就', '都', '也', '我', '你', '他', '她', '这', '那', '有', '不', '吗', '呢', '啊', '呀', '吧', '嘛', '哦', '嗯', '哈'])

/**
 * 同义组：一组词当同一个东西看 —— 你说「假报」，我记的是「谎报」，也得对上。
 * 每条是一个意思下的几种说法，命中任意一个就归到第一项。
 * 2026-11-04：从 12 组扩到 50 组。
 */
export const 同义组 = [
  ['重启', '重起', '重开', '重新启动'],
  ['假报', '谎报', '报假', '糊弄', '骗人', '假成功'],
  ['备份', '存档', '留一份', '备份好'],
  ['合并', '合回', '并回', '并进'],
  ['开发板', 'dev', '隔离板'],
  ['错题', '教训', '踩坑', '摔过'],
  ['记忆', '记得', '记住', '想起来'],
  ['心情', '情绪', '感觉', '脾气'],
  ['验证', '检验', '查一遍', '验一遍'],
  ['账号', '登陆', '登录', '凭证'],
  ['兴趣', '喜欢', '来劲', '爱看'],
  ['插件', '扩展', '模块'],
  ['桥', '桥接', 'qq桥', '转接'],
  ['设置页', '设置', '配置页'],
  ['群聊', '群里', '群消息'],
  ['私聊', '单聊', '私信'],
  ['出门', '逛逛', '出去逛', '刷'],
  ['评论', '留言', '回帖'],
  ['字幕', '文字稿', '文案'],
  ['视频', '片子', '一条片'],
  ['安装', '装上', '装好', '部署'],
  ['卸载', '卸掉', '删掉', '移除'],
  ['报错', '出错', '挂了', '坏了'],
  ['沙箱', '隔离', '权限'],
  ['定时', '计划任务', '到点'],
  ['端口', '口子', '接口地址'],
  ['昵称', '名字', '网名'],
  ['人设', '画像', '性格'],
  ['好感', '亲密度', '喜欢程度'],
  ['撒娇', '黏人', '软乎乎'],
  ['生气', '哈气', '发脾气'],
  ['睡觉', '睡了', '休息'],
  ['吃饭', '饭饭', '干饭'],
  ['下雨', '淋雨', '雨天'],
  ['上班', '工作', '干活'],
  ['堵车', '堵路', '路上'],
  ['翻译', '转写', '识别'],
  ['文件', '文档', '路径'],
  ['代码', '脚本', '程序'],
  ['测试', '跑测试', '验一遍'],
  ['发布', '上线', '发了'],
  ['更新', '升级', '新版'],
  ['规矩', '规则', '约定'],
  ['称呼', '叫法', '怎么叫'],
  ['笔记', '记下来', '记笔记'],
  ['话题', '聊天内容', '聊什么'],
  ['依赖库', '依赖', '库'],
  ['子窗口', '弹窗', '小窗口'],
  ['扫码', '二维码', '扫一扫'],
  ['五行', '限高', '高度'],
]

/**
 * 同音组（2026-11-04）：打错字、听错音，按同一个字看 —— 桥/乔、修/休。
 * 只放「真的容易混」的字，别乱塞，塞多了全是误伤。
 */
export const 同音组 = [
  ['桥', '乔'],
  ['修', '休'],
  ['重', '冲'],
  ['置', '至'],
  ['验', '眼'],
  ['件', '建'],
  ['启', '起'],
  ['换', '唤'],
  ['读', '独'],
  ['写', '些'],
  ['报', '抱'],
  ['备', '被'],
  ['合', '和'],
  ['并', '病'],
  ['盘', '判'],
  ['题', '提'],
]

/** 两个字是不是同音（在同一条同音组里） */
export function 是同音(a, b) {
  if (a === b) return true
  for (const 组 of 同音组) if (组.includes(a) && 组.includes(b)) return true
  return false
}

/**
 * 骨架：一个词删掉任意一个字之后剩下的样子。
 * 「重修」→ 重 / 修；「重新」→ 重 / 新 —— 撞在「重」上，就说明它俩只差一个字。
 * 只在 2~4 字上做，太长的词这么比没意义。
 */
export function 骨架(词) {
  const 净 = String(词 || '')
  if (净.length < 2 || 净.length > 4) return []
  const 出 = []
  for (let i = 0; i < 净.length; i++) 出.push(净.slice(0, i) + 净.slice(i + 1))
  return 出
}

/**
 * 两个词「只差一个字」有多可信：全同音的高一点（修/休），普通错字低一点。
 * 返回 0 表示不算像。
 */
export function 近似权重(a, b) {
  const 甲 = String(a || '')
  const 乙 = String(b || '')
  if (!甲 || !乙 || 甲 === 乙) return 0
  if (甲.length !== 乙.length) return 0.6
  let 全同音 = true
  for (let i = 0; i < 甲.length; i++) {
    if (甲[i] !== 乙[i] && !是同音(甲[i], 乙[i])) { 全同音 = false; break }
  }
  return 全同音 ? 0.85 : 0.6
}

/** 把一个词归到同义组里（不在组里就原样返回） */
export const 归组 = (词) => {  const 净 = String(词 || '')
  if (!净) return 净
  for (const 组 of 同义组) {
    for (const 说 of 组) {
      if (净 === 说 || 净.includes(说) || 说.includes(净)) return '同:' + 组[0]
    }
  }
  return 净
}


/**
 * 把一句话拆成能比的词。
 * 中文按两字滑窗（「今天天气」→ 今天 / 天天 / 天气），英文数字按空格切。
 */
export function 拆词(文) {
  const 净 = String(文 || '').toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' ')
  const 词们 = new Set()
  // 英文 / 数字（必须带英文字母，纯中文串交给下面的滑窗）
  for (const w of 净.split(/\s+/)) if (w && w.length >= 2 && /[a-z]/.test(w)) 词们.add(w)
  // 中文两字滑窗
  const 汉字串 = (净.match(/[\u4e00-\u9fa5]+/g) || [])
  for (const 串 of 汉字串) {
    for (let i = 0; i + 2 <= 串.length; i++) {
      const 两字 = 串.slice(i, i + 2)
      if (!空字.has(两字[0]) && !空字.has(两字[1])) 词们.add(两字)
    }
    if (串.length === 1 && !空字.has(串)) 词们.add(串)
  }
  return [...词们].map(归组)
}

/**
 * 建一个检索器。
 * @param {object} 选项 { 根, 记账 }
 */
export function 建检索(选项 = {}) {
  const 根 = String(选项.根 || '')
  const 记账 = typeof 选项.记账 === 'function' ? 选项.记账 : () => {}
  const 事件路径 = 根 ? join(根, 'memory', 'events.jsonl') : ''

  /** 全部事件（最多取最后这么多条，别让文件大到卡住） */
  const 全部 = (上限 = 3000) => {
    const 行们 = 读行(事件路径)
    return 行们.length > 上限 ? 行们.slice(-上限) : 行们
  }

  /**
   * 错题本也一起翻（2026-11-03）：
   * 「重启假报」这种摔过的事记在 mistakes.jsonl 里，不在事件簿子里，
   * 光搜事件永远翻不到 —— 所以把它们折成伪事件一起打分。
   */
  const 错题们 = () => {
    if (!根) return []
    return 读行(join(根, 'memory', 'mistakes.jsonl')).map((m) => ({
      time: String(m.time || ''),
      summary: [m.title, m.symptom, m.fix, m.lesson].filter(Boolean).join('｜'),
      谁: '自己',
      who: { type: 'person', id: 'me', name: '自己' },
      weight: m.kind === 'improve' ? 0.5 : 0.9,
      tags: ['错题'].concat(m.status ? [String(m.status)] : []),
      _错题: true,
    }))
  }

  /** 每个词在簿子里出现过多少次 —— 到处都是的词该降权 */
  const 词频 = (们) => {
    const 计 = new Map()
    for (const e of 们) {
      const 文 = String((e && e.summary) || '')
      if (!文) continue
      for (const 词 of 拆词(文)) 计.set(词, (计.get(词) || 0) + 1)
    }
    return 计
  }

  const 关键词路径 = 根 ? join(根, 'memory', 'keywords.jsonl') : ''

  /**
   * 最近几晚抽出来的关键词（2026-11-04）。
   * 晚上整理时把当天的热词存下来，白天检索命中就翻倍 —— 让「最近在聊什么」有分量。
   */
  const 最近关键词 = (天数 = 7) => {
    const 集 = new Set()
    if (!关键词路径) return 集
    for (const 行 of 读行(关键词路径).slice(-Math.max(1, Number(天数) || 7))) {
      for (const w of (Array.isArray(行.词们) ? 行.词们 : [])) {
        const 净 = String(w || '')
        if (净) 集.add(净)
      }
    }
    return 集
  }

  /** 骨架索引：删一个字之后的样子 → 一个词。懒建，簿子变了才重建。 */
  let 骨架表 = null
  let 骨架戳 = ''
  const 建骨架表 = (们) => {
    const 戳 = 们.length + '|' + String(((们[们.length - 1] || {}).time) || '')
    if (骨架表 && 骨架戳 === 戳) return 骨架表
    const 表 = new Map()
    for (const e of 们) {
      const 文 = String((e && e.summary) || '')
      if (!文) continue
      for (const 词 of new Set(拆词(文))) {
        for (const 骨 of 骨架(词)) if (!表.has(骨)) 表.set(骨, 词)
      }
    }
    骨架表 = 表
    骨架戳 = 戳
    return 表
  }


  /**
   * 按一句话找最对得上的几条。
   * @param {string} 线索 他说的话
   * @param {object} 参数 { 条数, 现在 }
   */
  const 找 = (线索, 参数 = {}) => {
    if (!根) return []
    const 事件们 = 全部()
    const 们 = 事件们.concat(错题们()) // 错题也当候选
    if (!们.length) return []
    const 条数 = Math.max(1, Number(参数.条数) || 默认条数)
    const 现在 = Number(参数.现在) || Date.now()
    const 频 = 词频(事件们)
    const 关键词集 = 最近关键词()
    const 骨表 = 建骨架表(们)
    const 线索词 = 拆词(线索)
    if (!线索词.length) return []

    const 打分 = []
    for (const e of 们) {
      const 文 = String((e && e.summary) || '')
      if (!文) continue
      const 事件词 = new Set(拆词(文))
      let 重叠 = 0
      for (const 词 of 线索词) {
        if (!事件词.has(词)) continue
        // 到处都是的词（老大、插件）给个小权重，稀有的词更有辨识度
        const 次 = 频.get(词) || 1
        重叠 += 1 / Math.log(2 + 次)
      }
      // 2026-11-03 增强：标签命中单独加分（标签是我自己打的，比正文准）
      let 标签分 = 0
      for (const t of (Array.isArray(e.tags) ? e.tags : [])) {
        const 净 = String(t || '').trim()
        if (净 && String(线索).includes(净)) 标签分 += 0.6
      }
      // 整句相似度：线索词里有多少比例在事件里出现过（Jaccard 的简化版）
      let 相似 = 0
      if (事件词.size && 线索词.length) {
        let 同 = 0
        for (const 词 of 线索词) if (事件词.has(词)) 同 += 1
        相似 = 同 / Math.max(事件词.size, 线索词.length)
      }
      // 2026-11-04：错一个字也认（「重修」对「重新」）—— 拿删字骨架去撞
      let 近似 = 0
      for (const 词 of 线索词) {
        if (事件词.has(词)) continue
        for (const 骨 of 骨架(词)) {
          const 友 = 骨表.get(骨)
          if (!友 || !事件词.has(友)) continue
          近似 += 近似权重(词, 友)
          break
        }
      }
      if (重叠 <= 0 && 标签分 <= 0 && 相似 <= 0 && 近似 <= 0) continue

      // 2026-11-04：最近几晚的热词，两边都沾就翻倍
      let 关键词倍 = 1
      if (关键词集.size) {
        for (const 词 of 线索词) {
          if (关键词集.has(词) && (事件词.has(词) || 文.includes(String(词).replace('同:', '')))) {
            关键词倍 = 2
            break
          }
        }
      }

      // 标题（第一句）命中比正文后面的命中更有分量
      const 标题 = 文.split(/[。！？,；\n]/)[0] || ''
      let 标题倍 = 1
      if (标题) {
        for (const 词 of 线索词) {
          if (标题.includes(词)) { 标题倍 = 1.35; break }
        }
      }

      const 时间 = Date.parse(String(e.time || '')) || 0
      const 天 = 时间 ? Math.max(0, (现在 - 时间) / 86400000) : 999
      const 衰减 = Math.pow(0.5, 天 / 半衰天数)
      // 情绪重的事更容易想起来：摔过的、吵过的
      const 重 = Math.max(0.3, Math.min(1, Number(e.weight) || 0.5))
      const 情绪重 = 0.7 + 0.9 * 重

      const 分 = (重叠 * 标题倍 + 标签分 + 0.5 * 相似 + 近似) * 衰减 * 情绪重 * 关键词倍
      打分.push({ 事件: e, 分, 重叠, 衰减, 标签分, 相似, 近似, 关键词倍 })
    }

    打分.sort((a, b) => b.分 - a.分)
    // 同样的话只留一条（重复发的图、重复的一句，占位置没意义）
    const 结果 = []
    const 见过文 = new Set()
    for (const x of 打分) {
      const 文 = String((x.事件 && x.事件.summary) || '')
      if (见过文.has(文)) continue
      见过文.add(文)
      结果.push({ ...x.事件, _分: Math.round(x.分 * 1000) / 1000 })
      if (结果.length >= 条数) break
    }
    return 结果
  }

  /** 最近的几条（线索不够时兜底） */
  const 最近 = (条数 = 4) => 全部().slice(-Math.max(1, Number(条数) || 4)).reverse()

  /**
   * 拼注入用：先按线索找相关的，再用最近几条补位，去重。
   * @param {string} 线索 他说的话
   * @param {object} 参数 { 相关条数, 最近条数 }
   */
  const 拼注入 = (线索 = '', 参数 = {}) => {
    const 相关条数 = Math.max(0, Number(参数.相关条数 ?? 4))
    const 最近条数 = Math.max(0, Number(参数.最近条数 ?? 2))
    const 拿到的 = []
    const 见过 = new Set()
    const 收 = (e, 标记) => {
      const 原 = String((e && e.summary) || '').trim()
      if (!原 || 见过.has(原)) return
      见过.add(原)
      // 2026-11-03：太长的截一截，别让一条记忆占掉半屏注入
      const 文 = 原.length > 70 ? 原.slice(0, 70) + '…' : 原
      拿到的.push({ 文, 谁: (e.who && e.who.name) || '', 标记 })
    }
    for (const e of 找(线索, { 条数: 相关条数 })) 收(e, '')
    for (const e of 最近(最近条数)) 收(e, '最近')
     if (!拿到的.length) return ''
    return 拿到的.map((x) => '· ' + (x.谁 ? '[' + x.谁 + '] ' : '') + x.文 + (x.标记 === '最近' ? '（最近）' : '')).join('\n')
  }

  return { 找, 最近, 拼注入, 全部, 词频 }
}
