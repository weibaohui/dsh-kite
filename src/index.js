'use strict'

/**
 * dsh-kite — Host half
 *
 * 把 agent 的工作节奏翻译成一只风筝的天空状态：
 *
 *   assistant/message → energy   会话能量池：output + 0.2×(input+cache) 累入，
 *                                  按 τ≈75s 指数衰减；energy 经 log 曲线映射成
 *                                  activity（0..1）→ 风筝的目标高度
 *   跨档累计 output   → milestone 里程碑（2k/8k/20k/50k/120k/300k）→
 *                                  抬升「基础高度地板」并发放翻滚脉冲
 *   turn/end          → turn     回合阵风：上升冲量
 *   tool/result ok    → tool     工具微风（1.4s 合批）
 *   tool/result error → fail     俯冲脉冲（2s 合批，克制）
 *   todo/write 全完成 → finale   收工：双圈翻滚庆祝
 *   session/created   → session  换一只新风筝（洗牌袋抽取，不与上一只重复）
 *   session/created(子 agent) → agent 子代理启动，可作换新时机(config.switchOn)
 *
 * SSE（GET /dsh-kite/api/stream）广播两类帧：
 *   { type:'state', activity, tier }   天空状态（订阅即推当前值，变化节流推送）
 *   { type:'pulse', kind, magnitude }  瞬时阵风/动作脉冲
 *
 * 配置与用户贴图存 storageDomain（域 dsh_kite，表 config：键 config / decal），
 * 经 GET/POST /dsh-kite/api/config 与 GET/PUT/DELETE /dsh-kite/api/decal 读写。
 * 贴图只存 data URL（客户端已压到 ≤640px），宿主只做形状与大小校验。
 *
 * 路由信任栅栏沿用 dsh-fireworks 同款：connection.requestRejection 的
 * Host/Origin 检查 + 浏览器认证。零 npm 运行时依赖。
 */

/** 里程碑档位（会话累计 output tokens），与 dsh-fireworks 同档。 */
const MILESTONE_TIERS = [2000, 8000, 20000, 50000, 120000, 300000]

// 共享事件推送枢纽（@weibaohui/dsh-plugin-kit ≥0.4）：库缺席（未安装）时为
// undefined，广播回退自有 SSE 通道——独立安装不受影响。
let ensureHostHub
try { ({ ensureHostHub } = require('@weibaohui/dsh-plugin-kit')) } catch { /* 库缺席 */ }

/** activity 的「满档」能量参考值：activity = log2(1+energy)/log2(1+REF)。 */
const ENERGY_REF = 20000

/** 能量衰减时间常数 ms：agent 停手约 75s 后风筝缓缓落回低空。 */
const ENERGY_TAU_MS = 75000

/** 能量池单次入池上限（超大回合按上限计，防一次性把能量顶爆）。 */
const ENERGY_CHUNK_CAP = 60000

/** 状态变化推送阈值与最小间隔；兜底心跳周期。 */
const STATE_EPSILON = 0.02
const STATE_MIN_GAP_MS = 700
const STATE_HEARTBEAT_MS = 15000

/** 工具微风合批窗口与上限。 */
const TOOL_BATCH_MS = 1400
const TOOL_BATCH_MAX = 6

/** 失败俯冲合批窗口与上限。 */
const FAIL_BATCH_MS = 2000
const FAIL_BATCH_MAX = 2

/** finale 每会话冷却 ms。 */
const FINALE_COOLDOWN_MS = 5 * 60 * 1000

/** 脉冲限流：令牌桶，5s 补满 20 发，防子 agent 风暴把风筝吹成帕金森。 */
const PULSE_CAPACITY = 20
const PULSE_REFILL_MS = 5000

/** 用户贴图：data URL 的形状与长度上限（~660KB 二进制）。 */
const DECAL_URL_RE = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/
const DECAL_MAX_CHARS = 900000

const DEFAULT_CONFIG = {
  enabled: true,
  intensity: 1,          // 0.3..2 风力/体型缩放
  region: 'fullscreen',  // 显示范围：fullscreen | left | right | bottom-left | bottom-right
  responsiveness: 1,     // 0.3..2 活动度→高度的响应系数
  mouseWind: true,       // 鼠标联动:风场朝指针方向偏置
  switchOn: {            // 哪些事件触发换新风筝(引擎侧还有 10s 冷却防抖)
    session: true,       // 新顶层会话
    turn: true,          // 轮次结束(turn/end 且有产出)
    fail: true,          // 工具报错(批量合并后)
    agent: true,         // 子代理启动
    milestone: true,     // 里程碑跨档
    finale: true,        // 收工(todo 全清)
    tool: false,         // 普通工具调用(太频繁,默认关)
  },
  ignoreReducedMotion: false,
  preferredFrame: 'auto',  // 'auto' 或某个框架 id（客户端 kite-cards 校验）
  frames: {},            // { <框架id>: boolean } 缺席视为 true；客户端并全集
  decalEnabled: false,   // 是否把用户贴图糊上风筝面
  decalOpacity: 0.9,     // 0.3..1 贴图不透明度
}

/** 显示范围合法值（客户端 REGION_CSS 同名键）。 */
const REGIONS = ['fullscreen', 'left', 'right', 'bottom-left', 'bottom-right']

const CONFIG_KEY = 'config'
const DECAL_KEY = 'decal'
const MAX_BODY_BYTES = 16 * 1024
const MAX_DECAL_BODY_BYTES = 1100 * 1024

/** activity：能量 → 0..1（log2 曲线，与客户端 kite-cards.magnitudeOf 同式）。 */
function activityOf(energy, ref) {
  const R = ref > 0 ? ref : ENERGY_REF
  const t = Math.max(0, energy || 0)
  return Math.min(1, Math.log2(1 + t) / Math.log2(1 + R))
}

/** 读取 usage 对象中的正整数字段。 */
function usageNum(usage, key) {
  const v = usage && typeof usage === 'object' ? usage[key] : 0
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
}

/** 配置校验：宽松合并，坏字段回退默认值。 */
function normalizeConfig(raw) {
  const out = JSON.parse(JSON.stringify(DEFAULT_CONFIG))
  if (!raw || typeof raw !== 'object') return out
  if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled
  if (typeof raw.intensity === 'number' && Number.isFinite(raw.intensity)) {
    out.intensity = Math.min(2, Math.max(0.3, raw.intensity))
  }
  if (typeof raw.region === 'string' && REGIONS.includes(raw.region)) out.region = raw.region
  if (typeof raw.responsiveness === 'number' && Number.isFinite(raw.responsiveness)) {
    out.responsiveness = Math.min(2, Math.max(0.3, raw.responsiveness))
  }
  if (typeof raw.ignoreReducedMotion === 'boolean') out.ignoreReducedMotion = raw.ignoreReducedMotion
  if (typeof raw.mouseWind === 'boolean') out.mouseWind = raw.mouseWind
  if (raw.switchOn && typeof raw.switchOn === 'object' && !Array.isArray(raw.switchOn)) {
    for (const k of Object.keys(out.switchOn)) {
      if (typeof raw.switchOn[k] === 'boolean') out.switchOn[k] = raw.switchOn[k]
    }
  }
  if (typeof raw.preferredFrame === 'string' && (raw.preferredFrame === 'auto' ||
    (raw.preferredFrame.length > 0 && raw.preferredFrame.length <= 48 && /^[\w-]+$/.test(raw.preferredFrame)))) {
    out.preferredFrame = raw.preferredFrame
  }
  if (raw.frames && typeof raw.frames === 'object' && !Array.isArray(raw.frames)) {
    const keys = Object.keys(raw.frames).filter((k) => typeof k === 'string' && k.length <= 48).slice(0, 64)
    for (const k of keys) {
      if (typeof raw.frames[k] === 'boolean') out.frames[k] = raw.frames[k]
    }
  }
  if (typeof raw.decalEnabled === 'boolean') out.decalEnabled = raw.decalEnabled
  if (typeof raw.decalOpacity === 'number' && Number.isFinite(raw.decalOpacity)) {
    out.decalOpacity = Math.min(1, Math.max(0.3, raw.decalOpacity))
  }
  return out
}

/** 贴图校验：data URL 形状 + 长度上限；返回 null 表示无效。 */
function normalizeDecal(raw) {
  if (!raw || typeof raw !== 'object') return null
  const url = typeof raw.dataUrl === 'string' ? raw.dataUrl.trim() : ''
  if (!DECAL_URL_RE.test(url) || url.length > DECAL_MAX_CHARS) return null
  return { dataUrl: url, addedAt: Date.now() }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

module.exports = {
  name: 'dsh-kite',
  inject: ['webServer', 'connection', 'storageDomain'],

  // 供离线测试断言；Cordis 忽略多余导出属性。
  __internals: { activityOf, normalizeConfig, normalizeDecal, MILESTONE_TIERS, ENERGY_REF },

  apply(ctx) {
    // ── 配置/贴图持久化 ─────────────────────────────────────────────────
    const domainPromise = ctx.storageDomain.open({
      name: 'dsh_kite',
      version: 1,
      invalidRecords: 'backup-and-skip',
      // valueSchema 是 open 时逐条 parse 存量记录的契约：缺了它，表里一旦有
      // 记录整个域就打不开（dsh-fireworks 血泪）。形状归一由 normalize*
      // 负责，这里只做透传。
      tables: { config: { valueSchema: { parse: (v) => v } } },
    })
    let configTable = null
    let config = DEFAULT_CONFIG
    let decal = null
    domainPromise.then((domain) => {
      configTable = domain.table('config')
      const stored = configTable.get(CONFIG_KEY)
      if (stored && typeof stored === 'object') config = normalizeConfig(stored)
      const storedDecal = configTable.get(DECAL_KEY)
      const d = normalizeDecal(storedDecal)
      if (d) decal = d
    }).catch(() => { /* 存储不可用时用内存默认 */ })
    ctx.effect(() => () => {
      domainPromise.then((domain) => domain.close()).catch(() => {})
    }, 'dsh-kite: storage close')

    // ── SSE 订阅集 ──────────────────────────────────────────────────────
    const subscribers = new Set()
    let seq = 0
    /** 当前天空状态快照（新订阅者先收一帧）。 */
    let skyState = { activity: 0, tier: 0 }
    /** 帧日志（环形，容量 64）：HTTP 轮询客户端按 since 增量补帧，
     *  避免首页为风筝常驻占一条 h1.1 连接（同源并发只有 6 条）。 */
    const journal = []
    const JOURNAL_CAP = 64

    const sendFrame = (res, payload) => {
      try { res.write(`id: ${payload.seq}\ndata: ${JSON.stringify(payload)}\n\n`) } catch { subscribers.delete(res) }
    }
    const broadcast = (payload) => {
      // 共享事件枢纽（dsh-plugin-kit ≥0.4）在就优先发布；库缺席回退自有 SSE。
      // 枢纽模式的关键：即使自有 SSE 无订阅者，state 帧也要进枢纽与日志——
      // 轮询客户端靠 journal 增量补帧。
      try {
        const hub = ensureHostHub && ensureHostHub(ctx, { webServer: ctx.webServer, connection: ctx.connection })
        if (hub && typeof hub.publish === 'function') hub.publish('dsh-kite', payload)
      } catch { /* 枢纽缺席不影响自有通道 */ }
      seq += 1
      const frame = Object.assign({ seq }, payload)
      journal.push(frame)
      if (journal.length > JOURNAL_CAP) journal.splice(0, journal.length - JOURNAL_CAP)
      if (subscribers.size === 0) return
      for (const res of subscribers) sendFrame(res, frame)
    }

    // ── 脉冲限流（令牌桶）───────────────────────────────────────────────
    let bucket = PULSE_CAPACITY
    let lastRefill = Date.now()
    const allowPulse = () => {
      const now = Date.now()
      bucket = Math.min(PULSE_CAPACITY, bucket + (now - lastRefill) / PULSE_REFILL_MS * PULSE_CAPACITY)
      lastRefill = now
      if (bucket < 1) return false
      bucket -= 1
      return true
    }

    // ── 天空状态推送（阈值 + 最小间隔 + 兜底心跳）───────────────────────
    let lastPushAt = 0
    let lastPushed = { activity: -1, tier: -1 }
    const pushState = (force) => {
      const now = Date.now()
      if (!force) {
        if (Math.abs(skyState.activity - lastPushed.activity) < STATE_EPSILON && skyState.tier === lastPushed.tier) return
        if (now - lastPushAt < STATE_MIN_GAP_MS) return
      }
      lastPushAt = now
      lastPushed = { activity: skyState.activity, tier: skyState.tier }
      broadcast(Object.assign({ type: 'state', at: now }, skyState))
    }

    // 能量按 τ 衰减：所有会话统一懒衰减 + 定时兜底（无事件时风筝也会落）
    const decayEnergy = (st, now) => {
      const dt = now - (st.lastSeen || now)
      if (dt > 1000 && st.energy > 0.5) st.energy *= Math.exp(-dt / ENERGY_TAU_MS)
      st.lastSeen = now
    }
    const recompute = () => {
      const now = Date.now()
      let energy = 0
      let tier = 0
      for (const st of sessionState.values()) {
        decayEnergy(st, now)
        energy = Math.max(energy, st.energy)
        tier = Math.max(tier, st.tier)
      }
      skyState = { activity: activityOf(energy), tier }
      pushState(false)
    }
    ctx.effect(() => {
      const timer = setInterval(recompute, 5000)
      return () => clearInterval(timer)
    }, 'dsh-kite: energy decay timer')

    // ── 会话状态与事件分类 ──────────────────────────────────────────────
    /** sessionId → { energy, lastSeen, turnTokens, totalOutput, tier, okPending, okTimer, failPending, failTimer, finaleAt } */
    const sessionState = new Map()
    const stateOf = (id) => {
      let st = sessionState.get(id)
      if (!st) {
        st = { energy: 0, lastSeen: Date.now(), turnTokens: 0, totalOutput: 0, tier: 0, okPending: 0, okTimer: null, failPending: 0, failTimer: null, finaleAt: 0 }
        sessionState.set(id, st)
      }
      return st
    }

    const pulse = (kind, payload) => {
      if (!config.enabled) return
      if (!allowPulse()) return
      broadcast(Object.assign({ type: 'pulse', kind, at: Date.now() }, payload || {}))
    }

    const flushToolBatch = (id, st) => {
      if (st.okTimer) { clearTimeout(st.okTimer); st.okTimer = null }
      if (st.okPending > 0) {
        pulse('tool', { count: Math.min(TOOL_BATCH_MAX, st.okPending) })
        st.okPending = 0
      }
    }
    const flushFailBatch = (id, st) => {
      if (st.failTimer) { clearTimeout(st.failTimer); st.failTimer = null }
      if (st.failPending > 0) {
        pulse('fail', { count: Math.min(FAIL_BATCH_MAX, st.failPending) })
        st.failPending = 0
      }
    }

    const onSessionEvent = (session, event) => {
      try {
        if (!session || typeof session.id !== 'string') return
        if (!event || typeof event !== 'object') return
        const id = session.id
        const data = event.data && typeof event.data === 'object' ? event.data : {}
        const st = stateOf(id)
        decayEnergy(st, Date.now())

        switch (event.type) {
          case 'assistant/message': {
            const usage = data.usage
            if (usage && typeof usage === 'object') {
              const out = usageNum(usage, 'outputTokens')
              const inp = usageNum(usage, 'inputTokens')
              const cr = usageNum(usage, 'cacheReadTokens')
              const cw = usageNum(usage, 'cacheWriteTokens')
              const chunk = Math.min(ENERGY_CHUNK_CAP, out + 0.2 * (inp + cr + cw))
              st.energy += chunk
              st.turnTokens += chunk
              st.totalOutput += out
              recompute()
              // 里程碑：累计 output 跨档 → 抬升全局高度地板 + 翻滚庆祝
              if (st.tier < MILESTONE_TIERS.length && st.totalOutput >= MILESTONE_TIERS[st.tier]) {
                st.tier += 1
                pulse('milestone', { tier: st.tier, tokens: st.totalOutput })
              }
            }
            break
          }

          case 'turn/end': {
            const t = Math.round(st.turnTokens)
            st.turnTokens = 0
            if (t > 0) pulse('turn', { magnitude: activityOf(t, ENERGY_REF), tokens: t })
            break
          }

          case 'tool/result': {
            const message = data.message && typeof data.message === 'object' ? data.message : {}
            if (message.isError === true) {
              st.failPending += 1
              if (!st.failTimer) st.failTimer = setTimeout(() => flushFailBatch(id, st), FAIL_BATCH_MS)
            } else {
              st.okPending += 1
              if (!st.okTimer) st.okTimer = setTimeout(() => flushToolBatch(id, st), TOOL_BATCH_MS)
              if (st.okPending >= TOOL_BATCH_MAX) flushToolBatch(id, st)
            }
            break
          }

          case 'todo/write': {
            const todos = Array.isArray(data.todos) ? data.todos : []
            const done = todos.filter((item) => item && item.status === 'completed').length
            const now = Date.now()
            if (todos.length >= 2 && done === todos.length && now - st.finaleAt > FINALE_COOLDOWN_MS) {
              st.finaleAt = now
              pulse('finale', {})
            }
            break
          }

          default:
            break
        }
      } catch { /* 风筝逻辑绝不能把宿主带崩 */ }
    }

    ctx.effect(() => {
      const disposeEvent = ctx.on('session/event', onSessionEvent)
      const disposeCreated = ctx.on('session/created', (session) => {
        try {
          // 顶层线程 → 换新风筝；子 agent（带 parentSession）→ agent 脉冲
          // (能量已归并父线程,这里只作"代理新启动"的换新时机信号)
          const header = session && session.header
          if (header && typeof header.parentSession === 'string' && header.parentSession !== '') {
            pulse('agent', { parent: header.parentSession })
            return
          }
          recompute()
          pulse('session', {})
        } catch { /* ignore */ }
      })
      return () => {
        try { disposeEvent() } catch {}
        try { disposeCreated() } catch {}
        for (const st of sessionState.values()) {
          if (st.okTimer) clearTimeout(st.okTimer)
          if (st.failTimer) clearTimeout(st.failTimer)
        }
        sessionState.clear()
      }
    }, 'dsh-kite: session event classification')

    // ── HTTP / SSE 路由 ─────────────────────────────────────────────────
    ctx.effect(() => {
      const disposeRoute = ctx.webServer.register({
        kind: 'prefix',
        path: '/dsh-kite/api',
        handler: async (req, res) => {
          const rejection = ctx.connection.requestRejection(req)
          if (rejection !== undefined) {
            res.writeHead(rejection)
            res.end()
            return
          }
          try {
            const url = new URL(req.url || '/', 'http://dsh.local')
            const apiPath = url.pathname.replace(/\/+$/, '')
            const sendJson = (status, payload) => {
              res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
              res.end(JSON.stringify(payload))
            }

            // GET /dsh-kite/api/stream → SSE 天空状态直播（订阅即推当前帧）
            if (req.method === 'GET' && apiPath.endsWith('/dsh-kite/api/stream')) {
              res.writeHead(200, {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
                'X-Accel-Buffering': 'no',
              })
              res.write('retry: 3000\n\n')
              subscribers.add(res)
              sendFrame(res, Object.assign({ seq: ++seq, type: 'state', at: Date.now() }, skyState))
              const heartbeat = setInterval(() => {
                try { res.write(': ping\n\n') } catch { clearInterval(heartbeat) }
              }, 25000)
              req.on('close', () => {
                clearInterval(heartbeat)
                subscribers.delete(res)
              })
              return
            }

            // GET /dsh-kite/api/updates?since=N → { seq, state, missed[] }
            // 短轮询增量接口：给不想常驻占连接的客户端用（毫秒级返回）
            if (req.method === 'GET' && apiPath.endsWith('/dsh-kite/api/updates')) {
              const since = Number(url.searchParams.get('since')) || 0
              const missed = Number.isFinite(since) ? journal.filter((f) => f.seq > since) : []
              sendJson(200, { seq, state: skyState, missed })
              return
            }

            // GET /dsh-kite/api/config → { config, hasDecal }
            if (req.method === 'GET' && apiPath.endsWith('/dsh-kite/api/config')) {
              sendJson(200, Object.assign({}, config, { hasDecal: !!decal }))
              return
            }

            // POST /dsh-kite/api/config → 保存配置
            if (req.method === 'POST' && apiPath.endsWith('/dsh-kite/api/config')) {
              const body = await readBody(req, MAX_BODY_BYTES)
              let parsed
              try { parsed = JSON.parse(body) } catch { sendJson(400, { error: 'bad json' }); return }
              config = normalizeConfig(parsed)
              // 先等存储域就绪再落盘：启动瞬间的保存不能漏写（dsh-fireworks 同坑）
              try { await domainPromise; if (configTable) await configTable.put(CONFIG_KEY, config) } catch { /* 降级内存 */ }
              sendJson(200, Object.assign({}, config, { hasDecal: !!decal }))
              return
            }

            // GET /dsh-kite/api/decal → 用户贴图
            if (req.method === 'GET' && apiPath.endsWith('/dsh-kite/api/decal')) {
              sendJson(200, decal || { dataUrl: null })
              return
            }

            // PUT /dsh-kite/api/decal { dataUrl } → 上传/替换贴图
            if (req.method === 'PUT' && apiPath.endsWith('/dsh-kite/api/decal')) {
              const body = await readBody(req, MAX_DECAL_BODY_BYTES)
              let parsed
              try { parsed = JSON.parse(body) } catch { sendJson(400, { error: 'bad json' }); return }
              const next = normalizeDecal(parsed)
              if (!next) { sendJson(400, { error: 'invalid image data url (png/jpeg/webp, <=660KB)' }); return }
              decal = next
              try { await domainPromise; if (configTable) await configTable.put(DECAL_KEY, decal) } catch { /* 降级内存 */ }
              sendJson(200, decal)
              return
            }

            // DELETE /dsh-kite/api/decal → 移除贴图
            if (req.method === 'DELETE' && apiPath.endsWith('/dsh-kite/api/decal')) {
              decal = null
              try { await domainPromise; if (configTable) await configTable.put(DECAL_KEY, { dataUrl: null, addedAt: 0 }) } catch { /* 降级内存 */ }
              sendJson(200, { ok: true })
              return
            }

            // POST /dsh-kite/api/test { kind?, magnitude? } → 试一个脉冲
            if (req.method === 'POST' && apiPath.endsWith('/dsh-kite/api/test')) {
              const body = await readBody(req, MAX_BODY_BYTES)
              let parsed = {}
              try { parsed = JSON.parse(body || '{}') } catch { /* 空体允许 */ }
              const KINDS = ['session', 'turn', 'tool', 'fail', 'milestone', 'finale', 'agent']
              const kind = typeof parsed.kind === 'string' && KINDS.includes(parsed.kind) ? parsed.kind : 'turn'
              const magnitude = typeof parsed.magnitude === 'number'
                ? Math.min(1, Math.max(0, parsed.magnitude)) : 0.65
              broadcast({ type: 'pulse', kind, magnitude, test: true, at: Date.now() })
              sendJson(200, { ok: true, kind, magnitude })
              return
            }

            sendJson(404, { error: `no route for ${req.method} ${apiPath}` })
          } catch (e) {
            try {
              res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
              res.end(JSON.stringify({ error: (e && e.message) || 'internal error' }))
            } catch { /* res 可能已部分写出 */ }
          }
        },
      })
      return () => {
        try { if (typeof disposeRoute === 'function') disposeRoute() } catch {}
        for (const res of subscribers) { try { res.end() } catch {} }
        subscribers.clear()
      }
    }, 'dsh-kite: api')
  },
}
