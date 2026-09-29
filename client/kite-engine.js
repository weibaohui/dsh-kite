'use strict'

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
    const targetAlt = clamp(0.16 + activityShown * 0.62 * responsiveness + Math.min(6, tierFloor) * 0.045, 0.04, 0.95)
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
if (typeof module !== 'undefined' && module.exports) module.exports = KiteEngine
/* node-test-export-end */
