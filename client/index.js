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
  lineColor: '风筝线',
  lineColorHint: '线绳墨色：随主题、彩虹流转（越忙转得越快）或自定义纯色。',
  lineAuto: '随主题', lineRainbow: '彩虹流转', lineCustom: '自定义',
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
  lineColor: 'Kite line',
  lineColorHint: 'Line ink: theme-following, rainbow flow (faster when busy), or a fixed color.',
  lineAuto: 'Theme', lineRainbow: 'Rainbow flow', lineCustom: 'Custom',
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

    // 风筝线:随主题 / 彩虹流转 / 自定义纯色
    (() => {
      const lc = typeof config.lineColor === 'string' ? config.lineColor : 'auto'
      const sel = lc === 'auto' || lc === 'rainbow' ? lc : 'custom'
      const hexv = /^#[0-9a-f]{6}$/i.test(lc) ? lc : '#7fd4ff'
      return h('div', { style: row },
        h('span', { style: label }, t('lineColor'), h('span', { style: hint }, t('lineColorHint'))),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('select', { value: sel, style: selectStyle,
            onChange: (e) => save(Object.assign({}, config, { lineColor: e.target.value === 'custom' ? hexv : e.target.value })) },
            h('option', { value: 'auto' }, t('lineAuto')),
            h('option', { value: 'rainbow' }, t('lineRainbow')),
            h('option', { value: 'custom' }, t('lineCustom'))),
          h('input', { type: 'color', value: hexv, title: t('lineCustom'),
            onChange: (e) => save(Object.assign({}, config, { lineColor: e.target.value })) })))
    })(),

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
      overlay.engine.setLineColor(typeof cfg.lineColor === 'string' ? cfg.lineColor : 'auto')
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
