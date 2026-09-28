# @weibaohui/dsh-kite

[![DSH plugin](https://img.shields.io/badge/dsh-plugin-green)](https://github.com/topics/dsh-plugin)
[![npm version](https://img.shields.io/npm/v/@weibaohui/dsh-kite)](https://www.npmjs.com/package/@weibaohui/dsh-kite)

**放风筝引擎**：agent 编程时，屏幕上放一只动画风筝——token 越多、事件越密，风筝飞得越高；到处漫游、随机摆动、布料扑动，一根线牵在屏幕底边。风筝出自潍坊谱系（硬翅沙燕 / 软翅金鱼 / 板式八卦 / 立体宫灯 / 龙头蜈蚣……），「形状 × 图案 × 配色」全是可替换的数据卡组；还支持把用户上传的照片糊上风筝面，贴图随风筝的正 / 侧 / 斜姿态实时仿射变换。

## 效果演示

| | | |
|---|---|---|
| ![浅色主题·霞光蝴蝶](https://cdn.jsdelivr.net/gh/weibaohui/dsh-kite@main/docs/shots/butterfly-light.jpg) | ![贴图正面](https://cdn.jsdelivr.net/gh/weibaohui/dsh-kite@main/docs/shots/decal-front.jpg) | ![贴图侧身](https://cdn.jsdelivr.net/gh/weibaohui/dsh-kite@main/docs/shots/decal-side.jpg) |
| *浅色主题自动换墨线烘焙* | *用户照片正面糊上菱形骨架* | *侧身时照片被压窄、边缘转暗* |
| ![贴图翻面](https://cdn.jsdelivr.net/gh/weibaohui/dsh-kite@main/docs/shots/decal-back.jpg) | ![满活动度高飞](https://cdn.jsdelivr.net/gh/weibaohui/dsh-kite@main/docs/shots/high-activity.jpg) | ![卡组总览](https://cdn.jsdelivr.net/gh/weibaohui/dsh-kite@main/docs/shots/gallery.jpg) |
| *翻面透出帆布背面与竹条* | *活动度 94% → 高度 76%、线绳绷直* | *21 张卡组的帆面图案（6 列总览）* |

## 核心功能

- **活动度 → 高度的规律**：宿主把每轮 `outputTokens + 0.2×(input+cache)` 累入按 τ≈75s 指数衰减的能量池，经 log₂ 曲线映射成活动度（0..1）；活动度直接决定飞行高度（升快落慢，风筝不倒栽）。agent 停手约一分钟，风筝就缓缓落回低空滑翔
- **事件 → 阵风脉冲**：回合完成上升冲量、工具成功扑翼抖擞（1.4s 合批）、失败俯冲（克制）、里程碑抬升「高度地板」+空中翻滚（2k/8k/20k/50k/120k/300k 六档）、todo 全完成双圈庆祝、新会话换一只新风筝
- **潍坊谱系卡组，形态绝不重复**：12 只骨架（硬翅：沙燕/龙头；软翅：金鱼/蝴蝶/老鹰/蜻蜓；板子：菱形/八卦/六角/圆月/蝙蝠；立体：宫灯）× 10 种传统图案画师（燕面/梅花/祥云/鳞纹/海水纹/羽纹/放射线/牡丹/满天星/横纹）× 12 套传统配色（朱红/靛青/翠绿/明黄/石青/桃红/月白……）＝ 21 张策展卡；换风筝走洗牌袋不放回抽取，稀有度 1–5 加权，**绝不与上一只重复**
- **形状 × 图案 × 配色全数据化**：`client/kite-cards.js` 里 FRAMES（轮廓/竹条/图案分区/贴图映射区/尾链挂点）、PATTERNS（在任意闭合分区内作画的过程画师）、PALETTES、ALL_CARDS（骨架 + 图案 + `cellPatterns` 按 role 组合 + `rolePalettes` 按分区配色）都是纯数据——加一只新风筝 = 追加一条数据，不改引擎
- **自定义贴图，姿态跟随**：设置页上传照片（客户端压到 ≤640px，png 保透明），宿主存 storageDomain、重启仍在；贴图被糊进骨架的 `decalQuad` 区，与帆面共用同一仿射位姿矩阵——**正身是照片，侧身压窄变暗，翻面透出半透明帆布背面与竹条**；帆面纹理（图案+竹条+描边）离屏烘焙，逐帧只 drawImage
- **活的物理**：噪声风场漫游、随机摆动、布料沿翼尖扑动、verlet 尾链 + 红黄蝴蝶结、线绳垂度随高度变化（低空松垂、高空绷直）并带微风抖动
- **透明浮层零侵入**：`position:fixed; pointer-events:none`，不挡任何点击；显示范围可选全屏（默认）/ 左右侧边栏 / 四角
- **明暗主题跟随**：挂在 dsh 官方主题属性上事件驱动切换，浅色主题用墨线重烘焙帆面、换深色线绳
- **性能自律**：单风筝 + 纹理缓存，逐帧一次 drawImage；帆面纹理按渲染倍率超采样烘焙（低 DPR 屏强制 1.3–1.6× 抗锯齿，画布面积封顶 12M 像素），`imageSmoothingQuality: high` 缩放采样，翻滚角按 TAU 连续缓动收尾无跳变；页面隐藏暂停；`prefers-reduced-motion` 自动停放（可强制忽略）；宿主侧脉冲令牌桶限流（20 发/5s）防子 agent 风暴
- **开箱即管**：设置页总开关、风力/体型、高度响应、显示范围、钉住某只骨架、逐骨架开关（带缩略图）、贴图上传/启停/浓淡、试飞按钮（升空/俯冲/翻滚/换一只/全套动作）、实时状态

## 安装

```bash
dsh plugin --profile web add @weibaohui/dsh-kite -w
```

装完重启 `dsh web` 即生效。入口：**设置 → 放风筝**（管理面板 + 试飞按钮）。

## 使用

1. 正常编程即可：token 涌入风筝攀升，工具调用带来阵风，跨里程碑它翻个跟头并把高度地板抬一档，收工双圈庆祝，新会话自动换一只没放过的新风筝
2. 嫌吵：把显示范围收成角落、调低「高度响应」，或直接收线（总开关）
3. 想让自己（的猫/自家娃/表情包）上天：设置 → 自定义贴图 → 上传图片 → 勾「使用贴图」
4. 只想放某一只：设置 → 当前风筝 → 钉住（如 `沙燕 Swallow`）；或关掉谱系里不喜欢的骨架
5. 控制台彩蛋：`__dshKite.next()` 换一只、`__dshKite.pulse('milestone')` 手动来风、`__dshKite.stats()` 看飞行状态
6. 不装插件也能预览引擎：浏览器打开 `demo/demo.html`（`?act=0..1` 锁定活动度、`?frame=shayan` 钉住骨架、右上按钮上传贴图）

## 事件 → 风筝行为

| 事件 | 行为 |
|---|---|
| `assistant/message`（token 用量） | 累入能量池 → 活动度 → 目标高度 |
| `turn/end` | 上升冲量（规模随本回合 token） |
| `tool/result` 成功 | 扑翼抖擞 + 微风（合批） |
| `tool/result` 失败 | 俯冲 + 乱流（合批，克制） |
| 累计 output 跨档 | 空中翻滚 + 高度地板永久抬升 |
| `todo/write` 全完成 | 双圈翻滚庆祝（5 分钟冷却） |
| `session/created` | 换一只新风筝（洗牌袋不重样） |

## 卡组 schema（client/kite-cards.js）

```js
// 骨架：单位空间 x∈[-1,1] 向右、y∈[-1,1] 向下（尾巴挂在 +y）
FRAMES.myframe = {
  id: 'myframe', name: '我的', nameEn: 'My Kite', family: 'board', // hard|soft|board|box
  size: 1,                                   // 相对翼展
  outline: [[0,-1],[0.62,0],[0,1],[-0.62,0]],// 帆面轮廓（闭合成多边形）
  cells: [{ role: 'body', poly: [...] }],    // 图案分区，role ∈ head|wing|body|tail|panel|core
  spars: [[0,-1,0,1], [-0.62,0,0.62,0]],     // 竹条（线段）
  decalQuad: [[-0.62,-1],[0.62,-1],[0.62,1],[-0.62,1]], // 用户贴图映射区 TL,TR,BR,BL
  tail: { attach: [[0,1]], segs: 12, segLen: 0.11, bows: true, width: 3 },
  flap: { amp: 0.05, k: 2.2 },               // 布料扑动幅度/空间频率
  bridle: [0, -0.12],                        // 线绳拴点
}
// 图案画师：在任意分区内作画，(u,v)∈[-1,1] 指分区自身包围盒
PATTERNS.mypattern = ({ g, P, hw, hh, rng, pal, ink, role }) => { /* g.fillRect/arc… */ }
// 卡：骨架 × 图案 × 配色（+ 按 role 组合/覆盖），进洗牌袋
ALL_CARDS.push({
  id: 'myframe-plum', name: '我的·梅', nameEn: 'Plum MyKite',
  frame: 'myframe', pattern: 'plum', palette: PALETTES.cinnabar,
  cellPatterns: { head: 'face' }, rolePalettes: { body: PALETTES.pearl },
  rarity: 2, flavor: '……',
})
```

设置页可按骨架开关（`config.frames`）、钉住某只（`config.preferredFrame`）；被关掉的骨架不再进洗牌袋。

## 配置项

| 键 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关（收线落地） |
| `intensity` | `1` | 风力/体型缩放 0.3–2 |
| `responsiveness` | `1` | 活动度→高度响应 0.3–2 |
| `region` | `fullscreen` | fullscreen / left / right / bottom-left / bottom-right |
| `preferredFrame` | `auto` | `auto`（洗牌袋）或骨架 id |
| `frames` | `{}` | 按骨架开关，如 `{ bat: false }` |
| `decalEnabled` | `false` | 把用户贴图糊上帆面 |
| `decalOpacity` | `0.9` | 贴图浓淡 0.3–1 |
| `ignoreReducedMotion` | `false` | 无视系统减弱动态效果偏好 |

## 开发

```bash
npm run check          # 语法检查
npm test               # 离线测试（卡组完整性/洗牌袋/宿主契约/存根渲染）
npm run build:client   # 改了 client/*.js 后必须重新内联 bundle
```

零 npm 运行时依赖；路由全部挂 `connection.requestRejection` 信任栅栏；配置与贴图存 storageDomain（`valueSchema` 透传 + `invalidRecords: 'backup-and-skip'`）。

## License

MIT
