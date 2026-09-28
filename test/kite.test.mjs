/**
 * dsh-kite 离线测试：框架/卡组完整性、图案画师可用性、洗牌袋不重样、
 * resolveCard 落定、宿主 activityOf/normalizeConfig/normalizeDecal、
 * 宿主与客户端的 magnitude 映射一致性、paintSail 存根冒烟。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Cards = require('../client/kite-cards.js')
const EngineMod = require('../client/kite-engine.js')
const Host = require('../src/index.js')

const FAMILIES = ['hard', 'soft', 'board', 'box']
const ROLES = ['head', 'wing', 'body', 'tail', 'panel', 'core']

// ── 框架库 ───────────────────────────────────────────────────────────────

test('框架库：≥10 只骨架、id 唯一、四大谱系全覆盖', () => {
  const ids = Object.keys(Cards.FRAMES)
  assert.ok(ids.length >= 10, `want >=10 frames, got ${ids.length}`)
  for (const f of Object.values(Cards.FRAMES)) {
    assert.ok(FAMILIES.includes(f.family), `${f.id} bad family`)
    assert.ok(Cards.FAMILY_ZH[f.family], `${f.id} missing FAMILY_ZH`)
  }
  const families = new Set(Object.values(Cards.FRAMES).map((f) => f.family))
  for (const fam of FAMILIES) {
    assert.ok(families.has(fam), `family ${fam} uncovered`)
  }
})

test('框架几何：轮廓/分区/竹条/贴图区/尾挂点齐全且在单位空间内', () => {
  for (const f of Object.values(Cards.FRAMES)) {
    assert.ok(f.outline.length >= 3, `${f.id} outline too short`)
    assert.ok(f.cells.length >= 1, `${f.id} needs >=1 cell`)
    assert.ok(f.spars.length >= 1, `${f.id} needs >=1 spar`)
    assert.equal(f.decalQuad.length, 4, `${f.id} decalQuad must be 4 corners`)
    assert.ok(Array.isArray(f.bridle) && f.bridle.length === 2, `${f.id} bridle`)
    assert.ok(f.flap && typeof f.flap.amp === 'number', `${f.id} flap`)
    for (const pt of [...f.outline, ...f.spars.flat().reduce((acc, v, i) => {
      // spars 是 [x1,y1,x2,y2] 平铺，折成点对
      if (i % 2 === 0) acc.push([v, f.spars.flat()[i + 1]])
      return acc
    }, [])]) {
      assert.ok(Math.abs(pt[0]) <= 1.05 && Math.abs(pt[1]) <= 1.05,
        `${f.id} point ${JSON.stringify(pt)} out of unit space`)
    }
    for (const cell of f.cells) {
      assert.ok(ROLES.includes(cell.role), `${f.id} bad cell role ${cell.role}`)
      assert.ok(cell.poly.length >= 3, `${f.id} cell ${cell.role} too short`)
    }
    if (f.tail) {
      assert.ok(f.tail.attach.length >= 1, `${f.id} tail attach`)
      assert.ok(f.tail.segs >= 4 && f.tail.segLen > 0, `${f.id} tail params`)
    }
  }
})

test('图案画师：全库存在，全部帧×分区可用存根上下文无异常作画', () => {
  const patternIds = ['plum', 'cloud', 'scale', 'stripe', 'ray', 'peony', 'feather', 'face', 'dotstar', 'wave']
  for (const id of patternIds) {
    assert.equal(typeof Cards.PATTERNS[id], 'function', `pattern ${id} missing`)
  }
  /** 记账存根：任何方法调用都记录，属性赋值忽略。 */
  const makeStub = () => {
    const ops = []
    const stub = new Proxy({}, {
      get(_t, prop) {
        if (prop === '__ops') return ops
        return (...args) => { ops.push(String(prop)) }
      },
      set() { return true },
    })
    return stub
  }
  const rng = Cards.mulberry32(3)
  let painted = 0
  for (const f of Object.values(Cards.FRAMES)) {
    for (const cell of f.cells) {
      const g = makeStub()
      const bb = Cards.polyBBox(cell.poly)
      Cards.PATTERNS.stripe // 触碰确保非 undefined
      const painter = Cards.PATTERNS_BY_ID.stripe
      painter({
        g, P: (u, v) => [u * bb.x1, v * bb.y1],
        hw: 40, hh: 40, rng,
        pal: Cards.PALETTES.cinnabar, ink: [30, 40, 18], role: cell.role,
      })
      assert.ok(g.__ops.length > 0, `${f.id}/${cell.role} painter drew nothing`)
      painted += 1
    }
  }
  assert.ok(painted >= 30, `want >=30 frame×cell paints, got ${painted}`)
})

// ── 卡组 ─────────────────────────────────────────────────────────────────

test('卡组：≥20 张、id 唯一、引用的骨架/图案/配色全部存在', () => {
  assert.ok(Cards.ALL_CARDS.length >= 20, `want >=20 cards, got ${Cards.ALL_CARDS.length}`)
  const ids = new Set()
  for (const c of Cards.ALL_CARDS) {
    assert.ok(!ids.has(c.id), `duplicate card id ${c.id}`)
    ids.add(c.id)
    assert.ok(Cards.FRAMES_BY_ID[c.frame], `${c.id} unknown frame ${c.frame}`)
    assert.ok(Cards.PATTERNS_BY_ID[c.pattern], `${c.id} unknown pattern ${c.pattern}`)
    assert.ok(Array.isArray(c.palette) && c.palette.length >= 1, `${c.id} palette`)
    for (const pal of Object.values(c.rolePalettes || {})) {
      assert.ok(Array.isArray(pal) && pal.length >= 1, `${c.id} rolePalette`)
    }
    for (const [role, pid] of Object.entries(c.cellPatterns || {})) {
      assert.ok(ROLES.includes(role), `${c.id} bad cellPattern role`)
      assert.ok(Cards.PATTERNS_BY_ID[pid], `${c.id} unknown cellPattern ${pid}`)
    }
    assert.ok(c.rarity >= 1 && c.rarity <= 5, `${c.id} rarity`)
    assert.ok(c.name && c.nameEn && c.flavor, `${c.id} missing names/flavor`)
  }
  // 每只骨架至少一张卡；「形态不能重复/单一」：总卡数 ≥ 骨架数 × 1.5
  for (const fid of Object.keys(Cards.FRAMES)) {
    assert.ok((Cards.CARDS_BY_FRAME[fid] || []).length >= 1, `frame ${fid} has no card`)
  }
  assert.ok(Cards.ALL_CARDS.length >= Object.keys(Cards.FRAMES).length * 1.5, 'too few combos')
})

test('paintSail：存根上下文冒烟，必然 fill+stroke+clip', () => {
  const ops = []
  const g = new Proxy({}, {
    get(_t, prop) {
      if (prop === '__ops') return ops
      return (...a) => { ops.push(String(prop)) }
    },
    set() { return true },
  })
  for (const c of Cards.ALL_CARDS) {
    ops.length = 0
    Cards.paintSail({ g, w: 200, h: 200, card: c, tone: 'dark', rng: Cards.mulberry32(5) })
    assert.ok(ops.includes('clip'), `${c.id} never clips cells`)
    assert.ok(ops.includes('fill'), `${c.id} never fills`)
    assert.ok(ops.includes('stroke'), `${c.id} never strokes`)
  }
})

// ── 抽取与落定 ───────────────────────────────────────────────────────────

test('洗牌袋：连抽 8 只互不重复，跨袋边界也不与上一只重复', () => {
  const rng = Cards.mulberry32(42)
  const bag = {}
  const picks = Cards.pickVariants(null, 8, rng, bag)
  assert.equal(picks.length, 8)
  assert.equal(new Set(picks.map((c) => c.id)).size, 8, 'batch must be distinct')
  // 超池抽取：长度保证 + 跨袋边界不与上一张重复（池内不放回，池外允许轮回）
  const pool = Cards.ALL_CARDS.length
  const more = Cards.pickVariants(null, pool + 2, rng, bag)
  assert.equal(more.length, pool + 2)
  assert.notEqual(picks[7].id, more[0].id, 'no repeat across bag refill boundary')
  for (let i = 0; i < pool; i++) {
    assert.notEqual(more[i].id, more[i + 1].id, `repeat at ${i} within first pool pass`)
  }
})

test('洗牌袋：同 seed 序列可复现；启用过滤生效', () => {
  const a = Cards.pickVariants(null, 3, Cards.mulberry32(9), {})
  const b = Cards.pickVariants(null, 3, Cards.mulberry32(9), {})
  assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id))
  const onlyDiamond = Cards.pickVariants(null, 3, Cards.mulberry32(9), {}, (c) => c.frame === 'diamond')
  assert.equal(onlyDiamond.length, Math.min(3, Cards.CARDS_BY_FRAME.diamond.length))
  for (const c of onlyDiamond) assert.equal(c.frame, 'diamond')
})

test('稀有度加权：传说卡长期频率低于常见卡', () => {
  const rng = Cards.mulberry32(2026)
  const bag = {}
  const counts = {}
  for (let i = 0; i < 500; i++) {
    for (const c of Cards.pickVariants(null, 1, rng, bag)) counts[c.id] = (counts[c.id] || 0) + 1
  }
  const legendary = Cards.ALL_CARDS.find((c) => c.rarity === 5)
  const common = Cards.ALL_CARDS.find((c) => c.rarity === 1)
  assert.ok(legendary && common)
  assert.ok((counts[legendary.id] || 0) < counts[common.id],
    `legendary ${counts[legendary.id] || 0} should be < common ${counts[common.id]}`)
})

test('resolveCard：确定性落定，尾链/扑翼参数在合理区间', () => {
  const card = Cards.ALL_CARDS[0]
  const s1 = Cards.resolveCard(card, 0.6, Cards.mulberry32(77))
  const s2 = Cards.resolveCard(card, 0.6, Cards.mulberry32(77))
  assert.deepEqual(s1, s2, 'same seed must resolve identically')
  assert.equal(s1.frame, Cards.FRAMES_BY_ID[card.frame])
  assert.ok(s1.size > 0.5 && s1.size < 2, 'size out of range')
  assert.ok(s1.flapAmp > 0 && s1.flapAmp < 0.3, 'flapAmp out of range')
  if (s1.tail) {
    assert.ok(s1.tail.segs >= 4, 'tail too short')
    assert.ok(Array.isArray(s1.tail.attach) && s1.tail.attach.length >= 1)
  }
  const lo = Cards.resolveCard(card, 0, Cards.mulberry32(1))
  const hi = Cards.resolveCard(card, 1, Cards.mulberry32(1))
  assert.ok(hi.size >= lo.size, 'size must grow with activity')
})

// ── 宿主 ↔ 客户端 契约 ──────────────────────────────────────────────────

test('magnitudeOf（客户端）与 activityOf（宿主）同式同值', () => {
  for (const t of [0, 1, 500, 5000, 20000, 100000]) {
    assert.equal(Cards.magnitudeOf(t, 20000), Host.__internals.activityOf(t, 20000))
  }
  assert.equal(Host.__internals.activityOf(20000, 20000), 1)
  assert.ok(Host.__internals.activityOf(2000, 20000) > 0.4)
})

test('宿主 normalizeConfig：默认值、钳制、frames 门控、坏字段回退', () => {
  const n = Host.__internals.normalizeConfig
  const d = n(undefined)
  assert.equal(d.enabled, true)
  assert.equal(d.region, 'fullscreen')
  assert.equal(d.preferredFrame, 'auto')
  assert.deepEqual(d.frames, {})
  const bad = n({ intensity: 99, region: 'nowhere', responsiveness: -3, preferredFrame: 'bad id!', frames: { shayan: 'yes', diamond: false, [ 'x'.repeat(60) ]: true }, decalOpacity: 9 })
  assert.equal(bad.intensity, 2)
  assert.equal(bad.region, 'fullscreen')
  assert.equal(bad.responsiveness, 0.3)
  assert.equal(bad.preferredFrame, 'auto')
  assert.equal(bad.frames.shayan, undefined) // 非布尔丢弃
  assert.equal(bad.frames.diamond, false)
  assert.equal(bad.frames['x'.repeat(60)], undefined)
  assert.equal(bad.decalOpacity, 1)
  const ok = n({ preferredFrame: 'shayan', frames: { diamond: false, bat: true } })
  assert.equal(ok.preferredFrame, 'shayan')
  assert.deepEqual(ok.frames, { diamond: false, bat: true })
})

test('宿主 normalizeDecal：data URL 形状与大小校验', () => {
  const n = Host.__internals.normalizeDecal
  assert.equal(n(null), null)
  assert.equal(n({}), null)
  assert.equal(n({ dataUrl: 'http://evil.example/x.png' }), null)
  assert.equal(n({ dataUrl: 'data:text/html;base64,AAAA' }), null)
  const tiny = 'data:image/png;base64,' + 'A'.repeat(100)
  const ok = n({ dataUrl: tiny })
  assert.ok(ok && ok.dataUrl === tiny)
  assert.equal(typeof ok.addedAt, 'number')
  const huge = 'data:image/jpeg;base64,' + 'A'.repeat(900001)
  assert.equal(n({ dataUrl: huge }), null)
})

test('引擎模块：node 侧可加载，smoothNoise 确定性', () => {
  assert.equal(typeof EngineMod.createKiteEngine, 'function')
  const a = EngineMod.smoothNoise(12.3, 4)
  const b = EngineMod.smoothNoise(12.3, 4)
  assert.equal(a, b)
  assert.ok(Math.abs(a) <= 1.01)
})
