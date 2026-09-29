# @weibaohui/dsh-kite

[![DSH plugin](https://img.shields.io/badge/dsh-plugin-green)](https://github.com/topics/dsh-plugin)
[![npm version](https://img.shields.io/npm/v/@weibaohui/dsh-kite)](https://www.npmjs.com/package/@weibaohui/dsh-kite)

**放风筝引擎**:agent 编程时,屏幕上空放一只动画风筝——token 越多、事件越密飞得越高;工具调用是阵风、失败会俯冲、里程碑空中翻滚、收工双圈庆祝;潍坊谱系框架卡组(硬翅沙燕/软翅金鱼/板式八卦/立体宫灯/串式飞龙……),支持把照片糊上风筝面、贴图随侧正斜姿态实时变换。

## 效果演示

| | | |
|---|---|---|
| ![浅色主题·霞光蝴蝶](https://cdn.jsdelivr.net/gh/weibaohui/dsh-kite@main/docs/shots/butterfly-light.jpg) | ![自定义贴图·正面](https://cdn.jsdelivr.net/gh/weibaohui/dsh-kite@main/docs/shots/decal-front.jpg) | ![贴图·侧身](https://cdn.jsdelivr.net/gh/weibaohui/dsh-kite@main/docs/shots/decal-side.jpg) |
| *浅色主题自动换墨线重烘焙* | *照片正面糊上菱形骨架,竹条压顶* | *侧身时照片压窄、边缘转暗* |
| ![贴图·翻面](https://cdn.jsdelivr.net/gh/weibaohui/dsh-kite@main/docs/shots/decal-back.jpg) | ![满活动度高飞](https://cdn.jsdelivr.net/gh/weibaohui/dsh-kite@main/docs/shots/high-activity.jpg) | ![卡组总览](https://cdn.jsdelivr.net/gh/weibaohui/dsh-kite@main/docs/shots/gallery.jpg) |
| *翻面透出帆布背面与竹条* | *活动度 94% → 高度 76%、线绳绷直* | *卡组帆面图案总览(6 列)* |

## 核心功能

- **活动度 → 高度的规律**:每轮 token 经 log 曲线累入按 τ≈75s 衰减的能量池,映射成 0..1 活动度,直接决定飞行高度(升快落慢);agent 停手约一分钟,风筝缓缓落回低空滑翔
- **事件 → 动作**:回合完成上升冲量、工具成功扑翼抖擞(合批)、失败俯冲、里程碑抬升「高度地板」+空中翻滚(2k/8k/20k/50k/120k/300k 六档)、todo 清完双圈庆祝、新会话换新风筝
- **潍坊谱系卡组,换新不重样**:15 骨架(硬翅:沙燕/龙头;软翅:金鱼/蝴蝶/老鹰/蜻蜓;板子:菱形/八卦/六角/圆月/蝙蝠;立体:宫灯;串式:飞龙;仿生:蝉/热带鱼)× 11 种图案画师(燕面/梅花/祥云/鳞纹/海水纹/羽纹/放射线/牡丹/满天星/横纹/虹谱)× 12 套传统配色 = 26 张策展卡;换风筝走洗牌袋不放回抽取,稀有度 1–5 加权,绝不与上一只重复
- **七彩流转与串式飞龙**:「七彩鲢·虹」的帆面色相随活动度连续流转(`dynamicHue`,越忙转得越急);「飞龙」以 verlet 链物理拖曳串式龙身,里程碑每升一档 +2 节、越长越威风
- **鼠标联动**:风场朝指针方向偏置——风筝追着鼠标漂、抬头低头追随,快划掀起阵风,指针贴近还会抖擞;设置页「鼠标联动」可关
- **事件换新**:不止新会话换风筝——轮次结束、报错、子代理启动、里程碑跨档、收工都可以当场换一只(翻滚揭晓,洗牌袋不重样);设置页「换新时机」逐项勾选,默认全开(普通工具调用除外),10 秒冷却防连换
- **形状 × 图案 × 配色全数据化**:`client/kite-cards.js` 里 FRAMES(轮廓/竹条/图案分区/贴图映射区/尾链挂点)、PATTERNS(在任意闭合分区内作画)、PALETTES、ALL_CARDS 全是纯数据——加一只新风筝只需追加一条数据
- **自定义贴图,姿态跟随**:设置页上传照片(客户端压到 ≤640px,持久化),贴图糊进骨架映射区、与帆面共用同一仿射位姿矩阵——正身是照片,侧身压窄变暗,翻面透出半透明帆布背面与竹条
- **活的物理**:噪声风场漫游、随机摆动、布料沿翼尖扑动、verlet 尾链挂红黄蝴蝶结、线绳低空松垂高空绷直并带微风抖动
- **共享事件通道**:事件经 dsh-event-hub 枢纽单连接(ws 主通道,握手后豁免于 h1.1 的 6 连接预算)推送,与烟花/矩阵/进程共用;枢纽缺席自动降级自有 SSE/轮询,独立安装不受影响
- **透明浮层零侵入**:`position:fixed; pointer-events:none`,不挡任何点击;显示范围可选全屏/左右侧边栏/四角
- **明暗主题跟随**:挂在 dsh 官方主题属性上事件驱动切换,浅色主题用墨线重烘焙帆面、换深色线绳
- **开箱即管**:设置页总开关、风力/体型、高度响应、鼠标联动、换新时机、显示范围、按骨架分组钉住任意一只形象、逐骨架开关(带缩略图)、贴图上传/启停/浓淡、试飞按钮(升空/俯冲/翻滚/换一只)、实时状态
- **性能自律**:常驻动画 30fps 节流、帆面纹理按渲染倍率超采样(低 DPR 屏强制 1.3–1.6× 抗锯齿)、`imageSmoothingQuality: high`、页面隐藏暂停、`prefers-reduced-motion` 自动停放

## 安装

```bash
dsh plugin --profile web add @weibaohui/dsh-kite -w
```

装完重启 `dsh web` 即生效。入口:**设置 → 放风筝**(管理面板 + 试飞按钮)。

## 使用

1. 正常编程即可,风筝自己飞:token 涌入攀升 → 工具调用抖擞 → 跨里程碑翻跟头并抬高地板 → 收工双圈庆祝 → 新会话自动换新
2. 嫌吵:设置页收窄显示范围、调低「高度响应」,或直接收线(总开关)
3. 想让自己(的猫/表情包)上天:设置 → 自定义贴图 → 上传图片 → 勾「使用贴图」
4. 只想放某一只:设置 → 当前风筝 → 钉住(如「沙燕 Swallow」);或关掉谱系里不喜欢的骨架
5. 控制台彩蛋:`__dshKite.next()` 换一只、`__dshKite.pulse('milestone')` 手动来风、`__dshKite.stats()` 看飞行状态
6. 不装插件也能预览引擎:浏览器打开 `demo/demo.html`(`?act=0..1` 锁定活动度、`?frame=shayan` 钉住骨架,右上角可传贴图)

## 事件 → 风筝行为

| 事件 | 行为 |
|---|---|
| `assistant/message`(token 用量) | 累入能量池 → 活动度 → 目标高度 |
| `turn/end` | 上升冲量(规模随本回合 token) |
| `tool/result` 成功 | 扑翼抖擞 + 微风(合批) |
| `tool/result` 失败 | 俯冲 + 乱流(合批,克制) |
| 累计 output 跨档 | 空中翻滚 + 高度地板永久抬升 |
| `todo/write` 全完成 | 双圈翻滚庆祝(5 分钟冷却) |
| `session/created` | 换一只新风筝(洗牌袋不重样) |

## 框架卡组 schema(client/kite-cards.js)

骨架/图案/配色/卡全部是纯数据,引擎只消费 `resolveCard()` 的落定谱与
`paintSail()` 的帆面绘制。新增一只风筝 = 追加一条数据,不改引擎。

```js
// 骨架:单位空间 x∈[-1,1] 向右、y∈[-1,1] 向下(尾巴挂在 +y)
FRAMES.myframe = {
  id: 'myframe', name: '我的', nameEn: 'My Kite',
  family: 'board',                          // hard 硬翅 | soft 软翅 | board 板子 | box 立体
  size: 1,                                  // 相对翼展
  outline: [[0, -1], [0.62, 0], [0, 1], [-0.62, 0]],   // 帆面轮廓
  cells: [{ role: 'body', poly: [...] }],   // 图案分区(role: head/wing/body/tail/panel/core)
  spars: [[0, -1, 0, 1]],                   // 竹条(线段)
  decalQuad: [[-0.62, -1], [0.62, -1], [0.62, 1], [-0.62, 1]], // 贴图映射区
  tail: { attach: [[0, 1]], segs: 12, segLen: 0.11, bows: true, width: 3 },
  flap: { amp: 0.05, k: 2.2 },              // 布料扑动
  bridle: [0, -0.12],                       // 线绳拴点
}

// 图案画师:在任意分区内作画,(u,v)∈[-1,1] 指分区自身包围盒
PATTERNS.mypattern = ({ g, P, hw, hh, rng, pal, ink, role }) => { /* … */ }

// 卡:骨架 × 图案 × 配色(可按 role 组合/覆盖),进洗牌袋
ALL_CARDS.push({
  id: 'myframe-plum', name: '我的·梅', nameEn: 'Plum MyKite',
  frame: 'myframe', pattern: 'plum', palette: PALETTES.cinnabar,
  cellPatterns: { head: 'face' }, rolePalettes: { body: PALETTES.pearl },
  rarity: 2, flavor: '……',
})
```

设置页可按骨架开关(`config.frames`)、钉住某只(`config.preferredFrame`);被关掉的骨架不再进洗牌袋。

## 配置项

| 键 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关(收线落地) |
| `intensity` | `1` | 风力/体型缩放 0.3–2 |
| `responsiveness` | `1` | 活动度→高度响应 0.3–2 |
| `region` | `fullscreen` | fullscreen / left / right / bottom-left / bottom-right |
| `preferredFrame` | `auto` | `auto`(洗牌袋)或骨架 id |
| `frames` | `{}` | 按骨架开关,如 `{ bat: false }` |
| `decalEnabled` | `false` | 把用户贴图糊上帆面 |
| `decalOpacity` | `0.9` | 贴图浓淡 0.3–1 |
| `ignoreReducedMotion` | `false` | 无视系统减弱动态效果偏好 |

## 实现说明

```
宿主(src/index.js)                      客户端(client/)
─────────────────                       ─────────────────
session/event 事件流                     全屏/区域透明 canvas 浮层
  ↓ 能量池(τ≈75s 衰减)/分类               (fixed, pointer-events:none)
dsh-event-hub 枢纽单连接  ──→            PluginKit.connectEvents 订阅
  {activity, tier} + 阵风脉冲             ↓ 活动度→高度 / 脉冲→动作
                                         姿态矩阵(朝向/侧倾/俯仰/翻滚)
                                         ├ 帆面纹理 drawImage(npm 包烘焙)
                                         └ 贴图仿射变换 + verlet 尾链
```

- **宿主**:订阅 `session/event` 做能量累计与事件分类,状态/脉冲经 dsh-event-hub
  枢纽单连接广播( shortage 时回退自有 SSE,`/dsh-kite/api/updates` 增量轮询兜底);
  配置与贴图存 storageDomain(域 `dsh_kite`)持久化
- **姿态与贴图**:贴图与帆面纹理共用同一仿射位姿矩阵(朝向 face/侧倾 roll/俯仰
  pitch/翻滚 spin),帆面图案按骨架分区烘焙进离屏纹理,逐帧仅一次 drawImage;
  贴图经 cover 裁剪进 decalQuad,背面自动镜像减淡
- **构建**:`client/kite-cards.js` + `kite-engine.js` + `index.js` 由
  `scripts/build-client.mjs` 内联进 bundle 工厂作用域(含 dsh-plugin-kit 客户端源码)

## HTTP API(宿主)

| 路由 | 说明 |
|---|---|
| `WS /dsh-event-hub/ws` | 共享事件推送主通道(枢纽;首个消费者注册) |
| `GET /dsh-kite/api/updates?since=` | 增量状态+补帧(轮询回退通道,毫秒级返回) |
| `GET /dsh-kite/api/stream` | 自有 SSE(枢纽缺席时的回退) |
| `GET /dsh-kite/api/config` | 读配置 |
| `POST /dsh-kite/api/config` | 存配置(storageDomain 持久化) |
| `GET /dsh-kite/api/decal` | 读用户贴图(data URL) |
| `PUT /dsh-kite/api/decal` | 上传/替换贴图(≤660KB,png/jpeg/webp) |
| `DELETE /dsh-kite/api/decal` | 移除贴图 |
| `POST /dsh-kite/api/test` | 试飞 `{ kind?, magnitude? }` |

## 开发

```bash
npm run check          # 语法检查
npm test               # 13 项离线测试(卡组完整性/洗牌袋/缩放/宿主契约/存根渲染)
npm run build:client   # kite-cards + kit client + kite-engine + index → client/bundle.js
```

link 安装的实例改完源码 `npm run build:client` 后刷新页面即生效。

## 联系我 :飞书群

![link](https://foruda.gitee.com/images/1774880015525784725/4fd67005_77493.png "link")

## 版本兼容性

本插件与 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(`@deepseek-ai/dsh`)的版本对应关系:

| 插件版本 | 适配 dsh 版本 | 备注 |
|---------|--------------|------|
| 0.1.0 | 0.1.7-rc.2 | 首个公开发布;含共享事件枢纽接入(经 dsh-plugin-kit 0.5.x)、贴图姿态跟随、30fps 节流渲染 |

> **发版约定**:每次发布新版本时,请在上表追加一行,记录该插件版本实际验证所用的 `@deepseek-ai/dsh` 版本。`package.json` 的 `engines.dsh` 声明最低支持版本;本表记录实际验证版本,二者配合使用。

## License

MIT
