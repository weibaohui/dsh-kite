'use strict'

/**
 * dsh-kite — 风筝框架卡组（Kite Cards）
 *
 * 「形状 × 图案 × 配色」三者全部是数据，可整体替换：
 *   FRAMES    风筝骨架库：轮廓 / 骨架竹条 / 图案分区(cells) / 贴图映射区 /
 *             尾链挂点 / 扑动参数。取材潍坊风筝谱系——硬翅（沙燕、龙头）、
 *             软翅（金鱼、蝴蝶、老鹰、蜻蜓）、板子（菱形、八卦、六角、圆月、
 *             蝙蝠）、立体（宫灯）。
 *   PATTERNS  图案画师库：在任意闭合分区内作画的纯过程函数（梅花 / 祥云 /
 *             鳞纹 / 海水纹 / 羽纹 / 放射线 / 燕面……）。卡组用
 *             pattern + cellPatterns{role→patternId} 任意组合。
 *   PALETTES  传统配色（HSL 三元组数组）。
 *   ALL_CARDS 一张卡 = 骨架 + 图案 + 配色 + 尾巴 + 稀有度，洗牌袋抽取保证
 *             连续换风筝不重样。
 *
 * 引擎（kite-engine.js）只消费 resolveCard() 的落定谱（KiteSpec）与
 * paintSail()/pathPoly() 等纯画布助手；本文件同时跑在浏览器（构建期内联）
 * 与 node 测试（底部 CommonJS 导出）两侧，不得引用 DOM。
 */

/* node-test-export-start */

// ── 确定性随机（mulberry32）──────────────────────────────────────────────
/** 同一 seed 产出同一序列：换风筝/纹理绘制可复现，测试可断言。 */
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 区间落定：mag 按 curve 插值（linear/sqrt/log），再加 ±jitter 比例抖动。 */
function ranged(range, mag, rng, curve, jitter) {
  const lo = Array.isArray(range) ? range[0] : range
  const hi = Array.isArray(range) ? range[1] : range
  let m = mag
  if (curve === 'sqrt') m = Math.sqrt(mag)
  else if (curve === 'log') m = Math.log2(1 + mag)
  let v = lo + (hi - lo) * Math.min(1, Math.max(0, m))
  if (jitter && rng) v += (rng() * 2 - 1) * jitter * ((hi - lo) || Math.abs(lo) || 1)
  return v
}

/** 活动度/高度分数 → 0..1 的通用映射（与宿主 activityOf 同式）。 */
function magnitudeOf(tokens, ref) {
  const R = ref > 0 ? ref : 20000
  const t = Math.max(0, tokens || 0)
  return Math.min(1, Math.log2(1 + t) / Math.log2(1 + R))
}

// ── 几何助手 ─────────────────────────────────────────────────────────────
/** 多边形路径：pts 为单位空间点列，map(u,v)→[x,y] 可选（缺省直角坐标）。 */
function pathPoly(g, pts, map, close) {
  const f = map || ((u, v) => [u, v])
  g.beginPath()
  for (let i = 0; i < pts.length; i++) {
    const p = f(pts[i][0], pts[i][1])
    if (i === 0) g.moveTo(p[0], p[1])
    else g.lineTo(p[0], p[1])
  }
  if (close !== false) g.closePath()
}

/** 点列包围盒（单位空间）。 */
function polyBBox(pts) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0]
    if (p[0] > x1) x1 = p[0]
    if (p[1] < y0) y0 = p[1]
    if (p[1] > y1) y1 = p[1]
  }
  return { x0, y0, x1, y1 }
}

/** hsl([0,360),[0,100],[0,100]) → 'hsl(h s% l%)' 串。 */
function hsl(h, s, l, a) {
  return a == null ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${a})`
}

// ── 传统配色（[h,s,l]）──────────────────────────────────────────────────
const PALETTES = {
  cinnabar:  [[4, 78, 52], [14, 82, 58], [356, 70, 46]],      // 朱红
  indigo:    [[222, 62, 46], [232, 55, 56], [212, 60, 38]],   // 靛青
  jade:      [[160, 62, 44], [148, 60, 54], [172, 55, 38]],   // 翠绿
  golden:    [[44, 92, 56], [38, 95, 48], [52, 90, 64]],      // 明黄
  azurite:   [[208, 72, 52], [198, 78, 60], [218, 65, 44]],   // 石青
  plumPink:  [[335, 72, 66], [348, 68, 58], [325, 65, 72]],   // 桃红
  inkwash:   [[220, 12, 26], [215, 10, 40], [225, 14, 18]],   // 墨
  violet:    [[272, 58, 58], [285, 55, 50], [262, 60, 66]],   // 青莲
  turquoise: [[188, 66, 50], [178, 70, 56], [196, 62, 44]],   // 湖蓝
  persimmon: [[22, 85, 54], [30, 90, 60], [14, 80, 48]],      // 柿橙
  pearl:     [[210, 26, 88], [45, 30, 86], [330, 18, 88]],    // 月白
  kingfisher:[[195, 78, 42], [185, 82, 50], [205, 72, 36]],   // 翠蓝
}

/** 调色板取一个色（rng 决定，可指定索引偏好）。 */
function pickColor(pal, rng) {
  return pal[Math.floor(rng() * pal.length) % pal.length]
}

// ── 图案画师 ─────────────────────────────────────────────────────────────
// 约定：env = { g, P(u,v)→[x,y], hw, hh, rng, pal, ink, role }
// 画师在已 clip 的分区内作画，坐标系 u,v∈[-1,1]（y 向下）。

function petalBlossom(env, u, v, r, petal, core) {
  const { g, P, ink } = env
  g.fillStyle = petal
  g.strokeStyle = hsl(ink[0], ink[1], ink[2], 0.5)
  g.lineWidth = Math.max(0.8, r * 0.12)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    const p = P(u + Math.cos(a) * r * 0.62, v + Math.sin(a) * r * 0.62)
    g.beginPath()
    g.arc(p[0], p[1], r, 0, Math.PI * 2)
    g.fill()
    g.stroke()
  }
  const c = P(u, v)
  g.fillStyle = core
  g.beginPath()
  g.arc(c[0], c[1], r * 0.42, 0, Math.PI * 2)
  g.fill()
}

/** 涡卷云纹：一组圆卷 + 拖尾。 */
function cloudScroll(env, u, v, s) {
  const { g, P, pal, ink } = env
  const col = pickColor(pal, env.rng)
  const c = P(u, v)
  g.fillStyle = hsl(col[0], col[1], Math.min(88, col[2] + 16))
  g.beginPath()
  g.arc(c[0], c[1], s, 0, Math.PI * 2)
  g.arc(c[0] - s * 0.9, c[1] + s * 0.28, s * 0.62, 0, Math.PI * 2)
  g.arc(c[0] + s * 0.85, c[1] + s * 0.34, s * 0.55, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = hsl(ink[0], ink[1], ink[2])
  g.lineWidth = Math.max(1, s * 0.16)
  g.beginPath()
  g.arc(c[0], c[1], s * 0.52, -0.6, Math.PI * 1.35)
  g.stroke()
  g.beginPath()
  g.moveTo(c[0] + s * 0.7, c[1] + s * 0.5)
  g.quadraticCurveTo(c[0] + s * 2.1, c[1] + s * 0.1, c[0] + s * 2.6, c[1] - s * 0.5)
  g.stroke()
}

const PATTERNS = {
  /** 梅花：疏影三两枝。 */
  plum(env) {
    const { rng, pal, P } = env
    const n = 3 + Math.floor(rng() * 2)
    for (let i = 0; i < n; i++) {
      const u = (rng() * 1.4 - 0.7)
      const v = (rng() * 1.4 - 0.7)
      const r = (0.1 + rng() * 0.08) * env.hw
      petalBlossom(env, u, v, r, hsl(...pickColor(pal, rng).map((x, j) => j === 2 ? Math.min(90, x + 14) : x)), hsl(46, 90, 62))
      if (rng() < 0.7) {
        const b = P(u + 0.18, v + 0.2)
        const b2 = P(u + 0.26, v + 0.3)
        env.g.strokeStyle = hsl(...pickColor(pal, rng))
        env.g.lineWidth = Math.max(1, env.hw * 0.02)
        env.g.beginPath(); env.g.moveTo(b[0], b[1]); env.g.lineTo(b2[0], b2[1]); env.g.stroke()
      }
    }
  },

  /** 祥云：三两朵涡卷。 */
  cloud(env) {
    const n = 2 + Math.floor(env.rng() * 2)
    for (let i = 0; i < n; i++) {
      cloudScroll(env, env.rng() * 1.1 - 0.55, env.rng() * 1.1 - 0.55, (0.2 + env.rng() * 0.12) * env.hw)
    }
  },

  /** 鳞纹：一排排叠瓦圆弧（金鱼／龙身）。 */
  scale(env) {
    const { g, P, pal, ink, rng } = env
    g.fillStyle = hsl(...pickColor(pal, rng), 0.5)
    const rows = 5
    const cols = 4
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const u = (c / cols) * 2 + (r % 2 ? 0.25 : 0)
        const v = -1 + (r / (rows - 1)) * 1.7
        const p = P(u, v)
        const rad = env.hw * 0.3
        g.beginPath()
        g.arc(p[0], p[1], rad, Math.PI * 1.05, Math.PI * 1.95)
        g.fill()
        g.strokeStyle = hsl(ink[0], ink[1], ink[2] + 8, 0.5)
        g.lineWidth = Math.max(0.8, env.hw * 0.016)
        g.stroke()
      }
    }
  },

  /** 横纹：宽窄相间的布纹色带。 */
  stripe(env) {
    const { g, P, pal, rng } = env
    const bands = 5 + Math.floor(rng() * 3)
    for (let i = 0; i < bands; i++) {
      const v0 = -1 + (i / bands) * 2
      const v1 = -1 + ((i + 1) / bands) * 2
      const a = P(-1.2, v0); const b = P(1.2, v1)
      g.fillStyle = hsl(...pal[i % pal.length])
      g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1] + 0.5)
    }
  },

  /** 放射线：日轮般的放射色楔。 */
  ray(env) {
    const { g, P, pal, rng } = env
    const n = 8 + Math.floor(rng() * 4) * 2
    for (let i = 0; i < n; i += 2) {
      const a0 = (i / n) * Math.PI * 2
      const a1 = ((i + 1) / n) * Math.PI * 2
      g.fillStyle = hsl(...pal[(i / 2) % pal.length])
      g.beginPath()
      const c = P(0, 0)
      const p1 = P(Math.cos(a0) * 1.6, Math.sin(a0) * 1.6)
      const p2 = P(Math.cos(a1) * 1.6, Math.sin(a1) * 1.6)
      g.moveTo(c[0], c[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1])
      g.closePath(); g.fill()
    }
  },

  /** 牡丹：中心一朵团花 + 四角小花苞。 */
  peony(env) {
    const { g, P, pal, rng } = env
    const petals = 10
    for (let ringI = 0; ringI < 2; ringI++) {
      const r = (ringI === 0 ? 0.62 : 0.4) * env.hw
      const n = petals + ringI * 4
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ringI * 0.3
        const col = pickColor(pal, rng)
        g.fillStyle = hsl(col[0], col[1], Math.min(88, col[2] + ringI * 12))
        const p = P(Math.cos(a) * (ringI ? 0.16 : 0.3), Math.sin(a) * (ringI ? 0.16 : 0.3))
        g.save()
        g.translate(p[0], p[1]); g.rotate(a)
        g.beginPath()
        g.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI * 2)
        g.fill()
        g.restore()
      }
    }
    const c = P(0, 0)
    g.fillStyle = hsl(46, 92, 64)
    g.beginPath(); g.arc(c[0], c[1], env.hw * 0.14, 0, Math.PI * 2); g.fill()
  },

  /** 羽纹：中轴 + 垂直分肋（宽分区横轴，高分区竖轴）。 */
  feather(env) {
    const { g, P, pal, ink, rng } = env
    const vertical = env.hh > env.hw
    const n = 5 + Math.floor(rng() * 3)
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n * 1.8 - 0.9
      const col = pickColor(pal, rng)
      g.strokeStyle = hsl(col[0], col[1], Math.min(86, col[2] + 10), 0.85)
      g.lineWidth = Math.max(1, Math.min(env.hw, env.hh) * 0.06)
      const a = vertical ? P(0, t) : P(t, 0)
      const tip = vertical ? P(0.95, t + 0.12) : P(t + 0.12, 0.95)
      const mid = vertical ? P(0.4, t + 0.02) : P(t + 0.02, 0.4)
      g.beginPath()
      g.moveTo(a[0], a[1])
      g.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1])
      const tip2 = vertical ? P(-0.95, t - 0.12) : P(t - 0.12, -0.95)
      const mid2 = vertical ? P(-0.4, t - 0.02) : P(t - 0.02, -0.4)
      g.moveTo(a[0], a[1])
      g.quadraticCurveTo(mid2[0], mid2[1], tip2[0], tip2[1])
      g.stroke()
    }
    g.strokeStyle = hsl(ink[0], ink[1], ink[2], 0.6)
    g.lineWidth = Math.max(1, Math.min(env.hw, env.hh) * 0.035)
    const a = vertical ? P(0, -1.1) : P(-1.1, 0)
    const b = vertical ? P(0, 1.1) : P(1.1, 0)
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke()
  },

  /** 燕面／脸谱：对称的眉眼口鼻（head 分区专用，其余分区退化为团花）。 */
  face(env) {
    const { g, P, pal, ink, rng, role } = env
    if (role !== 'head') {
      petalBlossom(env, 0, 0, 0.3 * env.hw, hsl(...pickColor(pal, rng)), hsl(46, 90, 62))
      return
    }
    const white = hsl(45, 30, 92)
    const inkCol = hsl(ink[0], ink[1], ink[2])
    // 眼白与瞳
    for (const s of [-1, 1]) {
      const e = P(s * 0.34, -0.08)
      g.fillStyle = white
      g.beginPath(); g.ellipse(e[0], e[1], env.hw * 0.3, env.hh * 0.24, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = inkCol
      g.beginPath(); g.arc(e[0] + s * env.hw * 0.05, e[1], env.hw * 0.12, 0, Math.PI * 2); g.fill()
      g.fillStyle = hsl(...pickColor(pal, rng))
      g.beginPath(); g.arc(e[0] + s * env.hw * 0.05, e[1], env.hw * 0.05, 0, Math.PI * 2); g.fill()
    }
    // 剑眉
    g.strokeStyle = inkCol
    g.lineWidth = Math.max(1.5, env.hw * 0.08)
    g.lineCap = 'round'
    for (const s of [-1, 1]) {
      const a = P(s * 0.08, -0.38); const b = P(s * 0.66, -0.52)
      g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(P(s * 0.38, -0.62)[0], P(s * 0.38, -0.62)[1], b[0], b[1]); g.stroke()
    }
    // 口／喙
    const m = P(0, 0.42)
    g.fillStyle = hsl(...pickColor(pal, rng))
    g.beginPath()
    g.ellipse(m[0], m[1], env.hw * 0.16, env.hh * 0.1, 0, 0, Math.PI * 2)
    g.fill()
  },

  /** 满天星：散点 + 十字星芒。 */
  dotstar(env) {
    const { g, P, pal, rng } = env
    const n = 16 + Math.floor(rng() * 10)
    for (let i = 0; i < n; i++) {
      const u = rng() * 1.7 - 0.85
      const v = rng() * 1.7 - 0.85
      const p = P(u, v)
      const big = rng() < 0.3
      const col = pickColor(pal, rng)
      g.fillStyle = hsl(col[0], Math.min(100, col[1] + 10), Math.min(92, col[2] + 18))
      if (big) {
        const r = env.hw * (0.09 + rng() * 0.05)
        g.strokeStyle = g.fillStyle
        g.lineWidth = Math.max(1.2, env.hw * 0.035)
        g.beginPath()
        g.moveTo(p[0] - r, p[1]); g.lineTo(p[0] + r, p[1])
        g.moveTo(p[0], p[1] - r); g.lineTo(p[0], p[1] + r)
        g.stroke()
      } else {
        g.beginPath()
        g.arc(p[0], p[1], env.hw * (0.04 + rng() * 0.03), 0, Math.PI * 2)
        g.fill()
      }
    }
  },

  /** 海水纹：一层层叠弧（八卦／圆月的底纹）。 */
  wave(env) {
    const { g, P, ink } = env
    const rows = 4
    for (let r = 0; r < rows; r++) {
      const v = -0.85 + (r / rows) * 1.7
      g.strokeStyle = hsl(ink[0], ink[1], ink[2] + 10, 0.5)
      g.lineWidth = Math.max(1, env.hw * 0.022)
      for (let c = -2; c <= 2; c++) {
        const u = c * 0.44 + (r % 2 ? 0.22 : 0)
        const p = P(u, v)
        g.beginPath()
        g.arc(p[0], p[1], env.hw * 0.26, Math.PI * 1.08, Math.PI * 1.92)
        g.stroke()
      }
    }
  },

  /** 彩虹渐变:色相沿帆面横向铺开(七彩风筝的底子,配 dynamicHue 流转)。 */
  spectrum(env) {
    const { g, P, pal, rng } = env
    const steps = 24
    for (let i = 0; i < steps; i++) {
      const u0 = -1 + (i / steps) * 2
      const u1 = -1 + ((i + 1) / steps) * 2
      const hue = (i / steps) * 300 + rng() * 12
      const col = pickColor(pal, rng)
      g.fillStyle = hsl((hue + col[0]) % 360, Math.min(100, col[1] + 20), 52 + rng() * 10)
      const a = P(u0, -1.1)
      const b = P(u1, 1.1)
      g.fillRect(a[0], a[1], b[0] - a[0] + 1, b[1] - a[1] + 1)
    }
  },
}

/** 飞龙腰节贴片绘制:圆形筒身两截色 + 鳞弧 + 中心结(龙身逐节)。 */
function paintSegment(g, size, opts) {
  const { pal, rng, ink } = opts
  const r = size / 2
  const cx = size / 2
  const cy = size / 2
  g.fillStyle = hsl(...pal[0])
  g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.5, Math.PI * 1.5); g.fill()
  g.fillStyle = hsl(...pal[1 % pal.length])
  g.beginPath(); g.arc(cx, cy, r, Math.PI * 1.5, Math.PI * 0.5); g.fill()
  g.strokeStyle = hsl(ink[0], ink[1], ink[2] + 12, 0.6)
  g.lineWidth = Math.max(1, r * 0.1)
  for (let i = 0; i < 3; i++) {
    g.beginPath()
    g.arc(cx, cy, r * (0.72 - i * 0.22), Math.PI * 1.15, Math.PI * 1.85)
    g.stroke()
  }
  g.fillStyle = hsl(46, 90, 60)
  g.beginPath(); g.arc(cx, cy, r * 0.16, 0, Math.PI * 2); g.fill()
  g.strokeStyle = hsl(ink[0], ink[1], ink[2])
  g.lineWidth = Math.max(1, r * 0.06)
  g.beginPath(); g.arc(cx, cy, r * 0.97, 0, Math.PI * 2); g.stroke()
}

// ── 风筝骨架库 ───────────────────────────────────────────────────────────
// 单位空间：x∈[-1,1] 向右，y∈[-1,1] 向下；尾巴挂在 +y。
// cells: {role, poly}；role ∈ head/wing/body/tail/panel，图案按 role 组合。
// decalQuad: TL,TR,BR,BL —— 用户贴图的映射区（随姿态仿射变换）。

const FRAMES = {
  /** 菱形 · 板子鹞的极简原型，竹骨十字。 */
  diamond: {
    id: 'diamond', name: '菱形', nameEn: 'Diamond', family: 'board',
    size: 0.94,
    outline: [[0, -1], [0.62, 0], [0, 1], [-0.62, 0]],
    cells: [{ role: 'body', poly: [[0, -1], [0.62, 0], [0, 1], [-0.62, 0]] }],
    spars: [[0, -1, 0, 1], [-0.62, 0, 0.62, 0]],
    decalQuad: [[-0.62, -1], [0.62, -1], [0.62, 1], [-0.62, 1]],
    tail: { attach: [[0, 1]], segs: 12, segLen: 0.11, bows: true, width: 3 },
    flap: { amp: 0.05, k: 2.2 },
    bridle: [0, -0.12],
  },

  /** 沙燕 · 硬翅经典：双爪头、硬翅、燕身收尾。 */
  shayan: {
    id: 'shayan', name: '沙燕', nameEn: 'Swallow', family: 'hard',
    size: 1.06,
    outline: [
      [0, -1], [0.1, -0.94], [0.22, -0.86], [0.3, -0.72], [0.24, -0.6],
      [0.42, -0.82], [0.72, -0.66], [0.78, -0.44], [0.95, -0.16],
      [0.66, 0.1], [0.36, 0.26], [0.2, 0.52], [0.13, 0.78], [0.07, 0.97], [0, 1],
      [-0.07, 0.97], [-0.13, 0.78], [-0.2, 0.52], [-0.36, 0.26], [-0.66, 0.1],
      [-0.95, -0.16], [-0.78, -0.44], [-0.72, -0.66], [-0.42, -0.82], [-0.24, -0.6],
      [-0.3, -0.72], [-0.22, -0.86], [-0.1, -0.94],
    ],
    cells: [
      { role: 'head', poly: [[0, -1], [0.1, -0.94], [0.22, -0.86], [0.3, -0.72], [0.24, -0.6], [-0.24, -0.6], [-0.3, -0.72], [-0.22, -0.86], [-0.1, -0.94]] },
      { role: 'wing', poly: [[0.05, -0.55], [0.42, -0.82], [0.72, -0.66], [0.78, -0.44], [0.95, -0.16], [0.66, 0.1], [0.36, 0.26], [0.05, 0.12]] },
      { role: 'wing', poly: [[-0.05, -0.55], [-0.42, -0.82], [-0.72, -0.66], [-0.78, -0.44], [-0.95, -0.16], [-0.66, 0.1], [-0.36, 0.26], [-0.05, 0.12]] },
      { role: 'body', poly: [[-0.05, -0.55], [0.05, -0.55], [0.13, 0.78], [0.07, 0.97], [0, 1], [-0.07, 0.97], [-0.13, 0.78]] },
    ],
    spars: [[0, -1, 0, 1], [0.06, -0.6, 0.9, -0.16], [-0.06, -0.6, -0.9, -0.16], [-0.3, 0.15, 0.3, 0.15]],
    decalQuad: [[-0.5, -0.88], [0.5, -0.88], [0.5, 0.62], [-0.5, 0.62]],
    tail: { attach: [[-0.09, 0.94], [0.09, 0.94]], segs: 8, segLen: 0.09, bows: true, width: 2.5 },
    flap: { amp: 0.035, k: 3.0 },
    bridle: [0, -0.3],
  },

  /** 金鱼 · 软翅：圆头鼓腹、双尾如裙。 */
  goldfish: {
    id: 'goldfish', name: '金鱼', nameEn: 'Goldfish', family: 'soft',
    size: 1.0,
    outline: [
      [0, -0.92], [0.34, -0.7], [0.5, -0.35], [0.58, 0.05], [0.5, 0.3],
      [0.62, 0.62], [0.52, 0.98], [0.3, 0.72], [0.12, 0.92], [0, 0.7],
      [-0.12, 0.92], [-0.3, 0.72], [-0.52, 0.98], [-0.62, 0.62], [-0.5, 0.3],
      [-0.58, 0.05], [-0.5, -0.35], [-0.34, -0.7],
    ],
    cells: [
      { role: 'head', poly: [[0, -0.92], [0.3, -0.68], [0.2, -0.4], [-0.2, -0.4], [-0.3, -0.68]] },
      { role: 'wing', poly: [[0.05, -0.6], [0.34, -0.7], [0.5, -0.35], [0.58, 0.05], [0.5, 0.3], [0.25, 0.25], [0.1, -0.2]] },
      { role: 'wing', poly: [[-0.05, -0.6], [-0.34, -0.7], [-0.5, -0.35], [-0.58, 0.05], [-0.5, 0.3], [-0.25, 0.25], [-0.1, -0.2]] },
      { role: 'tail', poly: [[0.25, 0.25], [0.5, 0.3], [0.62, 0.62], [0.52, 0.98], [0.3, 0.72], [0.12, 0.92], [0, 0.7], [0.1, 0.45]] },
      { role: 'tail', poly: [[-0.25, 0.25], [-0.5, 0.3], [-0.62, 0.62], [-0.52, 0.98], [-0.3, 0.72], [-0.12, 0.92], [0, 0.7], [-0.1, 0.45]] },
    ],
    spars: [[0, -0.92, 0, 0.7], [-0.5, -0.3, 0.5, -0.3], [0.1, -0.55, 0.55, 0.15], [-0.1, -0.55, -0.55, 0.15]],
    decalQuad: [[-0.58, -0.92], [0.58, -0.92], [0.58, 0.72], [-0.58, 0.72]],
    tail: { attach: [[-0.45, 0.9], [0.45, 0.9]], segs: 12, segLen: 0.1, bows: false, width: 2.5 },
    flap: { amp: 0.06, k: 2.4 },
    bridle: [0, -0.45],
  },

  /** 蝴蝶 · 软翅：双对翅翼、细身长须。 */
  butterfly: {
    id: 'butterfly', name: '蝴蝶', nameEn: 'Butterfly', family: 'soft',
    size: 1.08,
    outline: [
      [0, -0.8], [0.16, -0.85], [0.5, -0.98], [0.88, -0.78], [0.99, -0.4],
      [0.74, -0.1], [0.42, -0.15], [0.5, 0.15], [0.55, 0.5], [0.3, 0.66],
      [0.12, 0.5], [0.08, 0.72], [0, 0.92],
      [-0.08, 0.72], [-0.12, 0.5], [-0.3, 0.66], [-0.55, 0.5], [-0.5, 0.15],
      [-0.42, -0.15], [-0.74, -0.1], [-0.99, -0.4], [-0.88, -0.78], [-0.5, -0.98], [-0.16, -0.85],
    ],
    cells: [
      { role: 'wing', poly: [[0.06, -0.6], [0.16, -0.85], [0.5, -0.98], [0.88, -0.78], [0.99, -0.4], [0.74, -0.1], [0.42, -0.15], [0.12, -0.1]] },
      { role: 'wing', poly: [[-0.06, -0.6], [-0.16, -0.85], [-0.5, -0.98], [-0.88, -0.78], [-0.99, -0.4], [-0.74, -0.1], [-0.42, -0.15], [-0.12, -0.1]] },
      { role: 'tail', poly: [[0.42, -0.15], [0.5, 0.15], [0.55, 0.5], [0.3, 0.66], [0.12, 0.5], [0.1, 0.2]] },
      { role: 'tail', poly: [[-0.42, -0.15], [-0.5, 0.15], [-0.55, 0.5], [-0.3, 0.66], [-0.12, 0.5], [-0.1, 0.2]] },
      { role: 'body', poly: [[-0.07, -0.6], [0.07, -0.6], [0.08, 0.72], [0, 0.92], [-0.08, 0.72]] },
    ],
    spars: [[0, -0.8, 0, 0.92], [0, -0.78, 0.2, -0.99], [0, -0.78, -0.2, -0.99],
      [0.15, -0.2, 0.8, -0.55], [-0.15, -0.2, -0.8, -0.55], [0.15, 0.15, 0.45, 0.5], [-0.15, 0.15, -0.45, 0.5]],
    decalQuad: [[-0.99, -0.98], [0.99, -0.98], [0.99, 0.68], [-0.99, 0.68]],
    tail: { attach: [[-0.05, 0.88], [0.05, 0.88]], segs: 6, segLen: 0.08, bows: false, width: 2 },
    flap: { amp: 0.09, k: 2.8 },
    bridle: [0, -0.3],
  },

  /** 老鹰 · 软翅：尖翅后掠、扇尾。 */
  eagle: {
    id: 'eagle', name: '老鹰', nameEn: 'Eagle', family: 'soft',
    size: 1.08,
    outline: [
      [0, -0.85], [0.18, -0.8], [0.55, -0.95], [0.9, -0.6], [1.0, -0.2],
      [0.62, 0.12], [0.4, 0.3], [0.52, 0.62], [0.3, 0.78], [0.12, 0.6], [0, 0.9],
      [-0.12, 0.6], [-0.3, 0.78], [-0.52, 0.62], [-0.4, 0.3], [-0.62, 0.12],
      [-1.0, -0.2], [-0.9, -0.6], [-0.55, -0.95], [-0.18, -0.8],
    ],
    cells: [
      { role: 'head', poly: [[0, -0.85], [0.18, -0.8], [0.12, -0.55], [-0.12, -0.55], [-0.18, -0.8]] },
      { role: 'wing', poly: [[0.06, -0.5], [0.55, -0.95], [0.9, -0.6], [1.0, -0.2], [0.62, 0.12], [0.4, 0.3], [0.1, 0.1]] },
      { role: 'wing', poly: [[-0.06, -0.5], [-0.55, -0.95], [-0.9, -0.6], [-1.0, -0.2], [-0.62, 0.12], [-0.4, 0.3], [-0.1, 0.1]] },
      { role: 'tail', poly: [[-0.4, 0.3], [0.4, 0.3], [0.52, 0.62], [0.3, 0.78], [0.12, 0.6], [0, 0.9], [-0.12, 0.6], [-0.3, 0.78], [-0.52, 0.62]] },
    ],
    spars: [[0, -0.85, 0, 0.9], [0.1, -0.55, 0.95, -0.25], [-0.1, -0.55, -0.95, -0.25], [0.1, 0.4, 0.45, 0.7], [-0.1, 0.4, -0.45, 0.7]],
    decalQuad: [[-1.0, -0.95], [1.0, -0.95], [1.0, 0.9], [-1.0, 0.9]],
    tail: { attach: [[0, 0.9]], segs: 8, segLen: 0.09, bows: false, width: 2.5 },
    flap: { amp: 0.05, k: 2.6 },
    bridle: [0, -0.3],
  },

  /** 八卦 · 板子：八方亭盖，上下插穗。 */
  bagua: {
    id: 'bagua', name: '八卦', nameEn: 'Bagua', family: 'board',
    size: 1.0,
    outline: [
      [-0.25, -1], [0.25, -1], [0.25, -0.82], [0.6, -0.6], [0.85, 0],
      [0.6, 0.6], [0.25, 0.82], [0.25, 1], [-0.25, 1], [-0.25, 0.82],
      [-0.6, 0.6], [-0.85, 0], [-0.6, -0.6], [-0.25, -0.82],
    ],
    cells: [
      { role: 'body', poly: [[0.25, -0.82], [0.6, -0.6], [0.85, 0], [0.6, 0.6], [0.25, 0.82], [-0.25, 0.82], [-0.6, 0.6], [-0.85, 0], [-0.6, -0.6], [-0.25, -0.82]] },
      { role: 'core', poly: [[0, -0.5], [0.35, -0.35], [0.5, 0], [0.35, 0.35], [0, 0.5], [-0.35, 0.35], [-0.5, 0], [-0.35, -0.35]] },
    ],
    spars: [[0, -0.85, 0, 0.85], [-0.85, 0, 0.85, 0], [-0.6, -0.6, 0.6, 0.6], [-0.6, 0.6, 0.6, -0.6]],
    decalQuad: [[-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85]],
    tail: { attach: [[-0.25, 0.98], [0.25, 0.98]], segs: 7, segLen: 0.09, bows: true, width: 2.5 },
    flap: { amp: 0.03, k: 3.4 },
    bridle: [0, -0.2],
  },

  /** 六角 · 板子：南鹞古制。 */
  hexagon: {
    id: 'hexagon', name: '六角', nameEn: 'Hexagon', family: 'board',
    size: 0.98,
    outline: [[0.45, -0.8], [-0.45, -0.8], [-0.9, 0], [-0.45, 0.8], [0.45, 0.8], [0.9, 0]],
    cells: [
      { role: 'body', poly: [[0.45, -0.8], [-0.45, -0.8], [-0.9, 0], [-0.45, 0.8], [0.45, 0.8], [0.9, 0]] },
      { role: 'core', poly: [[0.24, -0.42], [-0.24, -0.42], [-0.48, 0], [-0.24, 0.42], [0.24, 0.42], [0.48, 0]] },
    ],
    spars: [[0, -0.8, 0, 0.8], [-0.45, -0.8, 0.45, 0.8], [-0.9, 0, 0.9, 0]],
    decalQuad: [[-0.9, -0.8], [0.9, -0.8], [0.9, 0.8], [-0.9, 0.8]],
    tail: { attach: [[0, 0.8]], segs: 10, segLen: 0.1, bows: true, width: 3 },
    flap: { amp: 0.035, k: 3.0 },
    bridle: [0, -0.2],
  },

  /** 圆月 · 板子：一轮满月当空。 */
  round: {
    id: 'round', name: '圆月', nameEn: 'Full Moon', family: 'board',
    size: 1.0,
    outline: (() => {
      const pts = []
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        pts.push([Math.cos(a) * 0.94, Math.sin(a) * 0.94])
      }
      return pts
    })(),
    cells: [
      { role: 'body', poly: (() => {
        const pts = []
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2
          pts.push([Math.cos(a) * 0.94, Math.sin(a) * 0.94])
        }
        return pts
      })() },
      { role: 'core', poly: (() => {
        const pts = []
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2
          pts.push([Math.cos(a) * 0.58, Math.sin(a) * 0.58])
        }
        return pts
      })() },
    ],
    spars: [[0, -0.94, 0, 0.94], [-0.94, 0, 0.94, 0], [-0.66, -0.66, 0.66, 0.66], [-0.66, 0.66, 0.66, -0.66]],
    decalQuad: [[-0.94, -0.94], [0.94, -0.94], [0.94, 0.94], [-0.94, 0.94]],
    tail: { attach: [[0, 0.92]], segs: 9, segLen: 0.1, bows: true, width: 3 },
    flap: { amp: 0.03, k: 3.4 },
    bridle: [0, -0.25],
  },

  /** 蝙蝠 · 板子：蝠临（福到）檐下。 */
  bat: {
    id: 'bat', name: '蝙蝠', nameEn: 'Bat', family: 'board',
    size: 1.04,
    outline: [
      [0, -0.72], [0.1, -0.92], [0.22, -0.8], [0.34, -0.9], [0.42, -0.7],
      [0.75, -0.62], [0.98, -0.3], [0.86, -0.02], [0.6, -0.04], [0.74, 0.2],
      [0.5, 0.26], [0.64, 0.52], [0.4, 0.48], [0.5, 0.78], [0.28, 0.62],
      [0.24, 0.92], [0.08, 0.76], [0, 0.96],
      [-0.08, 0.76], [-0.24, 0.92], [-0.28, 0.62], [-0.5, 0.78], [-0.4, 0.48],
      [-0.64, 0.52], [-0.5, 0.26], [-0.74, 0.2], [-0.6, -0.04], [-0.86, -0.02],
      [-0.98, -0.3], [-0.75, -0.62], [-0.42, -0.7], [-0.34, -0.9], [-0.22, -0.8], [-0.1, -0.92],
    ],
    cells: [
      { role: 'head', poly: [[0, -0.72], [0.1, -0.92], [0.22, -0.8], [0.34, -0.9], [0.42, -0.7], [0.2, -0.5], [-0.2, -0.5], [-0.42, -0.7], [-0.34, -0.9], [-0.22, -0.8], [-0.1, -0.92]] },
      { role: 'wing', poly: [[0.06, -0.45], [0.42, -0.7], [0.75, -0.62], [0.98, -0.3], [0.86, -0.02], [0.6, -0.04], [0.74, 0.2], [0.5, 0.26], [0.64, 0.52], [0.4, 0.48], [0.5, 0.78], [0.28, 0.62], [0.24, 0.92], [0.08, 0.76], [0, 0.9], [0.06, 0.2]] },
      { role: 'wing', poly: [[-0.06, -0.45], [-0.42, -0.7], [-0.75, -0.62], [-0.98, -0.3], [-0.86, -0.02], [-0.6, -0.04], [-0.74, 0.2], [-0.5, 0.26], [-0.64, 0.52], [-0.4, 0.48], [-0.5, 0.78], [-0.28, 0.62], [-0.24, 0.92], [-0.08, 0.76], [0, 0.9], [-0.06, 0.2]] },
    ],
    spars: [[0, -0.9, 0, 0.95], [0.2, -0.6, 0.9, -0.25], [-0.2, -0.6, -0.9, -0.25], [0.2, 0.3, 0.55, 0.6], [-0.2, 0.3, -0.55, 0.6]],
    decalQuad: [[-0.98, -0.92], [0.98, -0.92], [0.98, 0.95], [-0.98, 0.95]],
    tail: null,
    flap: { amp: 0.055, k: 2.6 },
    bridle: [0, -0.25],
  },

  /** 蜻蜓 · 软翅：四翼薄透、细尾长腰。 */
  dragonfly: {
    id: 'dragonfly', name: '蜻蜓', nameEn: 'Dragonfly', family: 'soft',
    size: 1.06,
    outline: [
      [0, -0.72], [0.14, -0.62], [0.5, -0.66], [0.95, -0.5], [1.0, -0.3],
      [0.7, -0.12], [0.2, -0.1], [0.75, 0.08], [0.72, 0.3], [0.25, 0.22],
      [0.12, 0.3], [0.1, 0.6], [0.06, 0.95], [0, 1],
      [-0.06, 0.95], [-0.1, 0.6], [-0.12, 0.3], [-0.25, 0.22], [-0.72, 0.3],
      [-0.75, 0.08], [-0.2, -0.1], [-0.7, -0.12], [-1.0, -0.3], [-0.95, -0.5], [-0.5, -0.66], [-0.14, -0.62],
    ],
    cells: [
      { role: 'head', poly: [[0, -0.72], [0.14, -0.62], [0.1, -0.42], [-0.1, -0.42], [-0.14, -0.62]] },
      { role: 'wing', poly: [[0.1, -0.5], [0.5, -0.66], [0.95, -0.5], [1.0, -0.3], [0.7, -0.12], [0.2, -0.1], [0.12, -0.25]] },
      { role: 'wing', poly: [[-0.1, -0.5], [-0.5, -0.66], [-0.95, -0.5], [-1.0, -0.3], [-0.7, -0.12], [-0.2, -0.1], [-0.12, -0.25]] },
      { role: 'tail', poly: [[0.12, -0.1], [0.75, 0.08], [0.72, 0.3], [0.25, 0.22], [0.14, 0.05]] },
      { role: 'tail', poly: [[-0.12, -0.1], [-0.75, 0.08], [-0.72, 0.3], [-0.25, 0.22], [-0.14, 0.05]] },
      { role: 'body', poly: [[-0.12, -0.35], [0.12, -0.35], [0.12, 0.3], [0.1, 0.6], [0.06, 0.95], [0, 1], [-0.06, 0.95], [-0.1, 0.6], [-0.12, 0.3]] },
    ],
    spars: [[0, -0.7, 0, 1], [0.1, -0.28, 0.95, -0.38], [-0.1, -0.28, -0.95, -0.38], [0.1, 0.12, 0.7, 0.2], [-0.1, 0.12, -0.7, 0.2]],
    decalQuad: [[-1.0, -0.66], [1.0, -0.66], [1.0, 0.3], [-1.0, 0.3]],
    tail: { attach: [[0, 1]], segs: 5, segLen: 0.08, bows: false, width: 2 },
    flap: { amp: 0.05, k: 3.2 },
    bridle: [0, -0.35],
  },

  /** 宫灯 · 立体：三片筒面，提梁流苏。 */
  lantern: {
    id: 'lantern', name: '宫灯', nameEn: 'Palace Lantern', family: 'box',
    size: 0.96,
    outline: [
      [-0.45, -1], [0.45, -1], [0.45, -0.8], [0.78, -0.55], [0.88, -0.1],
      [0.78, 0.4], [0.45, 0.8], [0.45, 1], [-0.45, 1], [-0.45, 0.8],
      [-0.78, 0.4], [-0.88, -0.1], [-0.78, -0.55], [-0.45, -0.8],
    ],
    cells: [
      { role: 'body', poly: [[-0.35, -0.92], [0.35, -0.92], [0.35, 0.92], [-0.35, 0.92]] },
      { role: 'panel', poly: [[0.35, -0.9], [0.78, -0.55], [0.88, -0.1], [0.78, 0.4], [0.35, 0.85], [0.35, 0.8], [0.42, 0.4], [0.5, -0.1], [0.42, -0.55], [0.35, -0.85]] },
      { role: 'panel', poly: [[-0.35, -0.9], [-0.78, -0.55], [-0.88, -0.1], [-0.78, 0.4], [-0.35, 0.85], [-0.35, 0.8], [-0.42, 0.4], [-0.5, -0.1], [-0.42, -0.55], [-0.35, -0.85]] },
    ],
    spars: [[-0.88, -0.1, 0.88, -0.1], [-0.78, 0.4, 0.78, 0.4], [-0.45, -1, 0.45, -1], [-0.45, 1, 0.45, 1]],
    decalQuad: [[-0.35, -0.9], [0.35, -0.9], [0.35, 0.9], [-0.35, 0.9]],
    tail: { attach: [[-0.4, 1], [0.4, 1]], segs: 6, segLen: 0.08, bows: true, width: 2.5 },
    flap: { amp: 0.025, k: 3.6 },
    bridle: [0, -0.3],
  },

  /** 飞龙 · 串式：龙首 + 腰节链（chain 配置），里程碑越长越长。 */
  dragonchain: {
    id: 'dragonchain', name: '飞龙', nameEn: 'Flying Dragon', family: 'chain',
    size: 1.15,
    outline: [
      [0, -1], [0.1, -0.93], [0.24, -0.97], [0.34, -0.82], [0.5, -0.92], [0.58, -0.75],
      [0.55, -0.58], [0.75, -0.68], [0.88, -0.5], [0.8, -0.3], [0.92, -0.12], [0.82, 0.08],
      [0.6, 0.12], [0.5, 0.32], [0.3, 0.4], [0.2, 0.62], [0.08, 0.82], [0, 0.88],
      [-0.08, 0.82], [-0.2, 0.62], [-0.3, 0.4], [-0.5, 0.32], [-0.6, 0.12], [-0.82, 0.08],
      [-0.92, -0.12], [-0.8, -0.3], [-0.88, -0.5], [-0.75, -0.68], [-0.55, -0.58],
      [-0.58, -0.75], [-0.5, -0.92], [-0.34, -0.82], [-0.24, -0.97], [-0.1, -0.93],
    ],
    cells: [
      { role: 'head', poly: [[0, -0.9], [0.14, -0.8], [0.34, -0.82], [0.3, -0.6], [-0.3, -0.6], [-0.34, -0.82], [-0.14, -0.8]] },
      { role: 'wing', poly: [[0.14, -0.5], [0.62, -0.62], [0.8, -0.28], [0.7, 0.02], [0.44, 0.1], [0.12, -0.18]] },
      { role: 'wing', poly: [[-0.14, -0.5], [-0.62, -0.62], [-0.8, -0.28], [-0.7, 0.02], [-0.44, 0.1], [-0.12, -0.18]] },
      { role: 'body', poly: [[-0.16, -0.5], [0.16, -0.5], [0.28, 0.1], [0.14, 0.62], [0, 0.72], [-0.14, 0.62], [-0.28, 0.1]] },
    ],
    spars: [[0, -1, 0, 0.72], [0.2, -0.5, 0.7, -0.1], [-0.2, -0.5, -0.7, -0.1], [-0.24, 0.12, 0.24, 0.12]],
    decalQuad: [[-0.6, -0.85], [0.6, -0.85], [0.6, 0.55], [-0.6, 0.55]],
    tail: null,
    chain: { segs: [9, 13], segLen: 0.62, segSize: 0.5, anchor: [0, 0.86] },
    flap: { amp: 0.03, k: 3.0 },
    bridle: [0, -0.35],
  },

  /** 蝉 · 板式：薄翼蝉筝，潍坊名品的小品。 */
  cicada: {
    id: 'cicada', name: '蝉', nameEn: 'Cicada', family: 'board',
    size: 1.0,
    outline: [
      [0, -0.95], [0.3, -0.85], [0.62, -0.6], [0.85, -0.25], [0.92, 0.1], [0.72, 0.45],
      [0.4, 0.68], [0.12, 0.85], [0, 0.92], [-0.12, 0.85], [-0.4, 0.68], [-0.72, 0.45],
      [-0.92, 0.1], [-0.85, -0.25], [-0.62, -0.6], [-0.3, -0.85],
    ],
    cells: [
      { role: 'head', poly: [[0, -0.9], [0.22, -0.72], [0.14, -0.5], [-0.14, -0.5], [-0.22, -0.72]] },
      { role: 'wing', poly: [[0.08, -0.42], [0.62, -0.52], [0.88, -0.18], [0.66, 0.28], [0.32, 0.44], [0.06, 0.1]] },
      { role: 'wing', poly: [[-0.08, -0.42], [-0.62, -0.52], [-0.88, -0.18], [-0.66, 0.28], [-0.32, 0.44], [-0.06, 0.1]] },
      { role: 'body', poly: [[-0.12, -0.45], [0.12, -0.45], [0.14, 0.35], [0, 0.85], [-0.14, 0.35]] },
    ],
    spars: [[0, -0.9, 0, 0.85], [0.08, -0.3, 0.62, 0.1], [-0.08, -0.3, -0.62, 0.1]],
    decalQuad: [[-0.85, -0.8], [0.85, -0.8], [0.85, 0.75], [-0.85, 0.75]],
    tail: { attach: [[0, 0.9]], segs: 8, segLen: 0.09, bows: false, width: 2.5 },
    flap: { amp: 0.045, k: 2.8 },
    bridle: [0, -0.3],
  },

  /** 热带鱼 · 软翅：大头左、扇尾右，游在风里。 */
  tropicalfish: {
    id: 'tropicalfish', name: '热带鱼', nameEn: 'Coral Fish', family: 'soft',
    size: 1.02,
    outline: [
      [-0.95, 0.02], [-0.8, -0.35], [-0.5, -0.58], [-0.15, -0.6], [0.2, -0.45],
      [0.45, -0.15], [0.5, 0.12], [0.38, 0.4], [0.12, 0.55], [0.28, 0.62], [0.45, 0.92],
      [0.75, 0.88], [0.92, 0.7], [0.85, 0.35], [0.55, -0.05], [0.28, -0.42],
      [-0.05, -0.55], [-0.4, -0.5], [-0.68, -0.32],
    ],
    cells: [
      { role: 'head', poly: [[-0.92, 0.02], [-0.72, -0.32], [-0.45, -0.5], [-0.3, -0.2], [-0.32, 0.18], [-0.55, 0.38], [-0.78, 0.28]] },
      { role: 'body', poly: [[-0.3, -0.5], [0.1, -0.55], [0.38, -0.3], [0.48, 0.05], [0.36, 0.35], [0.1, 0.52], [-0.25, 0.5], [-0.32, 0.15], [-0.3, -0.2]] },
      { role: 'tail', poly: [[0.14, 0.5], [0.3, 0.6], [0.45, 0.9], [0.72, 0.85], [0.88, 0.68], [0.8, 0.32], [0.5, -0.02], [0.2, 0.3]] },
    ],
    spars: [[-0.6, 0, 0.3, 0], [-0.3, -0.3, 0.2, 0.3]],
    decalQuad: [[-0.85, -0.5], [0.35, -0.5], [0.35, 0.5], [-0.85, 0.5]],
    tail: { attach: [[0.12, 0.55]], segs: 6, segLen: 0.08, bows: false, width: 2 },
    flap: { amp: 0.05, k: 2.6 },
    bridle: [-0.4, 0],
  },

    /** 龙头 · 硬翅：致敬传统龙首风筝。 */
  dragonhead: {
    id: 'dragonhead', name: '龙头', nameEn: 'Dragon Head', family: 'hard',
    size: 1.02,
    outline: [
      [0, -0.9], [0.06, -0.95], [0.18, -1], [0.26, -0.78], [0.4, -0.9],
      [0.46, -0.62], [0.74, -0.5], [0.82, -0.15], [0.48, 0.1], [0.28, 0.3],
      [0.16, 0.55], [0, 0.72],
      [-0.16, 0.55], [-0.28, 0.3], [-0.48, 0.1], [-0.82, -0.15], [-0.74, -0.5],
      [-0.46, -0.62], [-0.4, -0.9], [-0.26, -0.78], [-0.18, -1], [-0.06, -0.95],
    ],
    cells: [
      { role: 'head', poly: [[0, -0.9], [0.06, -0.95], [0.18, -1], [0.26, -0.78], [0.4, -0.9], [0.46, -0.62], [0.3, -0.4], [-0.3, -0.4], [-0.46, -0.62], [-0.4, -0.9], [-0.26, -0.78], [-0.18, -1], [-0.06, -0.95]] },
      { role: 'wing', poly: [[0.06, -0.35], [0.46, -0.62], [0.74, -0.5], [0.82, -0.15], [0.48, 0.1], [0.28, 0.3], [0.12, 0.15]] },
      { role: 'wing', poly: [[-0.06, -0.35], [-0.46, -0.62], [-0.74, -0.5], [-0.82, -0.15], [-0.48, 0.1], [-0.28, 0.3], [-0.12, 0.15]] },
      { role: 'body', poly: [[-0.12, 0.05], [0.12, 0.05], [0.16, 0.55], [0, 0.72], [-0.16, 0.55]] },
    ],
    spars: [[0, -1, 0, 0.72], [0.2, -0.6, 0.78, -0.2], [-0.2, -0.6, -0.78, -0.2], [-0.4, 0.1, 0.4, 0.1]],
    decalQuad: [[-0.82, -0.9], [0.82, -0.9], [0.82, 0.72], [-0.82, 0.72]],
    tail: { attach: [[0, 0.7], [-0.48, 0.05], [0.48, 0.05]], segs: 14, segLen: 0.095, bows: true, width: 3.2 },
    flap: { amp: 0.04, k: 3.0 },
    bridle: [0, -0.3],
  },
}

/** 骨架家族的展示名（面板与状态栏用）。 */
const FAMILY_ZH = { hard: '硬翅', soft: '软翅', board: '板子', box: '立体', chain: '串式' }
const FAMILY_EN = { hard: 'Hard-wing', soft: 'Soft-wing', board: 'Board', box: 'Cellular', chain: 'Chain train' }

// ── 卡组：骨架 × 图案 × 配色的策展组合 ──────────────────────────────────
// pattern        主图案（所有分区缺省）
// cellPatterns   按 role 覆盖图案（head/wing/body/tail/panel/core）
// palette        主配色；rolePalettes 按 role 覆盖
function card(partial) {
  return Object.assign({
    rarity: 1,
    flavor: '',
    cellPatterns: null,
    rolePalettes: null,
    tailScale: 1,
  }, partial)
}

const ALL_CARDS = [
  card({
    id: 'shayan-azurite', name: '沙燕·青云', nameEn: 'Azure Swallow',
    frame: 'shayan', pattern: 'face', palette: PALETTES.azurite,
    cellPatterns: { head: 'face', wing: 'cloud', body: 'stripe' },
    rarity: 1, flavor: '青底白云的沙燕，剪刀似的尾巴裁开春风。',
  }),
  card({
    id: 'shayan-cinnabar', name: '沙燕·朱梅', nameEn: 'Plum Swallow',
    frame: 'shayan', pattern: 'plum', palette: PALETTES.cinnabar,
    cellPatterns: { head: 'face', wing: 'plum', body: 'stripe' },
    rolePalettes: { body: PALETTES.pearl },
    rarity: 2, flavor: '朱砂底上点梅花，燕子衔春到檐前。',
  }),
  card({
    id: 'goldfish-cinnabar', name: '金鱼·朱鳞', nameEn: 'Vermilion Goldfish',
    frame: 'goldfish', pattern: 'scale', palette: PALETTES.cinnabar,
    cellPatterns: { head: 'face', wing: 'scale', tail: 'wave' },
    rarity: 1, flavor: '朱红鳞片层层叠叠，尾巴一摆就是一池春水。',
  }),
  card({
    id: 'goldfish-golden', name: '金鱼·金鳞', nameEn: 'Golden Goldfish',
    frame: 'goldfish', pattern: 'scale', palette: PALETTES.golden,
    cellPatterns: { head: 'face', wing: 'scale', tail: 'wave' },
    rolePalettes: { tail: PALETTES.persimmon },
    rarity: 3, flavor: '金鳞岂是池中物，一遇风云便化龙。',
  }),
  card({
    id: 'butterfly-ray', name: '蝴蝶·霞光', nameEn: 'Sunset Butterfly',
    frame: 'butterfly', pattern: 'ray', palette: PALETTES.plumPink,
    cellPatterns: { wing: 'ray', tail: 'dotstar', body: 'stripe' },
    rarity: 1, flavor: '双翅染着晚霞的放射光，飞起来像一小片黄昏。',
  }),
  card({
    id: 'butterfly-dotstar', name: '蝴蝶·夜巡', nameEn: 'Starry Butterfly',
    frame: 'butterfly', pattern: 'dotstar', palette: PALETTES.violet,
    cellPatterns: { wing: 'dotstar', tail: 'dotstar', body: 'stripe' },
    rarity: 2, flavor: '紫夜里撒满星子的蝴蝶，白天也提着一身星光。',
  }),
  card({
    id: 'butterfly-plum', name: '蝴蝶·粉梅', nameEn: 'Plum Butterfly',
    frame: 'butterfly', pattern: 'plum', palette: PALETTES.pearl,
    cellPatterns: { wing: 'plum', tail: 'plum', body: 'stripe' },
    rarity: 2, flavor: '月白翅上几点粉梅，落在谁家墙头都是画。',
  }),
  card({
    id: 'eagle-ink', name: '老鹰·墨羽', nameEn: 'Ink Eagle',
    frame: 'eagle', pattern: 'feather', palette: PALETTES.inkwash,
    cellPatterns: { wing: 'feather', tail: 'feather', head: 'face' },
    rarity: 2, flavor: '一身墨色的翎羽，盘在最高处，不叫也自威。',
  }),
  card({
    id: 'eagle-kingfisher', name: '老鹰·翠翎', nameEn: 'Kingfisher Eagle',
    frame: 'eagle', pattern: 'feather', palette: PALETTES.kingfisher,
    cellPatterns: { wing: 'feather', tail: 'wave', head: 'face' },
    rarity: 4, flavor: '翠蓝的翎羽少见得很，放飞它的人都说是好兆头。',
  }),
  card({
    id: 'diamond-stripe', name: '菱形·黄布棱', nameEn: 'Golden Diamond',
    frame: 'diamond', pattern: 'stripe', palette: PALETTES.golden,
    rarity: 1, flavor: '最朴素也最耐放的黄布棱，竹骨一绷就上天的老伙计。',
  }),
  card({
    id: 'diamond-peony', name: '菱形·牡丹', nameEn: 'Peony Diamond',
    frame: 'diamond', pattern: 'peony', palette: PALETTES.cinnabar,
    rarity: 2, flavor: '菱形骨上开一朵大牡丹，谁说素面朝天才好看。',
  }),
  card({
    id: 'diamond-dotstar', name: '菱形·星子', nameEn: 'Starry Diamond',
    frame: 'diamond', pattern: 'dotstar', palette: PALETTES.indigo,
    rarity: 2, flavor: '靛蓝的夜空裁成菱形，撒一把星子就飞上天。',
  }),
  card({
    id: 'bagua-wave', name: '八卦·海水面', nameEn: 'Sea Bagua',
    frame: 'bagua', pattern: 'wave', palette: PALETTES.indigo,
    cellPatterns: { body: 'wave', core: 'ray' },
    rarity: 2, flavor: '八卦亭盖上绘着海水面，插两支穗子镇八方。',
  }),
  card({
    id: 'hexagon-ray', name: '六角·日轮', nameEn: 'Sunwheel Hexagon',
    frame: 'hexagon', pattern: 'ray', palette: PALETTES.jade,
    cellPatterns: { body: 'stripe', core: 'ray' },
    rarity: 2, flavor: '六角骨撑起一轮日轮，老辈人说它放走霉运。',
  }),
  card({
    id: 'round-cloud', name: '圆月·祥云', nameEn: 'Moon & Clouds',
    frame: 'round', pattern: 'cloud', palette: PALETTES.pearl,
    cellPatterns: { body: 'cloud', core: 'peony' },
    rolePalettes: { core: PALETTES.plumPink },
    rarity: 3, flavor: '月白的圆月绕着祥云，放上去就是把月亮还给自己。',
  }),
  card({
    id: 'round-azurite', name: '圆月·石青', nameEn: 'Azurite Moon',
    frame: 'round', pattern: 'ray', palette: PALETTES.azurite,
    cellPatterns: { body: 'wave', core: 'dotstar' },
    rarity: 3, flavor: '石青的月轮心撒着星子，白日里也像一小片夜空。',
  }),
  card({
    id: 'bat-plumpink', name: '蝙蝠·福到', nameEn: 'Fortune Bat',
    frame: 'bat', pattern: 'dotstar', palette: PALETTES.plumPink,
    cellPatterns: { head: 'face', wing: 'dotstar' },
    rarity: 2, flavor: '蝠临＝福到。桃红蝙蝠往窗上一挂，福气就进家门。',
  }),
  card({
    id: 'dragonfly-jade', name: '蜻蜓·翠玉', nameEn: 'Jade Dragonfly',
    frame: 'dragonfly', pattern: 'feather', palette: PALETTES.jade,
    cellPatterns: { wing: 'feather', tail: 'feather', head: 'face', body: 'stripe' },
    rarity: 2, flavor: '四片薄翼染着翠色，飞起来轻轻颤，像要一直颤进夏天。',
  }),
  card({
    id: 'lantern-persimmon', name: '宫灯·柿纹', nameEn: 'Persimmon Lantern',
    frame: 'lantern', pattern: 'stripe', palette: PALETTES.persimmon,
    cellPatterns: { body: 'stripe', panel: 'stripe' },
    rolePalettes: { panel: PALETTES.cinnabar },
    rarity: 3, flavor: '三面筒纹的宫灯风筝，提梁上还坠着两只流苏。',
  }),
  card({
    id: 'dragonhead-golden', name: '龙头·金云', nameEn: 'Golden Dragon',
    frame: 'dragonhead', pattern: 'cloud', palette: PALETTES.golden,
    cellPatterns: { head: 'face', wing: 'cloud', body: 'stripe' },
    rarity: 5, flavor: '金鳞龙首，金云绕角——潍坊风筝会上最气派的那一只。',
  }),
  card({
    id: 'dragonhead-cinnabar', name: '龙头·朱霞', nameEn: 'Crimson Dragon',
    frame: 'dragonhead', pattern: 'wave', palette: PALETTES.cinnabar,
    cellPatterns: { head: 'face', wing: 'wave', body: 'stripe' },
    rarity: 4, flavor: '朱红的龙头披着海水纹，长长的节链甩过半边天。',
  }),
  card({
    id: 'dragonchain-golden', name: '飞龙·金鳞', nameEn: 'Golden Dragon',
    frame: 'dragonchain', pattern: 'cloud', palette: PALETTES.golden,
    cellPatterns: { head: 'face', wing: 'cloud', body: 'stripe' },
    rarity: 5, flavor: '金鳞飞龙昂首摆尾，腰节过处鳞光耀日——风筝会上最长的那一条。',
  }),
  card({
    id: 'dragonchain-jade', name: '飞龙·翠鳞', nameEn: 'Jade Dragon',
    frame: 'dragonchain', pattern: 'scale', palette: PALETTES.jade,
    cellPatterns: { head: 'face', wing: 'cloud', body: 'stripe' },
    rolePalettes: { body: PALETTES.kingfisher },
    rarity: 5, flavor: '青翠腰节随风起伏，百足游云。',
  }),
  card({
    id: 'rainbow-round', name: '七彩鲢·虹', nameEn: 'Spectrum Round',
    frame: 'round', pattern: 'spectrum', palette: PALETTES.azurite,
    dynamicHue: true,
    rarity: 4, flavor: '七彩鲢迎风变色，你越忙它流转得越急。',
  }),
  card({
    id: 'cicada-ink', name: '蝉·墨玉', nameEn: 'Ink Cicada',
    frame: 'cicada', pattern: 'feather', palette: PALETTES.inkwash,
    cellPatterns: { head: 'face', wing: 'feather', body: 'stripe' },
    rarity: 3, flavor: '薄翼蝉筝，一线牵引，鸣声在纸。',
  }),
  card({
    id: 'tropical-coral', name: '热带鱼·珊瑚', nameEn: 'Coral Fish',
    frame: 'tropicalfish', pattern: 'scale', palette: PALETTES.plumPink,
    cellPatterns: { head: 'face', body: 'scale', tail: 'wave' },
    rarity: 3, flavor: '珊瑚色热带鱼，大尾如扇，游在风里。',
  }),
]

const FRAMES_BY_ID = {}
for (const f of Object.values(FRAMES)) FRAMES_BY_ID[f.id] = f
const PATTERNS_BY_ID = PATTERNS

const CARDS_BY_FRAME = {}
for (const c of ALL_CARDS) {
  if (!CARDS_BY_FRAME[c.frame]) CARDS_BY_FRAME[c.frame] = []
  CARDS_BY_FRAME[c.frame].push(c)
}

/**
 * 洗牌袋抽取：换风筝时从启用卡池不放回地抽，绝不与上一只重复。
 * 稀有度实现与 dsh-fireworks 同款：入袋概率 min(1, 2.2/rarity)，
 * 袋内按 -ln(u)·rarity 加权排序。bagState 由调用方持有。
 */
function refillBag(pool, rng, exclude) {
  let candidates = pool
  if (exclude && exclude.size > 0 && exclude.size < pool.length) {
    candidates = pool.filter((c) => !exclude.has(c))
  }
  let bag = candidates.filter((c) => rng() < Math.min(1, 2.2 / c.rarity))
  if (bag.length === 0) bag = candidates.slice()
  return bag
    .map((c) => ({ c, key: -Math.log(Math.max(rng(), 1e-9)) * c.rarity }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.c)
}

function pickVariants(pool, count, rng, bagState, enabledSet) {
  const frames = pool || ALL_CARDS
  const usable = typeof enabledSet === 'function' ? frames.filter(enabledSet) : (Array.isArray(frames) ? frames : ALL_CARDS)
  if (usable.length === 0 || count <= 0) return []
  if (!bagState.list || bagState.list.length === 0) {
    bagState.list = refillBag(usable, rng)
  }
  const out = []
  const drawn = new Set()
  while (out.length < count) {
    if (bagState.list.length === 0) {
      bagState.list = refillBag(usable, rng, drawn)
      const nb = bagState.list
      if (nb.length > 1 && nb[0] === out[out.length - 1]) nb.push(nb.shift())
    }
    const next = bagState.list.shift()
    out.push(next)
    drawn.add(next)
  }
  return out
}

/**
 * resolveCard —— 卡 → 落定谱（KiteSpec）。mag∈[0,1]（活动度），
 * rng 为 mulberry32 实例。产出引擎可直接消费的纯数值对象。
 */
function resolveCard(c, mag, rng) {
  const frame = FRAMES_BY_ID[c.frame]
  const r = (range, curve, jitter) => ranged(range, mag, rng, curve, jitter == null ? 0.1 : jitter)
  return {
    cardId: c.id,
    name: c.name,
    nameEn: c.nameEn,
    flavor: c.flavor,
    rarity: c.rarity,
    dynamicHue: !!c.dynamicHue,
    frame,
    size: frame.size * r([0.94, 1.1], 'linear'),
    flapAmp: frame.flap.amp * r([0.9, 1.2], 'linear'),
    flapK: frame.flap.k,
    tail: frame.tail ? {
      attach: frame.tail.attach,
      segs: Math.max(4, Math.round(frame.tail.segs * r([0.85, 1.15], 'linear') * (c.tailScale || 1))),
      segLen: frame.tail.segLen,
      bows: frame.tail.bows,
      width: frame.tail.width,
    } : null,
    chain: frame.chain ? {
      segs: Math.max(5, Math.round(r(frame.chain.segs, 'linear'))),
      segLen: frame.chain.segLen,
      segSize: frame.chain.segSize,
      anchor: frame.chain.anchor,
    } : null,
  }
}

// ── 帆面绘制（纹理构建与缩略图共用）─────────────────────────────────────
/**
 * paintSail：把一张卡完整画在 2D 上下文上（图案分区 → 竹条 → 描边）。
 * env: { g, w, h, card, tone('dark'|'light'), rng, opts{ sparAlpha, outline } }
 * 用于：引擎离屏纹理、设置页缩略图、node 存根测试。
 */
function paintSail(env) {
  const { g, w, h, card: c, tone } = env
  const frame = FRAMES_BY_ID[c.frame]
  const rng = env.rng || mulberry32(1)
  const scale = Math.min(w, h) * 0.46 * frame.size
  const ox = w / 2
  const oy = h / 2
  const P = (u, v) => [ox + u * scale, oy + v * scale]
  const ink = tone === 'light' ? [225, 18, 16] : [230, 25, 88]
  const paper = tone === 'light' ? [42, 20, 97] : [45, 26, 93]

  // 底纸：帆面先铺一层素纸色，图案画其上
  pathPoly(g, frame.outline, P)
  g.fillStyle = hsl(...paper)
  g.fill()

  for (const cell of frame.cells) {
    const bb = polyBBox(cell.poly)
    const role = cell.role
    const patternId = (c.cellPatterns && c.cellPatterns[role]) || c.pattern || 'stripe'
    const painter = PATTERNS_BY_ID[patternId] || PATTERNS.stripe
    const pal = (c.rolePalettes && c.rolePalettes[role]) || c.palette || PALETTES.golden
    // 分区局部映射：画师的 (u,v)∈[-1,1] 指分区自身包围盒，而非整帆
    const cx = (bb.x0 + bb.x1) / 2
    const cy = (bb.y0 + bb.y1) / 2
    const hw = (bb.x1 - bb.x0) / 2 * scale
    const hh = (bb.y1 - bb.y0) / 2 * scale
    const Pc = (u, v) => [ox + (cx + u * (bb.x1 - bb.x0) / 2) * scale, oy + (cy + v * (bb.y1 - bb.y0) / 2) * scale]
    pathPoly(g, cell.poly, P)
    g.save()
    g.clip()
    // 底洗：先用本分区配色铺一层淡色底，素纸与图案之间有个色相过渡
    pathPoly(g, cell.poly, P)
    g.fillStyle = hsl(pal[0][0], Math.min(70, pal[0][1] * 0.45), Math.min(92, pal[0][2] + 24), 0.65)
    g.fill()
    painter({ g, P: Pc, hw, hh, rng, pal, ink, role })
    g.restore()
  }

  // 竹条
  g.strokeStyle = hsl(...(tone === 'light' ? [30, 45, 30] : [35, 42, 34]))
  g.lineWidth = Math.max(1, scale * 0.028)
  g.lineCap = 'round'
  for (const s of frame.spars) {
    const a = P(s[0], s[1]); const b = P(s[2], s[3])
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke()
  }

  // 描边（外轮廓 + 分区细线）
  g.strokeStyle = hsl(ink[0], ink[1], ink[2])
  g.lineWidth = Math.max(1.2, scale * 0.03)
  pathPoly(g, frame.outline, P)
  g.stroke()
  g.lineWidth = Math.max(0.6, scale * 0.012)
  g.strokeStyle = hsl(ink[0], ink[1], ink[2], 0.45)
  for (const cell of frame.cells) {
    pathPoly(g, cell.poly, P)
    g.stroke()
  }
}

const KiteCards = {
  FRAMES,
  FRAMES_BY_ID,
  FAMILY_ZH,
  FAMILY_EN,
  PATTERNS,
  PATTERNS_BY_ID,
  PALETTES,
  ALL_CARDS,
  CARDS_BY_FRAME,
  mulberry32,
  ranged,
  magnitudeOf,
  pickVariants,
  resolveCard,
  pathPoly,
  polyBBox,
  paintSail,
  paintSegment,
}

if (typeof module !== 'undefined' && module.exports) module.exports = KiteCards
/* node-test-export-end */
