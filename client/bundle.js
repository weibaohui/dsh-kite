/* Generated from client/kite-cards.js + client/kite-engine.js + client/index.js by scripts/build-client.mjs — do not edit by hand.
 * Regenerate with: npm run build:client
 */
window.__ModuleLoader__.load({
  id: "@weibaohui/dsh-kite",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })
    var React = require("react")
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


    /* node-test-export-end */

    /**
     * @weibaohui/dsh-plugin-kit — client source（由消费者构建脚本内联进 bundle，
     * 不经 loader 运行时加载）。对外暴露 PluginKit：
     *
     *   PluginKit.substituteParams(template, params)   — {{key}} 模板插值
     *   PluginKit.makeActionShareDialog(React, opts)   — 返回 ActionShareDialog 组件
     *
     * ActionShareDialog props：
     *   title / hint / rows: [[label, value], ...] / initialPrompt
     *   params: [{ key, label?, placeholder?, multiline?, value? }]  — 可选；模板参数
     *     输入区（idle 态渲染在 prompt 上方），值实时替换进 prompt 的 {{key}} 占位符
     *   completedView: ({ job, output, close, retry }) => node  — 可选；完成态插槽，
     *     提供后 job done 不再渲染默认「输出原文」，改由插槽全权负责（如解析 AI 输出
     *     成可编辑表单 + 创建按钮），Dialog footer 同时置空，操作按钮由插槽自承
     *   run: async (prompt) => { jobId }      — 发起执行
     *   poll: async (jobId) => { status, output, code }
     *   labels: { copy, copied, run, running, done, failed, outputLabel, openSession, close }
     *   onOpenSession: (sessionId) => void                — 可选；job 出现 sessionId 时渲染「打开会话」
     *   onClose
     *
     * 全部样式内联（主题 token + 回退值），消费者无需自带 CSS。
     */
    var PluginKit = (function () {
      function substituteParams(template, params) {
        var out = String(template || '')
        for (var key in (params || {})) out = out.split('{{' + key + '}}').join(String(params[key]))
        return out
      }

      function makeActionShareDialog(React, options) {
        options = options || {}
        var h = React.createElement
        var useState = React.useState
        var useEffect = React.useEffect
        var useRef = React.useRef
        var doFetch = options.fetch || (typeof fetch !== 'undefined' ? fetch : null)
        var inputStyle = { width: '100%', minHeight: 190, resize: 'vertical', fontFamily: 'var(--dsw-font-family)', lineHeight: 1.6, fontSize: 12, background: 'var(--dsw-alias-bg-layer-2,transparent)', color: 'inherit', border: '1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3))', borderRadius: '8px', padding: '10px', boxSizing: 'border-box' }
        var paramStyle = { width: '100%', fontFamily: 'var(--dsw-font-family)', lineHeight: 1.5, fontSize: 13, background: 'var(--dsw-alias-bg-layer-2,transparent)', color: 'inherit', border: '1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3))', borderRadius: '8px', padding: '6px 10px', boxSizing: 'border-box' }
        var btnStyle = { background: 'transparent', color: 'inherit', border: '1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3))', borderRadius: '8px', padding: '5px 12px', fontSize: 13, cursor: 'pointer', font: 'inherit' }
        // 主按钮亮暗跟随：与 skills-management .sk-btn-primary 同款 token 组合
        var primaryStyle = Object.assign({}, btnStyle, { background: 'var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary,#4a7dff))', borderColor: 'transparent', color: 'var(--dsw-alias-label-primary-inverted,#fff)' })

        return function ActionShareDialog(props) {
          var title = props.title
          var hint = props.hint
          var labels = props.labels || {}
          // 模板参数定义（[{key,label,placeholder,multiline,value}]）→ 值表
          var paramDefs = Array.isArray(props.params) ? props.params : []
          var initialParamValues = {}
          for (var pi = 0; pi < paramDefs.length; pi++) {
            var def = paramDefs[pi]
            initialParamValues[def.key] = def.value !== undefined && def.value !== null ? String(def.value) : ''
          }
          var _pv = useState(initialParamValues)
          var paramValues = _pv[0]; var setParamValues = _pv[1]
          var _p = useState(props.initialPrompt || '')
          var prompt = _p[0]; var setPrompt = _p[1]
          // 「上次自动生成的 prompt」ref 镜像：effect 里比较当前 prompt 是否等于它，
          // 判断用户是否手动编辑过——未手改则参数/模板变化可安全覆盖，手改过则保留
          // 手动编辑（ntd ActionButton 的 lastGenerated 同款规则）。旧 dirty 单标记
          // 无法表达「手改后又想让参数替换生效」的场景，且要同时服务 initialPrompt
          // 异步到位的跟随行为，故统一收敛到这一处比较。
          var lastGeneratedRef = useRef(null)
          var _j = useState(null)
          var job = _j[0]; var setJob = _j[1]
          var _b = useState(false)
          var busy = _b[0]; var setBusy = _b[1]
          var _c = useState(false)
          var copied = _c[0]; var setCopied = _c[1]
          var _e = useState('')
          var error = _e[0]; var setError = _e[1]

          // 参数值/模板变化 → 重新生成 prompt；仅当用户未手改时覆盖
          useEffect(function () {
            var generated = substituteParams(props.initialPrompt || '', paramValues)
            var userEdited = lastGeneratedRef.current !== null && prompt !== lastGeneratedRef.current
            lastGeneratedRef.current = generated
            if (!userEdited) setPrompt(generated)
          }, [props.initialPrompt, paramValues])

          useEffect(function () {
            if (job === null || job.status !== 'running' || typeof props.poll !== 'function') return
            var timer = setInterval(function () {
              props.poll(job.jobId).then(function (d) {
                setJob({ jobId: job.jobId, status: d.status, output: d.output || '', code: d.code !== undefined ? d.code : null, sessionId: d.sessionId })
              }).catch(function () {})
            }, 1500)
            return function () { clearInterval(timer) }
          }, [job !== null && job.jobId])

          var setParam = function (key, value) {
            setParamValues(function (prev) {
              var next = {}
              for (var k in prev) next[k] = prev[k]
              next[key] = value
              return next
            })
          }

          var doRun = function () {
            if (typeof props.run !== 'function') return
            setBusy(true); setError('')
            props.run(prompt).then(function (r) {
              setJob({ jobId: r.jobId, status: 'running', output: '', code: null })
            }).catch(function (e) { setError(String(e && e.message)) }).finally(function () { setBusy(false) })
          }
          var canOpenSession = typeof props.onOpenSession === 'function' && job !== null && job.sessionId
          var openSession = function () { props.onOpenSession(job.sessionId) }
          var copy = function () {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(prompt).then(function () { setCopied(true); setTimeout(function () { setCopied(false) }, 1500) }).catch(function () {})
            }
          }
          var statusText = job === null ? '' : job.status === 'running' ? (labels.running || 'running') : job.status === 'done' ? (labels.done || 'done') : (labels.failed || 'failed') + (job.code != null ? ' (' + job.code + ')' : '')
          // 完成态插槽：提供后 job done 由插槽全权渲染（footer 置空，操作按钮插槽自承）
          var completedSlot = typeof props.completedView === 'function' && job !== null && job.status === 'done'

          return h('div', { onClick: function (e) { if (e.target === e.currentTarget && props.onClose) props.onClose() }, style: { position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
            h('div', { style: { width: 'min(640px,92vw)', maxHeight: '86vh', overflow: 'auto', background: 'var(--dsw-alias-bg-layer-1,#fff)', border: '1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3))', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--dsw-alias-label-primary,inherit)', font: 'var(--dsw-font-family,inherit)' } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                h('div', { style: { fontSize: 17, fontWeight: 600 } }, title || ''),
                h('button', { onClick: props.onClose, style: Object.assign({}, btnStyle, { marginLeft: 'auto', width: 28, height: 28, padding: 0, borderRadius: 28 }) }, '✕')),
              hint ? h('div', { style: { fontSize: 12, opacity: .7 } }, hint) : null,
              // 模板参数输入区（idle 态；值实时替换进 prompt，位于 prompt 上方与 ntd 同布局）
              paramDefs.length > 0 ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
                paramDefs.map(function (d) {
                  return h('label', { key: d.key, style: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, opacity: .85 } },
                    h('span', null, d.label || d.key),
                    d.multiline
                      ? h('textarea', { value: paramValues[d.key] || '', placeholder: d.placeholder || '', onChange: function (e) { setParam(d.key, e.target.value) }, spellCheck: false, style: Object.assign({}, paramStyle, { minHeight: 64, resize: 'vertical' }) })
                      : h('input', { value: paramValues[d.key] || '', placeholder: d.placeholder || '', onChange: function (e) { setParam(d.key, e.target.value) }, style: paramStyle }))
                })) : null,
              (props.rows || []).length > 0 ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 } },
                props.rows.map(function (r, i) {
                  return r[1] ? h('div', { key: i }, h('b', null, r[0] + '：'), h('span', null, r[1])) : null
                })) : null,
              h('textarea', { value: prompt, onChange: function (e) { setPrompt(e.target.value) }, spellCheck: false, style: inputStyle }),
              error !== '' ? h('div', { style: { fontSize: 12, color: 'var(--dsw-alias-state-error,#c75050)' } }, error) : null,
              completedSlot
                ? props.completedView({ job: job, output: job.output || '', close: props.onClose, retry: doRun })
                : (job !== null ? h('div', null,
                    h('div', { style: { fontSize: 12, opacity: .7, margin: '4px 0' } }, (labels.outputLabel || 'Output') + ' · ' + statusText),
                    h('pre', { style: { maxHeight: 220, margin: 0, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 12, background: 'var(--dsw-alias-bg-layer-2,transparent)', border: '1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2))', borderRadius: '8px', padding: '8px' } }, job.output || '…')) : null),
              completedSlot ? null : h('div', { style: { display: 'flex', gap: 8 } },
                canOpenSession ? h('button', { onClick: openSession, style: btnStyle }, labels.openSession || 'Open chat') : null,
                h('button', { onClick: copy, style: btnStyle }, copied ? (labels.copied || 'Copied') : (labels.copy || 'Copy')),
                h('button', { onClick: doRun, disabled: busy || (job !== null && job.status === 'running'), style: primaryStyle }, job !== null && job.status === 'running' ? (labels.running || 'Running…') : (labels.run || 'Run')))))
        }
      }

      // ── 共享事件推送枢纽 ─────────────────────────────────────────────────
      // 解决:dsh web 网关是 HTTP/1.1,同源并发只有 ~6 条连接,每个插件自建
      // 永久 SSE 会把预算占满、首页全部排队。全页面只开**一条**事件通道
      // (WebSocket 优先,握手后豁免于连接预算;连续 3 次握手失败自动降级
      // SSE 总线),按帧里的 plugin 字段分发。服务端由任意消费者经
      // PluginKit.ensureHostHub(ctx, {webServer, connection}) 协调出唯一路由
      // (本包 src/index.js)。
      //
      // 关键实现约束:**总线状态必须挂 window.__dshEventHub**,不能放本文件
      // 模块作用域——每个消费者 bundle 都内联一份本源码,模块状态是每副本
      // 独立的,只有 window 上的状态能跨副本共享(否则每插件各开一条 ws)。
      var HUB_WS_PATH = '/dsh-event-hub/ws'
      var HUB_SSE_PATH = '/dsh-event-hub/api/stream'

      function hubState() {
        if (!window.__dshEventHub) {
          window.__dshEventHub = {
            subscribers: new Map(), // plugin -> Set<fn(data, frame)>
            started: false,
            ws: null,
            wsAttempts: 0,
            sse: null,
          }
        }
        return window.__dshEventHub
      }

      function hubDispatch(data, frame) {
        var st = hubState()
        var set = st.subscribers.get(frame.plugin)
        if (!set) return
        set.forEach(function (fn) {
          try { fn(data, frame) } catch (e) { /* 单个订阅者出错不影响其他 */ }
        })
      }

      function hubSubscribe(plugin, fn) {
        var st = hubState()
        var set = st.subscribers.get(plugin)
        if (!set) { set = new Set(); st.subscribers.set(plugin, set) }
        set.add(fn)
        return function () { st.subscribers.get(plugin).delete(fn) }
      }

      /** SSE 兜底总线(老宿主 ws 不可用/连续握手失败时)。 */
      function startSseHub() {
        var st = hubState()
        if (st.mode === 'sse' && st.sse) return
        st.mode = 'sse'
        st.sse = new EventSource(HUB_SSE_PATH)
        st.sse.onmessage = function (msg) {
          var frame
          try { frame = JSON.parse(msg.data) } catch (e) { return }
          if (!frame || typeof frame.plugin !== 'string') return
          hubDispatch(frame.data, frame)
        }
      }

      /** ws 主通道:自动重连;连续 3 次未握手成功则永久降级 SSE。 */
      function startWsHub() {
        var st = hubState()
        if (st.ws) return
        try {
          var proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
          st.wsAttempts++
          st.ws = new WebSocket(proto + location.host + HUB_WS_PATH)
          st.ws.onopen = function () { st.wsAttempts = 0 }
          st.ws.onmessage = function (msg) {
            var frame
            try { frame = JSON.parse(msg.data) } catch (e) { return }
            if (!frame || typeof frame.plugin !== 'string') return
            hubDispatch(frame.data, frame)
          }
          st.ws.onclose = function () {
            st.ws = null
            if (st.wsAttempts < 3) setTimeout(function () { startTransport() }, 3000)
            else startSseHub()
          }
          st.ws.onerror = function () { try { st.ws.close() } catch (e) { /* 已关 */ } }
        } catch (e) {
          startSseHub()
        }
      }

      function startTransport() {
        var st = hubState()
        if (st.started && (st.ws || st.sse)) return
        // WebSocket 优先(握手后豁免于 h1.1 连接预算);连续 3 次握手失败转 SSE
        if (typeof WebSocket !== 'undefined' && typeof location !== 'undefined' && st.wsAttempts < 3) startWsHub()
        else startSseHub()
      }

      /**
       * 订阅某插件的事件流:枢纽就绪则共享连接(零额外连接);
       * 浏览器不支持时返回 null,调用方自行回退(自有 SSE / 轮询)。
       */
      function connectEvents(plugin, onFrame, onState) {
        if (typeof window === 'undefined' || typeof EventSource === 'undefined') return null
        startTransport()
        var off = hubSubscribe(plugin, function (data, frame) {
          if (onState) { try { onState('live') } catch (e) {} }
          onFrame(data, frame)
        })
        var st = hubState()
        if (onState) { try { onState(st.ws || st.sse ? 'live' : 'connecting') } catch (e) {} }
        return off
      }

      return { substituteParams: substituteParams, makeActionShareDialog: makeActionShareDialog, connectEvents: connectEvents }
    })()

    /**
     * dsh-kite — 风筝引擎（物理与渲染一体，Canvas2D）
     *
     * 一只风筝的完整生命周期由三类输入驱动：
     *   activity（宿主活动度 0..1）→ 目标高度：altFrac = 0.18 + activity×0.62
     *     × responsiveness + 里程碑地板，向上快、向下慢（风筝不倒栽）
     *   pulse（阵风脉冲）→ turn 上升冲量 / tool 扑翼抖擞 / fail 俯冲 /
     *     milestone 翻滚+地板抬升 / finale 双圈翻滚 / session 换新风筝
     *   wind（本地噪声风场）→ 水平漫游、摆动、线绳弧度、尾链漂移
     *
     * 姿态模型（决定贴图怎么跟着歪）：
     *   face  ∈[-1,1]  朝向。|face|＝水平前缩（侧身时帆面变窄），符号＝正反面
     *   roll          侧倾 → x 向剪切
     *   pitch         俯仰 → y 向压缩 + 轻微剪切
     *   tilt          整体倾角；loop 机动时叠加大角度翻滚
     *   贴图与帆面纹理共用同一仿射位姿矩阵 → 照片永远「糊」在骨架上：
     *   正面是照片，侧身被压窄，翻面时透出帆布背面（半透明+骨架更明显）。
     *
     * 纹理：variant 变化/换主题时把 paintSail() 烘焙进离屏帆布（图案 + 竹条 +
     * 描边）与「骨架版」（只竹条描边，垫在用户照片上面），逐帧只是一次
     * drawImage，性能与复杂图案解耦。
     *
     * 本文件同时跑在浏览器（构建期内联）与 node 测试（底部导出）两侧；
     * 纯数学段不触碰 DOM。
     */

    /* node-test-export-start */
    const TAU = Math.PI * 2

    function loadCards() {
      if (typeof KiteCards !== 'undefined') return KiteCards
      if (typeof module !== 'undefined' && module.exports) return require('./kite-cards.js')
      return null
    }

    /** 三次平滑噪声（风场/漫游用）：t ∈ 秒，seed 不同相位不同。 */
    function smoothNoise(t, seed) {
      return Math.sin(t * 0.53 + seed * 12.9898) * 0.5
        + Math.sin(t * 0.171 + seed * 78.233 + 1.3) * 0.3
        + Math.sin(t * 1.31 + seed * 37.719 + 2.7) * 0.2
    }

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
    const lerp = (a, b, t) => a + (b - a) * t
    /** easeInOutCubic：翻滚/机动用，端点速度为 0，起收都稳。 */
    const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

    /**
     * createKiteEngine(canvas, opts) → 引擎。
     * opts: { intensity=1, tone='dark', maxTails=3 }
     */
    function createKiteEngine(canvas, opts) {
      const options = Object.assign({ intensity: 1, tone: 'dark' }, opts)
      const Cards = loadCards()
      const g = canvas.getContext('2d')

      // ── 画布尺寸 ──────────────────────────────────────────────────────────
      let vw = 0
      let vh = 0
      let unit = 1 // 尺寸缩放：小窗口风筝按比例缩小
      let viewScale = 1 // 渲染超采样倍率（低 DPR 屏强制 1.3–1.6×，抗锯齿）

      function resize() {
        vw = canvas.clientWidth || (typeof innerWidth !== 'undefined' ? innerWidth : 1280)
        vh = canvas.clientHeight || (typeof innerHeight !== 'undefined' ? innerHeight : 800)
        unit = clamp(Math.min(vw, vh) / 900, 0.45, 1.5)
        // DPR≥1.5（retina）按原生渲染；低 DPR 屏矢量边缘全锯齿——强制超采样
        // 再缩回，线条与纹理边缘立刻细腻。画布总面积封顶 ~12M 像素保护低端机。
        const dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1
        let scale = dpr >= 1.5 ? Math.min(2, dpr) : clamp(dpr * 1.6, 1.3, 1.6)
        const maxPixels = 6.5e6
        const area = vw * vh * scale * scale
        if (area > maxPixels) scale *= Math.sqrt(maxPixels / area)
        viewScale = Math.max(1, scale)
        canvas.width = Math.max(1, Math.round(vw * viewScale))
        canvas.height = Math.max(1, Math.round(vh * viewScale))
        g.setTransform(viewScale, 0, 0, viewScale, 0, 0)
        // canvas.width 赋值会重置上下文状态：重设高质量采样，杜绝缩放发涩
        g.imageSmoothingEnabled = true
        try { g.imageSmoothingQuality = 'high' } catch { /* 老内核忽略 */ }
        texScaleDirty = true
        // resize 连发时延迟重烘焙，避免拖拽窗口期间连续大纹理卡帧
        texRebuildAt = time > 0 ? time + 0.2 : 0
      }

      // ── 天空状态 ──────────────────────────────────────────────────────────
      let intensity = options.intensity
      let tone = options.tone === 'light' ? 'light' : 'dark'
      let activity = 0
      let activityShown = 0
      let responsiveness = 1
      let tierFloor = 0
      let enabled = true
      let disposed = false
      let wind = 0
      let gust = 0 // 阵风冲量（衰减）
      // 换新时机:哪些脉冲触发换风筝(config.switchOn)。session=新顶层会话总是换;
      // 其余(turn/fail/agent/milestone/finale/tool)可勾选,且有 10s 冷却防止
      // 报错+轮次背靠背连换。换新=洗牌袋抽新卡+翻滚一圈揭晓,钉住时仍尊重钉住。
      const SWITCH_KINDS = ['session', 'turn', 'tool', 'fail', 'agent', 'milestone', 'finale']
      const SWITCH_DEFAULT = { session: true, turn: true, fail: true, agent: true, milestone: true, finale: true, tool: false }
      const SWITCH_COOLDOWN = 10
      let switchOn = Object.assign({}, SWITCH_DEFAULT)
      let lastSwitchAt = -1e9
      // 鼠标联动:指针位置(画布归一化坐标,y 向下)。风场在 step() 里向鼠标方向
      // 偏置——漫游/朝向/尾巴/龙身链吃同一个 wind 标量,整片天空"吹向"指针;
      // 指针停手 ~1.1s 后包络缓落,回归噪声风场。travel 累计位移换算阵风。
      const mouse = { x: 0.5, y: 0.4, env: 0, holdUntil: -1, travel: 0 }
      let mouseWindOn = true
      let flutter = 0 // 扑翼抖擞（衰减）

      // ── 风筝状态 ──────────────────────────────────────────────────────────
      const kite = {
        x: 0.5, y: 0.5,        // 归一化区域坐标（resize 无关）
        vx: 0, vy: 0,
        face: 1,               // 朝向 [-1,1]
        roll: 0, pitch: 0, tilt: 0,
        altFrac: 0.3,
        altVel: 0,
        loopT: -1, loopDur: 1.15, loopCount: 1, // 翻滚机动（-1 = 无）
        flapPhase: 0,
        bobPhase: Math.random() * TAU,
        wanderSeed: Math.random() * 100,
        wanderX: 0.5,
        respawnT: -1,          // 入场动画（从底部拉起）
      }

      // ── 变体与纹理 ────────────────────────────────────────────────────────
      const bagState = { list: [] }
      let enabledPredicate = null
      let currentVariant = null
      let sailTex = null       // 图案+竹条+描边
      let skeletonTex = null   // 只竹条+描边（垫在用户贴图上）
      let texScale = 0
      let texScaleDirty = true
      let texRebuildAt = -1
      let decalImg = null
      let decalEnabled = false
      let decalOpacity = 0.9

      function texSize() {
        return Math.round(clamp(Math.min(vw, vh) * 0.42, 240, 520))
      }

      /** 烘焙像素尺寸：按渲染超采样倍率放大，屏上缩放采样才有足够信息量，不颗粒。 */
      function bakePixels() {
        return Math.round(clamp(texSize() * viewScale * 1.35, 300, 1000))
      }

      function makeCanvas(w, h) {
        if (typeof document === 'undefined') return null
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        return c
      }

      /** 烘焙帆面纹理。skeleton=true 时只画竹条与描线（供贴图模式垫底）。 */
      function buildTexture(skeleton) {
        if (!Cards || typeof document === 'undefined' || !currentVariant) return null
        const S = bakePixels()
        const c = makeCanvas(S, S)
        if (!c) return null
        const cg = c.getContext('2d')
        if (skeleton) {
          const frame = Cards.FRAMES_BY_ID[currentVariant.frame]
          const scale = S * 0.46 * frame.size
          const ox = S / 2
          const oy = S / 2
          const P = (u, v) => [ox + u * scale, oy + v * scale]
          const ink = tone === 'light' ? [225, 18, 16] : [230, 25, 88]
          // 半透明帆布底：翻面/贴图时透出素绢底色，骨架线更清楚
          Cards.pathPoly(cg, frame.outline, P)
          cg.fillStyle = tone === 'light' ? 'rgba(250,247,238,0.5)' : 'rgba(238,232,216,0.34)'
          cg.fill()
          cg.strokeStyle = `hsl(${tone === 'light' ? 30 : 35} 42% ${tone === 'light' ? 30 : 34}%)`
          cg.lineWidth = Math.max(1, scale * 0.03)
          cg.lineCap = 'round'
          for (const s of frame.spars) {
            const a = P(s[0], s[1]); const b = P(s[2], s[3])
            cg.beginPath(); cg.moveTo(a[0], a[1]); cg.lineTo(b[0], b[1]); cg.stroke()
          }
          cg.strokeStyle = `hsl(${ink[0]} ${ink[1]}% ${ink[2]}%)`
          cg.lineWidth = Math.max(1.2, scale * 0.032)
          Cards.pathPoly(cg, frame.outline, P)
          cg.stroke()
          return c
        }
        Cards.paintSail({ g: cg, w: S, h: S, card: currentVariant, tone, rng: Cards.mulberry32(7) })
        return c
      }

      function rebuildTextures() {
        const S = bakePixels()
        if (!texScaleDirty && sailTex && texScale === S) return
        if (time < texRebuildAt) return // resize 连发去抖
        texScaleDirty = false
        texScale = S
        sailTex = buildTexture(false)
        skeletonTex = buildTexture(true)
      }

      /** 选下一只风筝（洗牌袋，绝不与上一只重复）。 */
      function pickNext(seed) {
        if (!Cards) return null
        const rng = Cards.mulberry32((seed == null ? Math.random() * 1e9 : seed) >>> 0)
        let pool = Cards.ALL_CARDS
        if (typeof preferredId === 'string' && preferredId !== 'auto') {
          const pinned = pool.find((c) => c.id === preferredId || c.frame === preferredId)
          if (pinned) return pinned
        }
        if (enabledPredicate) pool = pool.filter(enabledPredicate)
        if (pool.length === 0) pool = Cards.ALL_CARDS
        const picks = Cards.pickVariants(pool, 1, rng, bagState)
        return picks[0] || null
      }

      let preferredId = 'auto'

      function setVariant(cardEntry) {
        if (!cardEntry) return
        currentVariant = cardEntry
        const spec = Cards.resolveCard(cardEntry, activity, Cards.mulberry32((Math.random() * 1e9) >>> 0))
        kiteSpec = spec
        texScaleDirty = true
        rebuildTails()
        buildChainBody()
      }

      let kiteSpec = null

      // ── 尾链（verlet）──────────────────────────────────────────────────────
      let tails = []

      function rebuildTails() {
        tails = []
        const spec = kiteSpec
        if (!spec || !spec.tail) return
        for (const att of spec.tail.attach) {
          const pts = []
          const n = spec.tail.segs
          for (let i = 0; i < n; i++) pts.push({ x: 0, y: 0, px: 0, py: 0, init: false })
          tails.push({ att, pts, segLen: spec.tail.segLen, bows: spec.tail.bows, width: spec.tail.width, phase: Math.random() * TAU })
        }
      }

      /** 串式龙身：腰节链构建（里程碑档位越长越长）。 */
      function buildChainBody() {
        if (!kiteSpec || !kiteSpec.chain) { chainBody = null; return }
        const c = kiteSpec.chain
        const pts = []
        const n = c.segs * 2 + 1
        for (let i = 0; i < n; i++) pts.push({ x: 0, y: 0, px: 0, py: 0, init: false })
        chainBody = { pts, segs: c.segs, target: c.segs, growAcc: 0 }
        bakeSegmentSprite()
      }

      let segTex = null
      function bakeSegmentSprite() {
        segTex = null
        if (typeof document === 'undefined' || !currentVariant) return
        const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)
        const S = Math.max(48, Math.round(84 * dpr))
        const cv = document.createElement('canvas')
        cv.width = S
        cv.height = S
        const cg = cv.getContext('2d')
        Cards.paintSegment(cg, S, {
          pal: currentVariant.palette,
          rng: Cards.mulberry32(9),
          ink: tone === 'light' ? [30, 40, 20] : [30, 40, 15],
        })
        segTex = cv
      }

      function updateChainBody(dt, ax, ay, segPx) {
        const pts = chainBody.pts
        const p0 = pts[0]
        if (!p0.init) {
          for (let i = 0; i < pts.length; i++) {
            pts[i].x = ax; pts[i].y = ay + i * segPx
            pts[i].px = pts[i].x; pts[i].py = pts[i].y
            pts[i].init = true
          }
        }
        p0.x = ax; p0.y = ay
        // 龙身要"顺风流"而不是垂坠:风力放大、重力收敛,让链身横漂在龙头后方
        const windF = (wind * 130 + gust * 200) * unit * dt
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i]
          const vx = (p.x - p.px) * 0.97
          const vy = (p.y - p.py) * 0.97
          p.px = p.x; p.py = p.y
          p.x += vx + windF * (0.5 + Math.sin(i * 0.6 + time * 2.2) * 0.5)
          p.y += vy + 14 * unit * dt * dt * 60
        }
        for (let iter = 0; iter < 3; iter++) {
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i]; const b = pts[i + 1]
            const dx = b.x - a.x; const dy = b.y - a.y
            const d = Math.hypot(dx, dy) || 1e-6
            const diff = (d - segPx) / d
            if (i === 0) { b.x -= dx * diff; b.y -= dy * diff }
            else {
              a.x += dx * diff * 0.5; a.y += dy * diff * 0.5
              b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5
            }
          }
        }
      }

      function updateTail(tail, dt, ax, ay, segPx) {
        const pts = tail.pts
        // 端点钉在骨架挂点上
        const p0 = pts[0]
        if (!p0.init) {
          for (let i = 0; i < pts.length; i++) {
            pts[i].x = ax; pts[i].y = ay + i * segPx
            pts[i].px = pts[i].x; pts[i].py = pts[i].y
            pts[i].init = true
          }
        }
        p0.x = ax; p0.y = ay
        const windF = (wind * 30 + gust * 90) * unit * dt
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i]
          const vx = (p.x - p.px) * 0.96
          const vy = (p.y - p.py) * 0.96
          p.px = p.x; p.py = p.y
          p.x += vx + windF * (0.4 + Math.sin(tail.phase + i * 0.7) * 0.3)
          p.y += vy + 26 * unit * dt * dt * 60
        }
        for (let iter = 0; iter < 3; iter++) {
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i]; const b = pts[i + 1]
            let dx = b.x - a.x; let dy = b.y - a.y
            const d = Math.hypot(dx, dy) || 1e-6
            const diff = (d - segPx) / d
            if (i === 0) { b.x -= dx * diff; b.y -= dy * diff } else {
              a.x += dx * diff * 0.5; a.y += dy * diff * 0.5
              b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5
            }
          }
        }
      }

      function drawTail(tail, toneInk) {
        const pts = tail.pts
        g.strokeStyle = toneInk
        g.lineWidth = Math.max(1.2, tail.width * unit * 0.55)
        g.lineCap = 'round'
        g.lineJoin = 'round'
        g.beginPath()
        g.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1]; const b = pts[i]
          g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
        }
        g.stroke()
        if (tail.bows) {
          for (let i = 2; i < pts.length; i += 2) {
            const p = pts[i]; const q = pts[i - 1]
            const ang = Math.atan2(p.y - q.y, p.x - q.x) + Math.PI / 2 + (i % 4 ? 0.5 : -0.5)
            const r = 3.2 * unit
            g.save()
            g.translate(p.x, p.y)
            g.rotate(ang)
            g.fillStyle = i % 4 ? 'rgba(240,80,70,0.85)' : 'rgba(250,190,60,0.9)'
            g.beginPath()
            g.moveTo(-r, 0); g.lineTo(0, -r * 0.55); g.lineTo(r, 0); g.lineTo(0, r * 0.55)
            g.closePath()
            g.fill()
            g.restore()
          }
        }
      }

      // ── 位姿矩阵 ──────────────────────────────────────────────────────────
      // M = T(pos) · R(tilt) · [x' = fx·u + shear·fy·v, y' = fy·v]
      function poseParams() {
        const spec = kiteSpec
        const sizeScale = (spec ? spec.size : 1) * intensity * unit * (1.04 - kite.altFrac * 0.2)
        const base = Math.min(vw, vh) * 0.16 * sizeScale
        const fx = (0.2 + 0.8 * Math.abs(kite.face)) * Math.sign(kite.face || 1)
        const fy = 1 - Math.abs(kite.pitch) * 0.22
        const shear = kite.roll * 0.5 + kite.pitch * 0.25 * Math.sign(kite.face || 1)
        return { fx, fy, shear, base }
      }

      function poseMatrix(px, py, spin) {
        const { fx, fy, shear, base } = poseParams()
        const ang = kite.tilt + (spin || 0)
        const cosT = Math.cos(ang)
        const sinT = Math.sin(ang)
        // M1（缩放+剪切，canvas 约定 x'=a·x+c·y, y'=b·x+d·y）：
        //   a1 = fx·B, b1 = 0, c1 = shear·fy·B, d1 = fy·B
        // R·M1 复合：
        const A = fx * base
        const D = fy * base
        return {
          m11: A * cosT,
          m12: A * sinT,
          m21: D * (shear * cosT - sinT),
          m22: D * (shear * sinT + cosT),
          e: px, f: py,
        }
      }

      function applyPose(m, u, v) {
        return [
          m.m11 * u + m.m21 * v + m.e,
          m.m12 * u + m.m22 * v + m.f,
        ]
      }

      /** 帆面布料抖动（单位空间位移场，翼尖大）。 */
      function wobble(u, v) {
        const spec = kiteSpec
        const amp = spec ? spec.flapAmp : 0.05
        const k = spec ? spec.flapK : 2.5
        return Math.sin(u * k * 2.1 + kite.flapPhase + v * k * 0.8) * amp * (0.25 + 0.75 * Math.abs(u)) * (0.4 + Math.abs(kite.face) * 0.6)
      }

      function wobbledPath(m, pts, close) {
        g.beginPath()
        for (let i = 0; i < pts.length; i++) {
          const u = pts[i][0]
          const v = pts[i][1] + wobble(u, pts[i][1])
          const p = applyPose(m, u, v)
          if (i === 0) g.moveTo(p[0], p[1])
          else g.lineTo(p[0], p[1])
        }
        if (close !== false) g.closePath()
      }

      // ── 主循环 ────────────────────────────────────────────────────────────
      let rafId = 0
      let lastTs = 0
      let time = 0
      let stringRipple = 0
      let running = false
      let poseHoldUntil = -1
      /** 帧率节流：最小帧间隔（~30fps）与强制渲染标记（脉冲后立刻画一帧）。 */
      const FRAME_MIN = 1 / 30
      let frameAcc = 0
      let forceFrame = false
      let hueFlow = 0 // 色相流转累计角度（七彩类 dynamicHue）
      let chainBody = null // 串式龙身腰节链
      let chainGrowAcc = 0
      /** 调试：渲染分层开关（验收排查用）。 */
      const debugStages = { string: true, tails: true, halo: true, tex: true, outline: true, chain: true }

      function step(dt) {
        time += dt
        if (time < poseHoldUntil) {
          // 调试定格（debugPose）：只推布料相位，不跑姿态/位移 AI
          kite.flapPhase += dt * TAU / 3
          return
        }
        activityShown = lerp(activityShown, activity, 1 - Math.exp(-dt * 0.9))
        wind = smoothNoise(time * 0.35, kite.wanderSeed) * (0.5 + activityShown * 0.7)
        gust *= Math.exp(-dt * 1.8)
        flutter *= Math.exp(-dt * 2.2)

        // 鼠标风:指针动过 → 包络升起,风场向指针方向偏置;停手缓落回归噪声
        const mouseTarget = mouseWindOn && time < mouse.holdUntil ? 1 : 0
        mouse.env = lerp(mouse.env, mouseTarget, 1 - Math.exp(-dt * (mouseTarget > mouse.env ? 3.2 : 0.7)))
        if (mouse.travel > 0) {
          gust = Math.min(1.2, gust + Math.min(0.5, mouse.travel * 1.6))
          mouse.travel = 0
        }
        if (mouse.env > 0.003) {
          wind += mouse.env * clamp((mouse.x - kite.x) * 2.4, -1, 1) * 0.85
          // 指针贴近风筝 → 抖擞(像被手拂过)
          const ksy = 0.06 + 0.64 * (1 - kite.altFrac) // 风筝纵坐标的近似归一化值
          if (Math.hypot(mouse.x - kite.x, mouse.y - ksy) < 0.15) flutter = Math.min(1.5, flutter + dt * 5)
        }
        stringRipple = smoothNoise(time * 2.4, 7.7)

        // 翻滚机动：spin 角按 easeInOutCubic 走满 TAU 的整数圈——收尾角度与
        // 起始角度模 2π 同余，落回常规姿态时无突跳（旧实现 tilt 直接跳变）
        if (kite.loopT >= 0) {
          kite.loopT += dt / kite.loopDur
          if (kite.loopT >= 1) {
            kite.loopCount -= 1
            if (kite.loopCount > 0) kite.loopT = 0
            else kite.loopT = -1
          }
        }

        // 高度：activity → 目标高度分数（升快落慢）
        const mouseLift = mouse.env * clamp(0.55 - mouse.y, -0.45, 0.45) * 0.34
        const targetAlt = clamp(0.16 + activityShown * 0.62 * responsiveness + Math.min(6, tierFloor) * 0.045 + mouseLift, 0.04, 0.95)
        const gap = targetAlt - kite.altFrac
        kite.altVel += gap * (gap > 0 ? 2.6 : 1.1) * dt
        kite.altVel *= Math.exp(-dt * 1.5)
        kite.altFrac = clamp(kite.altFrac + kite.altVel * dt + (kite.respawnT >= 0 ? dt * 0.4 : 0), 0.02, 0.99)
        if (kite.respawnT >= 0) {
          kite.respawnT += dt
          if (kite.respawnT > 2.2) kite.respawnT = -1
        }

        // 水平漫游：噪声游走 + 风
        kite.wanderX = 0.5 + smoothNoise(time * 0.16, kite.wanderSeed + 3.1) * 0.42
        const desire = (kite.wanderX - kite.x) * (0.5 + activityShown * 0.6)
        const windPush = wind * (0.16 + gust * 0.5)
        kite.vx = lerp(kite.vx, (desire + windPush) * 0.5, 1 - Math.exp(-dt * 1.6))
        kite.x = clamp(kite.x + kite.vx * dt * (0.3 + activityShown * 0.5), 0.06, 0.94)

        // 姿态：朝向 / 侧倾 / 俯仰。|faceTarget| 有 0.38 下限：风筝可以转向，
        // 但不会长时间侧身对着屏幕发呆（穿越 0 的翻面仍由 lerp 动画完成）
        const rawFace = kite.vx * 6 + wind * 0.8
        const faceTarget = rawFace === 0
          ? Math.sign(kite.face) * 0.38
          : Math.sign(rawFace) * Math.max(0.38, Math.min(1, Math.abs(rawFace)))
        kite.face = lerp(kite.face, faceTarget, 1 - Math.exp(-dt * 1.5))
        kite.roll = lerp(kite.roll, clamp(-kite.vx * 5 - wind * 0.6, -1, 1), 1 - Math.exp(-dt * 2.2))
        kite.pitch = lerp(kite.pitch, clamp(-kite.altVel * 2.4 + (kite.loopT >= 0 ? 0.4 : 0), -0.8, 0.8), 1 - Math.exp(-dt * 3))
        kite.tilt = lerp(kite.tilt, kite.roll * 0.24 + Math.sin(time * 0.9 + kite.bobPhase) * 0.06, 1 - Math.exp(-dt * 3))

        // 扑翼相位
        const flapRate = (1.6 + flutter * 7 + activityShown * 1.6) * TAU / 3
        kite.flapPhase += flapRate * dt
        kite.bobPhase += dt * (0.7 + activityShown * 0.6)

        // 龙身生长：里程碑档位 → 每档 +2 节
        if (chainBody && chainBody.segs < chainBody.target) {
          chainBody.growAcc += dt
          if (chainBody.growAcc > 0.22) {
            chainBody.growAcc = 0
            chainBody.segs += 1
            const last = chainBody.pts[chainBody.pts.length - 1]
            chainBody.pts.push({ x: last.x, y: last.y + 6, px: last.x, py: last.y + 6, init: false })
            chainBody.pts.push({ x: last.x, y: last.y + 12, px: last.x, py: last.y + 12, init: false })
          }
        }

        // 色相流转（七彩类 dynamicHue）：活动度驱动转速
        if (kiteSpec && kiteSpec.dynamicHue) hueFlow += dt * (4 + activityShown * 26)
      }

      function screenPos() {
        // 归一化 → 画布坐标：地平线在 72% 高度，altFrac 0 → 地平线，1 → 顶部
        const horizonY = vh * 0.72
        const topY = Math.max(30, vh * 0.07)
        const bob = Math.sin(kite.bobPhase) * (8 + (1 - activityShown) * 10) * unit
        const x = vw * 0.5 + (kite.x - 0.5) * vw
        const y = lerp(horizonY, topY, kite.altFrac) + bob
        return { x, y }
      }

      function frame(ts) {
        if (disposed) return
        rafId = 0
        const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000))
        lastTs = ts
        if (!enabled) {
          running = false
          return
        }

        // 帧率节流：常驻动画按 ~30fps 渲染（风筝动作舒缓，30fps 足够丝滑），
        // dt 累计保证物理连续——省一半的清除/合成开销，页面其余部分不再被拖累
        frameAcc += dt
        if (frameAcc < FRAME_MIN && !forceFrame) {
          rafId = requestAnimationFrame(frame)
          return
        }
        const stepDt = frameAcc
        frameAcc = 0
        forceFrame = false

        step(stepDt)
        rebuildTextures()

        const pos = screenPos()
        // 翻滚角：eased 走满 TAU 整圈，结束角度 ≡ 起始角度（mod 2π），无跳变
        const spin = kite.loopT >= 0 ? TAU * easeInOutCubic(clamp(kite.loopT, 0, 1)) : 0
        const m = poseMatrix(pos.x, pos.y, spin)
        const spec = kiteSpec

        g.clearRect(0, 0, vw, vh)

        // ── 线绳 ────────────────────────────────────────────────────────────
        const stringInk = tone === 'light' ? 'rgba(70,70,84,0.55)' : 'rgba(235,235,240,0.5)'
        const stages = debugStages
        if (spec && stages.string !== false) {
          const bridle = applyPose(m, spec.frame.bridle[0], spec.frame.bridle[1])
          const ax = vw / 2
          const ay = vh - 4
          const dist = Math.hypot(bridle[0] - ax, bridle[1] - ay)
          const taut = clamp(kite.altFrac * 1.25, 0.15, 1)
          const sag = dist * (1 - taut) * 0.22
          const N = 26
          g.strokeStyle = stringInk
          g.lineWidth = 1.2
          g.lineCap = 'round'
          g.beginPath()
          for (let i = 0; i <= N; i++) {
            const t = i / N
            const bx = lerp(ax, bridle[0], t)
            const by = lerp(ay, bridle[1], t)
            const bell = Math.sin(t * Math.PI)
            const rx = Math.sin(t * 22 - time * 9 + stringRipple * 6) * 2.4 * unit * (1 - taut) * bell
            const ry = sag * bell * 2 - Math.abs(rx) * 0.4
            const px = bx + rx
            const py = by + ry
            if (i === 0) g.moveTo(px, py)
            else g.lineTo(px, py)
          }
          g.stroke()

          // ── 尾链 ──────────────────────────────────────────────────────────
          const tailInk = tone === 'light' ? 'rgba(80,70,66,0.75)' : 'rgba(240,235,225,0.72)'
          if (spec.tail && stages.tails !== false) {
            const segPx = spec.tail.segLen * Math.min(vw, vh) * 0.16 * intensity * unit
            for (const tail of tails) {
              const at = applyPose(m, tail.att[0], tail.att[1])
              updateTail(tail, stepDt, at[0], at[1], segPx)
              drawTail(tail, tailInk)
            }
          }
        }

        // ── 龙身腰节链（串式：chain 配置）──────────────────────────────────
        if (chainBody && spec && spec.chain && stages.chain !== false) {
          const at = applyPose(m, spec.chain.anchor[0], spec.chain.anchor[1])
          const segPx2 = spec.chain.segSize * Math.min(vw, vh) * 0.16 * intensity * unit * (1.04 - kite.altFrac * 0.2)
          // 节距 = 贴片直径 × segLen：珠节相接的串式龙身（segLen≈0.6 → 相邻贴片微重叠）
          const segPx = segPx2 * spec.chain.segLen
          updateChainBody(stepDt, at[0], at[1], segPx)
          g.strokeStyle = tone === 'light' ? 'rgba(70,70,84,0.5)' : 'rgba(235,235,240,0.4)'
          g.lineWidth = 1.2
          g.beginPath()
          g.moveTo(chainBody.pts[0].x, chainBody.pts[0].y)
          for (let i = 1; i < chainBody.pts.length; i++) g.lineTo(chainBody.pts[i].x, chainBody.pts[i].y)
          g.stroke()
          for (let i = 2; i < chainBody.pts.length - 1; i += 2) {
            const p = chainBody.pts[i]
            const q = chainBody.pts[i - 1]
            const ang = Math.atan2(p.y - q.y, p.x - q.x) - Math.PI / 2
            if (!segTex) continue
            g.save()
            g.translate(p.x, p.y)
            g.rotate(ang)
            g.drawImage(segTex, -segPx2 / 2, -segPx2 / 2, segPx2, segPx2)
            g.restore()
          }
        }

        // ── 风筝本体 ────────────────────────────────────────────────────────
        if (spec && spec.frame) {
          const backside = kite.face < 0
          const thin = Math.abs(kite.face) < 0.2

          g.save()
          // 位姿变换（贴图与纹理共用）
          g.translate(m.e, m.f)
          g.transform(
            m.m11, m.m12,
            m.m21, m.m22,
            0, 0,
          )

          // 光晕描边（让风筝在任何底色上都有轮廓）。
          // 位姿变换内部线宽按单位空间计：除以基准尺度换算回屏幕像素。
          if (stages.halo !== false) {
            wobbledPath({ m11: 1, m12: 0, m21: 0, m22: 1, e: 0, f: 0 }, spec.frame.outline)
            g.strokeStyle = tone === 'light' ? 'rgba(255,255,255,0.5)' : 'rgba(20,22,30,0.4)'
            g.lineWidth = (5 * unit) / poseParams().base
            g.lineJoin = 'round'
            g.stroke()
          }

          // 用户贴图：糊在 decalQuad 区，随位姿仿射变换（正/侧/斜自动跟随）
          const showDecal = decalImg && decalEnabled && !thin
          const drawDecal = (alpha) => {
            if (!showDecal || alpha <= 0.02) return
            const dq = spec.frame.decalQuad
            const qx0 = dq[0][0]; const qy0 = dq[0][1]
            const qw = dq[1][0] - dq[0][0]
            const qh = dq[2][1] - dq[1][1]
            g.save()
            wobbledPath({ m11: 1, m12: 0, m21: 0, m22: 1, e: 0, f: 0 }, spec.frame.outline)
            g.clip()
            const iw = decalImg.naturalWidth || decalImg.width || 1
            const ih = decalImg.naturalHeight || decalImg.height || 1
            const targetAspect = Math.abs(qw / qh)
            let sx = 0; let sy = 0; let sw = iw; let sh = ih
            if (iw / ih > targetAspect) {
              sw = ih * targetAspect
              sx = (iw - sw) / 2
            } else {
              sh = iw / targetAspect
              sy = (ih - sh) * 0.32
            }
            g.globalAlpha = alpha
            g.drawImage(decalImg, sx, sy, sw, sh, qx0, qy0, qw, qh)
            g.globalAlpha = 1
            g.restore()
          }

          // 帆面分层——两面都有图案，背面只是「从布背透出」更素一些：
          //   正面：贴图开启 = 照片全浓 + 骨架（竹条/描线）压顶；否则整张图案纹理
          //   背面：图案纹理镜像透出（fx<0 自动镜像）→ 贴图也隐约透出 →
          //         帆布背面+骨架罩上，最后按侧身/背面程度整体压暗
          if (stages.tex !== false) {
            const dw = 1 / (0.46 * spec.frame.size)
            const hueOn = !!(spec.dynamicHue && typeof g.filter === 'string')
            const drawTex = (tex, alpha) => {
              if (!tex) return
              g.globalAlpha = alpha
              if (hueOn) g.filter = 'hue-rotate(' + (hueFlow % 360).toFixed(1) + 'deg)'
              g.drawImage(tex, -dw / 2, -dw / 2, dw, dw)
              if (hueOn) g.filter = 'none'
              g.globalAlpha = 1
            }
            if (!backside) {
              if (showDecal) {
                drawDecal(decalOpacity)
                drawTex(skeletonTex, 1)
              } else {
                drawTex(sailTex, 1)
              }
            } else {
              drawTex(sailTex, 0.92)
              drawDecal(decalOpacity * 0.45)
              drawTex(skeletonTex, 0.88)
            }
            // 侧身/背面的布面明暗（加强立体转折）
            const shade = (1 - Math.abs(kite.face)) * 0.38 + (backside ? 0.16 : 0)
            if (shade > 0.02) {
              g.save()
              wobbledPath({ m11: 1, m12: 0, m21: 0, m22: 1, e: 0, f: 0 }, spec.frame.outline)
              g.clip()
              g.fillStyle = tone === 'light' ? `rgba(40,42,60,${shade * 0.5})` : `rgba(10,12,24,${shade * 0.55})`
              g.fillRect(-1.2, -1.2, 2.4, 2.4)
              g.restore()
            }
          }

          // 侧身极窄时补一条脊线，避免「消失」（线宽同样按单位空间换算）
          if (thin) {
            g.strokeStyle = tone === 'light' ? 'rgba(60,60,70,0.8)' : 'rgba(240,240,244,0.8)'
            g.lineWidth = (2 * unit) / poseParams().base
            g.beginPath()
            const a = applyPose({ m11: 1, m12: 0, m21: 0, m22: 1, e: 0, f: 0 }, spec.frame.bridle[0], -1)
            const b = applyPose({ m11: 1, m12: 0, m21: 0, m22: 1, e: 0, f: 0 }, spec.frame.bridle[0], 1)
            g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1])
            g.stroke()
          }

          g.restore()

          // 活动描边（布料抖动的可见轮廓）。半透明细线：全亮度 1px 线每帧
          // 重采样会「爬行」发闪，压暗后只剩柔和的轮廓呼吸感
          if (stages.outline !== false) {
            g.save()
            wobbledPath(m, spec.frame.outline)
            g.strokeStyle = tone === 'light' ? 'rgba(50,46,60,0.55)' : 'rgba(250,248,240,0.55)'
            g.lineWidth = 1.3 * unit
            g.lineJoin = 'round'
            g.lineCap = 'round'
            g.stroke()
            g.restore()
          }
        }

        rafId = requestAnimationFrame(frame)
      }

      function ensureRunning() {
        if (!running && !disposed && enabled) {
          running = true
          lastTs = typeof performance !== 'undefined' ? performance.now() : Date.now()
          rafId = requestAnimationFrame(frame)
        }
      }

      function setRunning(v) {
        if (v) ensureRunning()
        else if (rafId) { try { cancelAnimationFrame(rafId) } catch {} rafId = 0; running = false }
      }

      // 启动时选一只风筝，量好尺寸，开转
      resize()
      if (Cards) setVariant(pickNext())
      ensureRunning()

      // ── 公开 API ──────────────────────────────────────────────────────────
      return {
        debugStages,
        setActivity(a) { activity = clamp(Number(a) || 0, 0, 1) },
        /** 鼠标联动:传入画布归一化坐标(x/y∈[0,1],y 向下)。高频调用安全。 */
        setMouse(nx, ny) {
          if (!mouseWindOn) return // 开关关闭:不吃坐标也不累计阵风
          const x = clamp(Number(nx) || 0, 0, 1)
          const y = clamp(Number(ny) || 0, 0, 1)
          mouse.travel += Math.hypot(x - mouse.x, y - mouse.y)
          mouse.x = x
          mouse.y = y
          mouse.holdUntil = time + 1.1
        },
        setMouseWind(v) { mouseWindOn = v !== false },
        /** 换新时机:各脉冲是否触发换风筝。缺省键回退默认。 */
        setSwitchOn(map) {
          const next = Object.assign({}, SWITCH_DEFAULT)
          if (map && typeof map === 'object') {
            for (const k of Object.keys(next)) {
              if (typeof map[k] === 'boolean') next[k] = map[k]
            }
          }
          switchOn = next
        },
        setTierFloor(n) { tierFloor = clamp(Number(n) || 0, 0, 6) },
        setResponsiveness(r) { responsiveness = clamp(Number(r) || 1, 0.3, 2) },
        setIntensity(v) { intensity = clamp(Number(v) || 1, 0.3, 2) },
        setToneMode(mode) {
          const next = mode === 'light' ? 'light' : 'dark'
          if (next !== tone) { tone = next; texScaleDirty = true }
        },
        /** 启用卡组过滤：(card) => boolean。 */
        setEnabledPredicate(fn) {
          enabledPredicate = typeof fn === 'function' ? fn : null
          bagState.list = []
        },
        /** 指定常驻骨架/卡（'auto' 恢复随机）。 */
        setPreferred(id) { preferredId = id || 'auto' },
        /** 立即换一只（洗牌袋不重复）。 */
        nextVariant(seed) {
          const c = pickNext(seed)
          if (c) setVariant(c)
          return currentVariant
        },
        getVariant() { return currentVariant },

        setDecal(img) { decalImg = img || null },
        setDecalEnabled(v) { decalEnabled = !!v },
        setDecalOpacity(v) { decalOpacity = clamp(Number(v) || 0.9, 0.3, 1) },

        /** 调试：定格一个姿态（截图/验收用）。pose = { face, roll, pitch, altFrac, x? }，holdMs 内不跑姿态 AI。 */
        debugPose(pose, holdMs) {
          const p = pose || {}
          if (typeof p.face === 'number') kite.face = clamp(p.face, -1, 1)
          if (typeof p.roll === 'number') kite.roll = clamp(p.roll, -1, 1)
          if (typeof p.pitch === 'number') kite.pitch = clamp(p.pitch, -0.8, 0.8)
          if (typeof p.altFrac === 'number') kite.altFrac = clamp(p.altFrac, 0.02, 0.99)
          if (typeof p.x === 'number') kite.x = clamp(p.x, 0.06, 0.94)
          poseHoldUntil = time + (holdMs == null ? 1.5 : holdMs / 1000)
          ensureRunning()
        },

        /** 阵风脉冲。 */
        pulse(kind, payload) {
          forceFrame = true // 脉冲当帧就画，不等下一节拍
          const p = payload || {}
          // 事件换新:勾选了的脉冲触发换风筝(session 在 case 里另行处理,总是换)
          if (kind !== 'session' && kind !== 'respawn' && SWITCH_KINDS.indexOf(kind) >= 0 && switchOn[kind]) {
            if (time - lastSwitchAt >= SWITCH_COOLDOWN) {
              lastSwitchAt = time
              this.nextVariant(typeof p.seed === 'number' ? p.seed : undefined)
              // 翻滚换新:新帆已烘好,翻一圈揭晓
              kite.loopT = 0; kite.loopCount = 1; kite.loopDur = 0.9
              gust += 0.9
              flutter = Math.min(1.6, flutter + 0.6)
            }
          }
          switch (kind) {
            case 'turn':
              kite.altVel += 0.25 + (p.magnitude || 0.5) * 0.5
              gust += 0.8
              flutter += 0.5
              break
            case 'tool':
              flutter = Math.min(1.6, flutter + 0.55)
              if (kiteSpec && kiteSpec.dynamicHue) hueFlow += 40
              gust += 0.3
              break
            case 'fail':
              kite.altVel -= 0.55
              gust += 1.1
              flutter = Math.min(1.8, flutter + 1)
              break
            case 'milestone':
              if (typeof p.tier === 'number') tierFloor = Math.max(tierFloor, p.tier)
              if (chainBody && kiteSpec && kiteSpec.chain) {
                chainBody.target = Math.min(kiteSpec.chain.segs + tierFloor * 2, kiteSpec.chain.segs + 12)
                bakeSegmentSprite()
              }
              kite.loopT = 0; kite.loopCount = 1; kite.loopDur = 1.15
              gust += 1.4
              flutter = Math.min(1.6, flutter + 0.8)
              break
            case 'finale':
              kite.loopT = 0; kite.loopCount = 2; kite.loopDur = 0.95
              kite.altVel += 0.5
              gust += 1.6
              flutter = Math.min(1.8, flutter + 1.2)
              break
            case 'session':
            case 'respawn': {
              const c = this.nextVariant(typeof p.seed === 'number' ? p.seed : undefined)
              lastSwitchAt = time
              kite.respawnT = 0
              kite.altFrac = 0.06
              kite.altVel = 0.4
              return c
            }
            case 'lift':
              kite.altVel += 0.4
              gust += 0.6
              break
            case 'dive':
              kite.altVel -= 0.6
              gust += 0.6
              break
            case 'loop':
              kite.loopT = 0; kite.loopCount = 1
              break
            default:
              break
          }
          ensureRunning()
          return null
        },

        setEnabled(v) {
          enabled = !!v
          if (!enabled) {
            g.clearRect(0, 0, vw, vh)
            setRunning(false)
          } else {
            ensureRunning()
          }
        },
        resize,
        stats() {
          return {
            variant: currentVariant ? currentVariant.name : null,
            variantEn: currentVariant ? currentVariant.nameEn : null,
            family: currentVariant ? Cards.FAMILY_ZH[currentVariant.frame.family] : null,
            altitude: kite.altFrac,
            activity: activityShown,
            wind, face: kite.face,
            tier: tierFloor,
            chainSegs: chainBody ? chainBody.segs : 0,
            chainTex: !!segTex,
            mouseWind: mouseWindOn,
            mouseEnv: Math.round(mouse.env * 100) / 100,
            switchOn: Object.assign({}, switchOn),
            hueFlow: kiteSpec && kiteSpec.dynamicHue ? Math.round(hueFlow) : -1,
            tone,
            tex: !!(sailTex && skeletonTex),
            hasDecal: !!(decalImg && decalEnabled),
          }
        },
        dispose() {
          disposed = true
          if (rafId) { try { cancelAnimationFrame(rafId) } catch {} }
          tails = []
          sailTex = null
          skeletonTex = null
        },
      }
    }

    const KiteEngine = { createKiteEngine, smoothNoise }

    /* node-test-export-end */

    'use strict'

    /**
     * dsh-kite — Client half
     *
     * 在对话窗口上空挂一块透明画布（position:fixed; pointer-events:none），
     * 引擎（client/kite-engine.js）在其中放一只会飞的风筝。宿主经 SSE
     * （/dsh-kite/api/stream）推来两类帧：
     *
     *   { type:'state', activity, tier }  天空状态 → 引擎调目标高度
     *   { type:'pulse', kind, magnitude } 阵风脉冲 → 升空/抖擞/俯冲/翻滚/换新
     *
     * 设置页（settings.section）：总开关、风力、高度响应、显示范围、骨架
     * 选择（含每只风筝的缩略图）、逐骨架开关、用户贴图上传（客户端压到
     * ≤640px 再 PUT，宿主存 storageDomain）、试飞按钮、引擎实时状态。
     *
     * kite-cards.js / kite-engine.js 由构建脚本内联进本文件所在工厂作用域
     * （bundle 中 KiteCards / createKiteEngine 为名直接可用）；本文件是动态
     * 插件的源真身，client/bundle.js 由 npm run build:client 生成。
     */

    const LOCALE_NS = 'settings.dshKite'

    const ZH = {
      nav: '放风筝',
      title: '放风筝',
      intro: 'agent 编程时，屏幕上放一只动画风筝：token 越多、事件越密，风筝飞得越高；工具调用是阵风，失败会俯冲，里程碑翻跟头，收工双圈庆祝。风筝出自潍坊谱系——硬翅沙燕、软翅金鱼、板式八卦、立体宫灯……',
      enabled: '放风筝',
      enabledHint: '关闭后风筝收线落地，画布收起。',
      intensity: '风力 / 体型',
      intensityHint: '缩放风筝大小与风场强度（0.3–2）。',
      responsiveness: '高度响应',
      responsivenessHint: '活动度对飞行高度的映射强度（0.3–2）。调低则风筝更沉稳。',
      mouseWind: '鼠标联动',
      mouseWindHint: '风筝朝鼠标方向顺风漂移、抬头/低头追随；快划鼠标会掀起阵风。',
      switchOn: '换新时机',
      switchOnHint: '勾选哪些事件，就当场换一只新风筝（洗牌袋不重样）。',
      switch_session: '新会话', switch_turn: '轮次', switch_fail: '报错',
      switch_agent: '子代理', switch_milestone: '里程碑', switch_finale: '收工', switch_tool: '工具',
      region: '显示范围',
      regionHint: '风筝只在此范围内飞；收窄后像一只挂在窗前的小风筝。',
      regionFullscreen: '全屏',
      regionLeft: '左部侧边栏',
      regionRight: '右部侧边栏',
      regionBottomLeft: '左下角',
      regionBottomRight: '右下角',
      preferredFrame: '当前风筝',
      preferredFrameHint: '「随机换新」按洗牌袋抽取，绝不与上一只重复；也可按骨架分组钉住具体某一只形象。',
      preferredAuto: '随机换新（不重样）',
      kiteGallery: '风筝谱系',
      kiteGalleryHint: '逐骨架开关（关掉的骨架不再被抽到）。图案与配色由卡组决定，同骨架可有多只。',
      cards: '{n} 只',
      testFly: '试飞',
      testLift: '升空',
      testDive: '俯冲',
      testLoop: '翻滚',
      testRespawn: '换一只',
      testAll: '全套动作',
      decal: '自定义贴图',
      decalHint: '上传一张照片糊上风筝面：贴图会跟着风筝的侧正斜姿态实时仿射变换——正身是照片，侧身压窄，翻面透出帆布背面。',
      decalEnable: '使用贴图',
      decalOpacity: '贴图浓淡',
      decalUpload: '上传图片',
      decalRemove: '移除',
      decalUploaded: '已上传 ✓（重启后仍在）',
      decalFailed: '上传失败：图片需为 png/jpeg/webp 且 ≤660KB',
      status: '状态',
      statusLive: '已连接宿主事件流',
      statusConnecting: '正在连接宿主事件流…',
      statusOff: '未连接（宿主插件未启用或页面刚加载）',
      engineStats: '在飞 {variant}（{family}）· 高度 {alt}% · 活动度 {act}% · 风力 {wind}',
      loading: '正在加载配置…',
      save: '保存',
      saved: '已保存 ✓',
      retry: '重试',
      reducedMotion: '检测到系统「减弱动态效果」偏好，风筝已停放；开启下方「忽略系统减弱动态效果」可强制放飞。',
      ignoreReducedMotion: '忽略系统「减弱动态效果」',
      ignoreReducedMotionHint: '开启后即使系统偏好减弱动态效果，也照常放飞。',
      demoHint: '小贴士：在地址栏加 ?kite=demo 可进入循环试飞模式；控制台 __dshKite.next() 随时换风筝。',
    }

    const EN = {
      nav: 'Kite',
      title: 'Kite Flying',
      intro: 'An animated kite over the screen while the agent works — the more tokens and events, the higher it flies. Tool calls are gusts, failures make it dive, milestones loop it, and finishing sends it into a double loop. Frames follow the Weifang lineage: hard-wing swallows, soft-wing goldfish, board octagons, cellular lanterns…',
      enabled: 'Kite enabled',
      enabledHint: 'When off, the kite lands and the canvas is hidden.',
      intensity: 'Wind / size',
      intensityHint: 'Scales kite size and wind strength (0.3–2).',
      responsiveness: 'Altitude response',
      responsivenessHint: 'How strongly activity maps to altitude (0.3–2).',
      mouseWind: 'Mouse wind',
      mouseWindHint: 'The kite drifts toward the pointer; fast sweeps raise gusts.',
      switchOn: 'Switch kite on',
      switchOnHint: 'Check the events that should swap in a fresh kite (no-repeat shuffle bag).',
      switch_session: 'New session', switch_turn: 'Turn', switch_fail: 'Error',
      switch_agent: 'Subagent', switch_milestone: 'Milestone', switch_finale: 'Finale', switch_tool: 'Tool',
      region: 'Display region',
      regionHint: 'The kite flies only inside this region.',
      regionFullscreen: 'Fullscreen',
      regionLeft: 'Left sidebar strip',
      regionRight: 'Right sidebar strip',
      regionBottomLeft: 'Bottom-left corner',
      regionBottomRight: 'Bottom-right corner',
      preferredFrame: 'Current kite',
      preferredFrameHint: '"Shuffle" draws from a no-repeat shuffle bag; or pin any exact kite (grouped by frame).',
      preferredAuto: 'Shuffle (never repeats)',
      kiteGallery: 'Kite gallery',
      kiteGalleryHint: 'Toggle frames; disabled frames are skipped by the shuffle bag.',
      cards: '{n} kites',
      testFly: 'Test fly',
      testLift: 'Lift',
      testDive: 'Dive',
      testLoop: 'Loop',
      testRespawn: 'Next kite',
      testAll: 'Full show',
      decal: 'Custom decal',
      decalHint: 'Upload a photo to glue onto the sail: it follows the kite pose with an affine warp — full face when frontal, foreshortened when side-on, translucent canvas back when flipped.',
      decalEnable: 'Use decal',
      decalOpacity: 'Decal opacity',
      decalUpload: 'Upload image',
      decalRemove: 'Remove',
      decalUploaded: 'Uploaded ✓ (persists across restarts)',
      decalFailed: 'Upload failed: image must be png/jpeg/webp and ≤660KB',
      status: 'Status',
      statusLive: 'Connected to host event stream',
      statusConnecting: 'Connecting to host event stream…',
      statusOff: 'Not connected (host plugin disabled or page just loaded)',
      engineStats: 'Flying {variant} ({family}) · altitude {alt}% · activity {act}% · wind {wind}',
      loading: 'Loading config…',
      save: 'Save',
      saved: 'Saved ✓',
      retry: 'Retry',
      reducedMotion: 'Your system prefers reduced motion — the kite is parked. Turn on "Ignore reduced motion" below to force flying.',
      ignoreReducedMotion: 'Ignore system "reduce motion"',
      ignoreReducedMotionHint: 'Fly the kite even when the OS prefers reduced motion.',
      demoHint: 'Tip: append ?kite=demo to the URL for a looping demo; __dshKite.next() in the console swaps kites.',
    }

    const LOCALE_DICT = { zh: ZH, en: EN }
    const API = '/dsh-kite/api'

    // ── 漂浮画布 ─────────────────────────────────────────────────────────────

    /** 显示范围：与 dsh-fireworks 同款区域键。默认全屏——风筝就是要到处飞。 */
    const REGION_CSS = {
      fullscreen: { top: '0', left: '0', width: '100vw', height: '100vh' },
      left: { top: '0', bottom: '0', left: '0', right: 'auto', width: 'clamp(220px, 24vw, 400px)', height: 'auto' },
      right: { top: '0', bottom: '0', left: 'auto', right: '0', width: 'clamp(220px, 24vw, 400px)', height: 'auto' },
      'bottom-left': { top: 'auto', bottom: '0', left: '0', right: 'auto', width: 'clamp(280px, 38vw, 560px)', height: 'clamp(240px, 46vh, 480px)' },
      'bottom-right': { top: 'auto', bottom: '0', left: 'auto', right: '0', width: 'clamp(280px, 38vw, 560px)', height: 'clamp(240px, 46vh, 480px)' },
    }

    function mountOverlay() {
      const canvas = document.createElement('canvas')
      canvas.setAttribute('data-dsh-kite', '')
      canvas.style.cssText = 'position:fixed;pointer-events:none;z-index:2147482000'
      document.body.appendChild(canvas)

      const engine = createKiteEngine(canvas, {})
      let overlayEnabled = true

      let region = 'fullscreen'
      const applyRegion = (r) => {
        region = REGION_CSS[r] ? r : 'fullscreen'
        const css = REGION_CSS[region]
        for (const k of ['top', 'bottom', 'left', 'right', 'width', 'height']) canvas.style[k] = ''
        for (const [k, v] of Object.entries(css)) canvas.style[k] = v
        engine.resize()
      }
      applyRegion(region)

      const onResize = () => engine.resize()
      window.addEventListener('resize', onResize)
      const onVisibility = () => engine.setEnabled(!document.hidden && overlayEnabled)
      document.addEventListener('visibilitychange', onVisibility)

      // 鼠标联动:窗口任意处的指针移动都映射进画布归一化坐标喂给引擎
      // (画布 pointer-events:none 收不到事件;区域非全屏时由 rect 负责换算)
      const onPointerMove = (e) => {
        const r = canvas.getBoundingClientRect()
        if (!r.width || !r.height) return
        const nx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
        const ny = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
        engine.setMouse(nx, ny)
      }
      window.addEventListener('pointermove', onPointerMove, { passive: true })

      return {
        engine,
        setEnabled(v) {
          overlayEnabled = !!v
          engine.setEnabled(overlayEnabled && !document.hidden)
          canvas.style.display = overlayEnabled ? '' : 'none'
        },
        setRegion: applyRegion,
        dispose() {
          window.removeEventListener('resize', onResize)
          document.removeEventListener('visibilitychange', onVisibility)
          window.removeEventListener('pointermove', onPointerMove)
          engine.dispose()
          canvas.remove()
        },
      }
    }

    // ── 主题色调自适应（事件驱动，无轮询；dsh-fireworks 同款判定）────────────
    function detectTone() {
      try {
        const root = document.documentElement
        const body = document.body
        const source = (root.getAttribute('data-ds-theme-source') || '').toLowerCase()
        if (source === 'dark') return 'dark'
        if (source === 'light') return 'light'
        if (body && body.hasAttribute('data-ds-dark-theme')) return 'dark'
        let el = document.elementFromPoint(Math.floor(innerWidth / 2), Math.floor(innerHeight * 0.55))
        let guard = 0
        while (el && guard++ < 12) {
          const bg = getComputedStyle(el).backgroundColor
          const m = bg && bg.match(/rgba?\(([^)]+)\)/)
          if (m) {
            const parts = m[1].split(',').map((s) => Number(s.trim()))
            const [r, g2, b] = parts
            const a = parts.length > 3 ? parts[3] : 1
            if (Number.isNaN(r) || a === 0) { el = el.parentElement; continue }
            return (0.2126 * r + 0.7152 * g2 + 0.0722 * b) > 150 ? 'light' : 'dark'
          }
          el = el.parentElement
        }
      } catch { /* 采样失败保持默认 */ }
      return 'dark'
    }

    // ── SSE 帧 → 引擎 ────────────────────────────────────────────────────────

    function dispatchFrame(overlay, ev) {
      if (!ev || typeof ev !== 'object') return
      try {
        if (ev.type === 'state') {
          overlay.engine.setActivity(ev.activity)
          overlay.engine.setTierFloor(ev.tier)
        } else if (ev.type === 'pulse') {
          overlay.engine.pulse(ev.kind, ev)
        }
      } catch { /* 坏帧忽略 */ }
    }

    // ── 设置页 ───────────────────────────────────────────────────────────────

    /** 骨架缩略图：该骨架的第一张卡直接走 paintSail。 */
    function KiteThumb({ card, tone }) {
      const h = React.createElement
      const ref = React.useRef(null)
      React.useEffect(() => {
        const cv = ref.current
        if (!cv || !card) return
        try {
          const g2 = cv.getContext('2d')
          const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)
          const S = 76
          cv.width = S * dpr
          cv.height = S * dpr
          g2.setTransform(dpr, 0, 0, dpr, 0, 0)
          g2.clearRect(0, 0, S, S)
          KiteCards.paintSail({ g: g2, w: S, h: S, card, tone, rng: KiteCards.mulberry32(11) })
        } catch { /* 缩略图失败不影响面板 */ }
      }, [card, tone])
      return h('canvas', {
        ref,
        style: { width: '38px', height: '38px', flex: 'none' },
        'aria-hidden': 'true',
      })
    }

    function KitePanel({ t }) {
      const h = React.createElement
      const [config, setConfig] = React.useState(null)
      const [loadError, setLoadError] = React.useState(false)
      const [savedTick, setSavedTick] = React.useState(false)
      const [decalTick, setDecalTick] = React.useState('')
      const [decalUrl, setDecalUrl] = React.useState(null)
      const [liveState, setLiveState] = React.useState('connecting')
      const [stats, setStats] = React.useState(null)
      const tone = React.useState(() => (typeof detectTone === 'function' ? detectTone() : 'dark'))[0]

      const load = React.useCallback(() => {
        setLoadError(false)
        fetch(API + '/config', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
          .then((cfg) => { setConfig(cfg); return fetch(API + '/decal', { cache: 'no-store' }) })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d && d.dataUrl) setDecalUrl(d.dataUrl) })
          .catch(() => setLoadError(true))
      }, [])

      React.useEffect(() => { load() }, [load])

      React.useEffect(() => {
        const timer = setInterval(() => {
          const rt = window.__dshKite
          if (rt) {
            setLiveState(rt.liveState())
            setStats(rt.stats())
          }
        }, 1000)
        return () => clearInterval(timer)
      }, [])

      const save = (next) => {
        setConfig(next)
        fetch(API + '/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        }).then((r) => {
          if (!r.ok) throw new Error('bad status')
          setSavedTick(true)
          setTimeout(() => setSavedTick(false), 1500)
          if (window.__dshKite) window.__dshKite.applyConfig(next)
        }).catch(() => load()) // 保存失败不假装成功：回读宿主真实配置
      }

      const testFly = (kind) => {
        fetch(API + '/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, magnitude: 0.7 }),
        }).catch(() => {})
      }

      /** 文件 → 压缩 dataURL（≤640px；png 保透明，其余 jpeg）。 */
      const fileToDataUrl = (file) => new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          try {
            const max = 640
            const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
            const cv = document.createElement('canvas')
            cv.width = Math.max(1, Math.round(img.naturalWidth * scale))
            cv.height = Math.max(1, Math.round(img.naturalHeight * scale))
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
            URL.revokeObjectURL(url)
            const png = file.type === 'image/png'
            resolve(cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85))
          } catch (e) { URL.revokeObjectURL(url); reject(e) }
        }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')) }
        img.src = url
      })

      const uploadDecal = async (file) => {
        if (!file) return
        try {
          let dataUrl = await fileToDataUrl(file)
          let r = await fetch(API + '/decal', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl }),
          })
          if (!r.ok && dataUrl.startsWith('data:image/png')) {
            // png 超限时降级 jpeg 480 再试一发
            const img = new Image()
            img.src = dataUrl
            await new Promise((res) => { img.onload = res; img.onerror = res })
            const cv = document.createElement('canvas')
            const s2 = Math.min(1, 480 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
            cv.width = Math.max(1, Math.round((img.naturalWidth || 1) * s2))
            cv.height = Math.max(1, Math.round((img.naturalHeight || 1) * s2))
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
            dataUrl = cv.toDataURL('image/jpeg', 0.8)
            r = await fetch(API + '/decal', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dataUrl }),
            })
          }
          if (!r.ok) throw new Error('upload rejected')
          setDecalUrl(dataUrl)
          setDecalTick('ok')
          setTimeout(() => setDecalTick(''), 2500)
          if (window.__dshKite) window.__dshKite.reloadDecal()
        } catch {
          setDecalTick('fail')
          setTimeout(() => setDecalTick(''), 4000)
        }
      }

      const removeDecal = () => {
        fetch(API + '/decal', { method: 'DELETE' }).catch(() => {})
        setDecalUrl(null)
        if (window.__dshKite) window.__dshKite.reloadDecal()
      }

      if (config === null && !loadError) return h('p', { style: { opacity: 0.7 } }, t('loading'))
      if (loadError && config === null) {
        return h('div', null,
          h('p', { style: { color: 'var(--dsw-alias-label-error, #e06c75)' } }, t('statusOff')),
          h('button', { type: 'button', onClick: load }, t('retry')))
      }

      const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      const frameIds = Object.keys(KiteCards.FRAMES)
      const toggleFrame = (fid) => save(Object.assign({}, config, {
        frames: Object.assign({}, config.frames, { [fid]: config.frames[fid] === false ? true : false }),
      }))
      const btn = { fontSize: '12px', padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))', background: 'transparent', color: 'inherit', cursor: 'pointer' }
      const row = { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.15))' }
      const label = { flex: 1, fontSize: '13px' }
      const hint = { display: 'block', opacity: 0.6, fontSize: '12px', marginTop: '2px' }
      const selectStyle = { fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))', background: 'transparent', color: 'inherit' }

      return h('div', { style: { maxWidth: '560px' } },
        h('p', { style: { opacity: 0.75, fontSize: '13px', lineHeight: 1.6 } }, t('intro')),

        reducedMotion && !config.ignoreReducedMotion && h('p', { style: { color: 'var(--dsw-alias-label-warning, #d19a66)', fontSize: '12px' } }, t('reducedMotion')),

        // 总开关
        h('div', { style: row },
          h('span', { style: label }, t('enabled'), h('span', { style: hint }, t('enabledHint'))),
          h('input', {
            type: 'checkbox', checked: !!config.enabled,
            onChange: (e) => save(Object.assign({}, config, { enabled: e.target.checked })),
          })),

        h('div', { style: row },
          h('span', { style: label }, t('ignoreReducedMotion'), h('span', { style: hint }, t('ignoreReducedMotionHint'))),
          h('input', {
            type: 'checkbox', checked: !!config.ignoreReducedMotion,
            onChange: (e) => save(Object.assign({}, config, { ignoreReducedMotion: e.target.checked })),
          })),

        // 风力 / 高度响应
        h('div', { style: row },
          h('span', { style: label }, t('intensity'), h('span', { style: hint }, t('intensityHint'))),
          h('input', {
            type: 'range', min: 0.3, max: 2, step: 0.1, value: config.intensity,
            onChange: (e) => save(Object.assign({}, config, { intensity: Number(e.target.value) })),
          }),
          h('code', { style: { fontSize: '12px', minWidth: '30px', textAlign: 'right' } }, Number(config.intensity).toFixed(1))),

        h('div', { style: row },
          h('span', { style: label }, t('responsiveness'), h('span', { style: hint }, t('responsivenessHint'))),
          h('input', {
            type: 'range', min: 0.3, max: 2, step: 0.1, value: config.responsiveness,
            onChange: (e) => save(Object.assign({}, config, { responsiveness: Number(e.target.value) })),
          }),
          h('code', { style: { fontSize: '12px', minWidth: '30px', textAlign: 'right' } }, Number(config.responsiveness).toFixed(1))),

        // 鼠标联动
        h('div', { style: row },
          h('span', { style: label }, t('mouseWind'), h('span', { style: hint }, t('mouseWindHint'))),
          h('input', {
            type: 'checkbox', checked: config.mouseWind !== false,
            onChange: (e) => save(Object.assign({}, config, { mouseWind: e.target.checked })),
          })),

        // 换新时机:勾选哪些事件就当场换一只新风筝
        h('div', { style: row },
          h('span', { style: label }, t('switchOn'), h('span', { style: hint }, t('switchOnHint'))),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'flex-end', maxWidth: '300px' } },
            ['session', 'turn', 'fail', 'agent', 'milestone', 'finale', 'tool'].map((k) =>
              h('label', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' } },
                h('input', {
                  type: 'checkbox',
                  checked: config.switchOn ? config.switchOn[k] !== false : k !== 'tool',
                  onChange: (e) => {
                    const cur = Object.assign({ session: true, turn: true, fail: true, agent: true, milestone: true, finale: true, tool: false }, config.switchOn)
                    cur[k] = e.target.checked
                    save(Object.assign({}, config, { switchOn: cur }))
                  },
                }),
                t('switch_' + k))))),

        // 显示范围
        h('div', { style: row },
          h('span', { style: label }, t('region'), h('span', { style: hint }, t('regionHint'))),
          h('select', { value: config.region || 'fullscreen', style: selectStyle,
            onChange: (e) => save(Object.assign({}, config, { region: e.target.value })) },
            h('option', { value: 'fullscreen' }, t('regionFullscreen')),
            h('option', { value: 'left' }, t('regionLeft')),
            h('option', { value: 'right' }, t('regionRight')),
            h('option', { value: 'bottom-left' }, t('regionBottomLeft')),
            h('option', { value: 'bottom-right' }, t('regionBottomRight')))),

        // 当前风筝:按骨架分组列出全部卡(形象)——同骨架多只(如圆月×3),可钉住任意一只
        h('div', { style: row },
          h('span', { style: label }, t('preferredFrame'), h('span', { style: hint }, t('preferredFrameHint'))),
          (() => {
            const want = config.preferredFrame || 'auto'
            // 旧配置可能存的是骨架 id:解析成该骨架第一张卡用于回显
            const known = want === 'auto' || KiteCards.ALL_CARDS.some((cd) => cd.id === want)
              ? want
              : ((KiteCards.CARDS_BY_FRAME[want] || [])[0] || { id: 'auto' }).id
            return h('select', { value: known, style: selectStyle,
              onChange: (e) => save(Object.assign({}, config, { preferredFrame: e.target.value })) },
              h('option', { value: 'auto' }, t('preferredAuto')),
              frameIds.map((fid) => h('optgroup', { key: fid, label: `${KiteCards.FRAMES[fid].name} ${KiteCards.FRAMES[fid].nameEn}` },
                (KiteCards.CARDS_BY_FRAME[fid] || []).map((cd) =>
                  h('option', { key: cd.id, value: cd.id }, `${cd.name} ${cd.nameEn}`)))))
          })()),

        // 风筝谱系（缩略图 + 逐骨架开关）
        h('h4', { style: { margin: '18px 0 4px', fontSize: '13px' } }, t('kiteGallery')),
        h('p', { style: { opacity: 0.6, fontSize: '12px', margin: '0 0 6px' } }, t('kiteGalleryHint')),
        ...frameIds.map((fid) => {
          const frame = KiteCards.FRAMES[fid]
          const rep = (KiteCards.CARDS_BY_FRAME[fid] || [])[0]
          const on = config.frames ? config.frames[fid] !== false : true
          return h('div', { key: fid, style: row },
            h(KiteThumb, { card: rep, tone }),
            h('span', { style: label },
              `${frame.name} · ${KiteCards.FAMILY_ZH[frame.family]}`,
              h('span', { style: hint },
                `${frame.nameEn} · ${KiteCards.FAMILY_EN[frame.family]} · ${t('cards', { n: (KiteCards.CARDS_BY_FRAME[fid] || []).length })}`)),
            h('input', {
              type: 'checkbox', checked: on,
              onChange: () => toggleFrame(fid),
            }))
        }),

        // 自定义贴图
        h('h4', { style: { margin: '18px 0 4px', fontSize: '13px' } }, t('decal')),
        h('p', { style: { opacity: 0.6, fontSize: '12px', margin: '0 0 6px', lineHeight: 1.6 } }, t('decalHint')),
        h('div', { style: Object.assign({}, row, { flexWrap: 'wrap' }) },
          decalUrl && h('img', {
            src: decalUrl,
            alt: '',
            style: { width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))' },
          }),
          h('label', { style: btn },
            t('decalUpload'),
            h('input', {
              type: 'file', accept: 'image/png,image/jpeg,image/webp', style: { display: 'none' },
              onChange: (e) => { uploadDecal(e.target.files && e.target.files[0]); e.target.value = '' },
            })),
          h('button', { type: 'button', style: btn, onClick: removeDecal, disabled: !decalUrl }, t('decalRemove')),
          decalTick === 'ok' && h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-success, #5cd6a8)' } }, t('decalUploaded')),
          decalTick === 'fail' && h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-error, #e06c75)' } }, t('decalFailed'))),
        h('div', { style: row },
          h('span', { style: label }, t('decalEnable')),
          h('input', {
            type: 'checkbox', checked: !!config.decalEnabled && !!decalUrl,
            disabled: !decalUrl,
            onChange: (e) => save(Object.assign({}, config, { decalEnabled: e.target.checked })),
          })),
        h('div', { style: row },
          h('span', { style: label }, t('decalOpacity')),
          h('input', {
            type: 'range', min: 0.3, max: 1, step: 0.05, value: config.decalOpacity,
            onChange: (e) => save(Object.assign({}, config, { decalOpacity: Number(e.target.value) })),
          }),
          h('code', { style: { fontSize: '12px', minWidth: '30px', textAlign: 'right' } }, Number(config.decalOpacity).toFixed(2))),

        // 试飞按钮组
        h('h4', { style: { margin: '18px 0 4px', fontSize: '13px' } }, t('testFly')),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { type: 'button', style: btn, onClick: () => testFly('turn') }, t('testLift')),
          h('button', { type: 'button', style: btn, onClick: () => testFly('tool') }, '✨'),
          h('button', { type: 'button', style: btn, onClick: () => testFly('fail') }, t('testDive')),
          h('button', { type: 'button', style: btn, onClick: () => testFly('milestone') }, t('testLoop')),
          h('button', { type: 'button', style: btn, onClick: () => testFly('session') }, t('testRespawn')),
          h('button', {
            type: 'button', style: btn,
            onClick: () => ['turn', 'tool', 'fail', 'milestone', 'session'].forEach((k, i) => setTimeout(() => testFly(k), i * 1600)),
          }, '🪁 ' + t('testAll'))),

        // 状态
        h('h4', { style: { margin: '18px 0 4px', fontSize: '13px' } }, t('status')),
        h('p', { style: { fontSize: '12px', opacity: 0.75 } },
          liveState === 'live' ? '🟢 ' + t('statusLive')
            : liveState === 'connecting' ? '🟡 ' + t('statusConnecting')
              : '🔴 ' + t('statusOff')),
        stats && h('p', { style: { fontSize: '12px', opacity: 0.6 } },
          t('engineStats', {
            variant: stats.variant || '—',
            family: stats.family || '—',
            alt: Math.round((stats.altitude || 0) * 100),
            act: Math.round((stats.activity || 0) * 100),
            wind: (stats.wind || 0).toFixed(2),
          })),
        savedTick && h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-success, #5cd6a8)' } }, t('saved')),
        h('p', { style: { fontSize: '12px', opacity: 0.5, marginTop: '14px' } }, t('demoHint')))
    }

    // ── 插件入口 ─────────────────────────────────────────────────────────────

    module.exports = {
      name: '@weibaohui/dsh-kite',
      inject: ['slots', 'locale'],

      apply(ctx) {
        const slots = ctx.get('slots')
        if (slots === undefined) return
        const locale = ctx.get('locale')
        const tRaw = locale && typeof locale.bind === 'function' ? locale.bind(LOCALE_NS) : null
        const t = (key, vars) => {
          let out = (tRaw && tRaw(key)) || ZH[key] || key
          if (vars) for (const [k, v] of Object.entries(vars)) out = out.split('{' + k + '}').join(String(v))
          return out
        }
        if (locale && typeof locale.register === 'function') {
          ctx.effect(() => locale.register(LOCALE_NS, LOCALE_DICT))
        }

        // ── 画布浮层 + 引擎 ────────────────────────────────────────────────
        const overlay = mountOverlay()
        ctx.effect(() => () => overlay.dispose(), 'dsh-kite: overlay')

        // ── 贴图装载 ───────────────────────────────────────────────────────
        let decalCache = null
        const reloadDecal = () => {
          fetch(API + '/decal', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (!d || !d.dataUrl) { decalCache = null; overlay.engine.setDecal(null); return }
              if (d.dataUrl === decalCache) return
              decalCache = d.dataUrl
              const img = new Image()
              img.onload = () => overlay.engine.setDecal(img)
              img.src = d.dataUrl
            })
            .catch(() => {})
        }
        reloadDecal()

        // ── 配置装载 ───────────────────────────────────────────────────────
        const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
        const applyConfig = (cfg) => {
          if (!cfg || typeof cfg !== 'object') return
          const allowMotion = !reducedMotion || cfg.ignoreReducedMotion === true
          overlay.setEnabled(cfg.enabled !== false && allowMotion)
          overlay.engine.setIntensity(typeof cfg.intensity === 'number' ? cfg.intensity : 1)
          overlay.engine.setResponsiveness(typeof cfg.responsiveness === 'number' ? cfg.responsiveness : 1)
          overlay.engine.setMouseWind(cfg.mouseWind !== false)
          overlay.engine.setSwitchOn(cfg.switchOn && typeof cfg.switchOn === 'object' ? cfg.switchOn : null)
          overlay.setRegion(typeof cfg.region === 'string' ? cfg.region : 'fullscreen')
          const frames = cfg.frames && typeof cfg.frames === 'object' ? cfg.frames : {}
          overlay.engine.setEnabledPredicate((c) => frames[c.frame] !== false)
          overlay.engine.setPreferred(typeof cfg.preferredFrame === 'string' ? cfg.preferredFrame : 'auto')
          // 钉住的骨架与当前不一致时立即换过去（换新袋仍保证不重样）
          try {
            const cur = overlay.engine.getVariant()
            const want = cfg.preferredFrame
            if (want && want !== 'auto' && cur && cur.id !== want && cur.frame !== want) {
              overlay.engine.nextVariant()
            }
          } catch { /* 当前卡未知时跳过 */ }
          overlay.engine.setDecalEnabled(cfg.decalEnabled === true)
          overlay.engine.setDecalOpacity(typeof cfg.decalOpacity === 'number' ? cfg.decalOpacity : 0.9)
          reloadDecal()
        }
        fetch(API + '/config', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then((cfg) => applyConfig(cfg))
          .catch(() => {})

        // ── 主题色调跟随（事件驱动，无轮询）────────────────────────────────
        const applyTone = () => overlay.engine.setToneMode(detectTone())
        applyTone()
        try {
          const toneMo = new MutationObserver(applyTone)
          toneMo.observe(document.documentElement, { attributes: true })
          if (document.body) toneMo.observe(document.body, { attributes: true })
          const toneMq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
          if (toneMq && toneMq.addEventListener) toneMq.addEventListener('change', applyTone)
          ctx.effect(() => () => {
            toneMo.disconnect()
            if (toneMq && toneMq.removeEventListener) toneMq.removeEventListener('change', applyTone)
          }, 'dsh-kite: tone')
        } catch { /* 保留挂载时探测结果 */ }

        // ── 天空状态：事件枢纽优先，缺席回退短轮询 ──────────────────────────
        // dsh web 是 h1.1，同源并发只有 ~6 条；每个插件各开一条永久 SSE 会把
        // 预算占满、首页全部排队（实测阻塞）。dsh-event-hub 在场时经共享连接
        // 订阅（零额外连接）；缺席时 3s 轮询 /updates?since=seq —— 每次请求
        // 毫秒级释放，脉冲经服务端环形日志增量补发，页面隐藏时暂停轮询。
        let liveState = 'connecting'
        let lastSeq = 0
        let pollTimer = null
        let pollBusy = false
        const pollUpdates = () => {
          if (pollBusy || document.hidden) return
          pollBusy = true
          fetch(API + '/updates?since=' + lastSeq, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
            .then((data) => {
              liveState = 'live'
              lastSeq = Number(data.seq) || lastSeq
              if (data.state) dispatchFrame(overlay, { type: 'state', activity: data.state.activity, tier: data.state.tier })
              if (Array.isArray(data.missed)) {
                for (const frame of data.missed) {
                  try { dispatchFrame(overlay, frame) } catch { /* 坏帧忽略 */ }
                }
              }
            })
            .catch(() => { liveState = 'connecting' })
            .finally(() => { pollBusy = false })
        }
        const hubOff = PluginKit.connectEvents('dsh-kite', (data) => {
          // 宿主发布帧自带 type(state|pulse)与完整 payload(tier 等)，直接透传
          dispatchFrame(overlay, data)
        }, (s) => { liveState = s })
        if (!hubOff) {
          pollUpdates()
          pollTimer = setInterval(pollUpdates, 3000)
        }
        const onVisChange = () => { if (!document.hidden && !hubOff) pollUpdates() }
        document.addEventListener('visibilitychange', onVisChange)
        ctx.effect(() => () => {
          if (hubOff) try { hubOff() } catch {}
          if (pollTimer) clearInterval(pollTimer)
          document.removeEventListener('visibilitychange', onVisChange)
        }, 'dsh-kite: events')

        // ── 调试/演示入口 ──────────────────────────────────────────────────
        window.__dshKite = {
          engine: overlay.engine,
          cards: typeof KiteCards !== 'undefined' ? KiteCards : null,
          pulse: (kind, payload) => dispatchFrame(overlay, Object.assign({ type: 'pulse', kind: kind || 'turn', magnitude: 0.7 }, payload || {})),
          next: () => overlay.engine.nextVariant(),
          applyConfig,
          reloadDecal,
          stats: () => overlay.engine.stats(),
          liveState: () => liveState,
        }
        ctx.effect(() => () => { try { delete window.__dshKite } catch {} }, 'dsh-kite: debug api')

        // ?kite=demo：循环试飞（开发/演示用）——活动度模拟一条忙碌曲线
        let demoTimer = null
        try {
          if (typeof location !== 'undefined' && /[?&]kite=demo\b/.test(location.search)) {
            let i = 0
            const kinds = ['turn', 'tool', 'tool', 'fail', 'milestone', 'turn', 'session', 'finale']
            demoTimer = setInterval(() => {
              const kind = kinds[i % kinds.length]
              i += 1
              overlay.engine.setActivity(0.45 + 0.4 * Math.abs(Math.sin(i * 0.7)))
              overlay.engine.setTierFloor(i % kinds.length === 4 ? 2 : 1)
              dispatchFrame(overlay, { type: 'pulse', kind, magnitude: 0.5 + (i % 4) * 0.12 })
            }, 3400)
          }
        } catch { /* location 不可用时跳过 */ }
        ctx.effect(() => () => { if (demoTimer) clearInterval(demoTimer) }, 'dsh-kite: demo')

        // ── 设置页 ─────────────────────────────────────────────────────────
        slots.inject('settings.section', () => slots.register(
          {
            name: 'settings.section',
            id: '@weibaohui/dsh-kite',
            order: 33,
            label: () => t('nav'),
            locale: LOCALE_NS,
          },
          () => React.createElement(KitePanel, { t })
        ))
      },
    }
    return module.exports
  }
})
