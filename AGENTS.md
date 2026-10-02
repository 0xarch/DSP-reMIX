# AGENTS.md

面向编码代理的项目速览。这是一个《戴森球计划》题材的 2D 无限画布挂机工厂游戏（React 19 + TypeScript + Vite），默认不启用云服务。前端为唯一的功能主体；`server/`（云服务）与 `deploy/`（发布运维）默认不在修改范围内。

## 技术栈与命令

- 构建：`npm run build`（tsc -b + vite build + 启动预算与原生边界校验）
- 类型检查：`npm run typecheck`（`tsc -b`）
- 单元测试：`npm run test:unit:fast`（vitest），全量 `npm test`
- 本地开发：`npm run dev`（127.0.0.1:4318）
- E2E：`npm run test:e2e`（Playwright）

## 架构概览

**启动链路**：`index.html` → `src/main.tsx` → 按路由惰性加载 `AdminDashboard` / `PublicStationPage` / `GameLauncher`。`GameLauncher` 持有"开始菜单 ↔ 游戏"切换：未进入游戏时渲染 `components/StartMenu.tsx`，进入后渲染 `FactoryRuntime.tsx` → `App.tsx` 的 `FactoryGame`。

**主入口 `src/App.tsx`**：游戏进行时的根组件（约 2.4 万行），负责画布交互（React Flow）、放置/拉线/框选、与模拟 worker 的通信、存档与 durable recovery、原生桥接等。其中可独立测试的纯逻辑已拆到 `src/game/sync/` 等模块；组件内部的回调大多闭包引用组件状态，改动时优先把新逻辑写成 `src/game/` 下的纯函数。

**模拟核心**：游戏规则与状态机在 `src/game/engine.ts`（确定性生产/电力/物流/科研/离线结算），通过 Web Worker（`simulation.worker.ts` 等）运行；"原生核心"（`nativeCore.ts`，Rust，`native/`）是 Windows/Android 的高性能权威实现，前端通过投影（projection）订阅其状态，桌面壳桥接代码在 `desktop/` 与 `src/desktop.ts`。

**难度与星系生成**：难度 preset 在 `game/difficulty.ts`；存档级精准倍率（矿物/发电，范围 (0.01,100] 加 `"Infinity"` 哨兵）也在该文件编码，Infinity 在功率路径折算为 1e15 有限值，在矿脉路径用实体 `resourceInfinite` 标记（Rust 侧 `simple_factory.rs`/`manual_mining.rs`/`pure_idle.rs` 同步识别）。新建存档的种子与星系生成选项（星系个数 8~32、距离系数 0.5~10）由 `game/galaxy.ts` 的 `normalizeGalaxyGenerationOptions` 驱动，距离系数乘算至恒星系初始坐标。

**程序化星系**：星系个数超过 8 时，第 9~N 个恒星系由 `content/dsp/starSystems.ts` 的三张表确定性生成——`STAR_SYSTEM_NAME_TABLE`（32 个 ID/名称，保证唯一）、`STAR_SYSTEM_TYPES`（8 类恒星：T/G/W/O 四维 0~1 + 行星环上限 + 大行星上限 + 距离范围 + 勘探成本）、`PLANET_TYPES`（22 类星球：是否大型/子环数/资源概率/依附星系四维区间）。算法在 `galaxy.ts` 的 `generateExtendedGalaxy`：ID 表去重取名 → 随机星系类型（可重复）→ 环数 ∈ [max-2, max] → 大行星 ∈ [max-2, max] 且 ≤ 环数-2 → 每个空环（含大行星子环）删去本星系已有类型后按契合度（四维落在依附区间的维数）排序取前三随机；行星 ID = `${星系ID}-${星球类型}`。全部随机来自存档种子的 `seededUnit`，生成结果随 galaxy 持久化并在加载时重建。生成的星系/行星经 `content.ts` 的 `syncDynamicGalaxyCatalog` 注册进 PLANETS/PLANET_LIST/STAR_SYSTEMS/STAR_SYSTEM_LIST（切换存档时先清旧动态条目），注册点：createGalaxyState、normalizeGalaxyState、storage.loadInspection、simulation.worker 的三处状态落地、FactoryGame 挂载。前 8 系保持静态目录（campaign/科技链兼容），生成星系勘探前置链依次衔接 blue_giant 之后。`PlanetId`/`StarSystemId` 字面量联合已用 `(string & {})` 拓宽以接纳动态 ID。

**存档管理**：难度 preset 在 `game/difficulty.ts`；存档级精准倍率（矿物/发电，范围 (0.01,100] 加 `"Infinity"` 哨兵）也在该文件编码，Infinity 在功率路径折算为 1e15 有限值，在矿脉路径用实体 `resourceInfinite` 标记（Rust 侧 `simple_factory.rs`/`manual_mining.rs`/`pure_idle.rs` 同步识别）。

**存档管理**：本地存档 envelope（storage.ts 的 SaveEnvelope）头字段支持可选 `name`（≤64 字符，不计入校验和），catalog 与菜单摘要透传该名称；`renameLocalSaveVerified` 只重写 envelope 头实现重命名（state 与校验和不变），`clearPrimarySaveVerified` 删除主存档及其备份/旧版键。开始菜单「加载存档」界面支持槽位/主档/快照的删除（两步确认复用 SaveDeleteDialog）与重命名，行标题显示存档名称（未命名回退默认标签），模式以 Chip 呈现，宽屏（≥980px）双列布局。

**存档**：`src/game/storage.ts`（envelope v2 编解码、槽位、快照）、`localSaveStore.ts` + `localSaveCatalog.ts`（本地持久存档索引）、`save-field-contract.json` 定义存档字段契约并有对应测试守护；旧存档字段（如已移除主题系统的 `settings.theme`）保留透传以兼容旧档。

**开始菜单与顶栏（2026-09 精简版）**：开始菜单不含背景装饰（start-menu-scene）、免责声明、QQ 群、底部状态条和客户端下载入口；「登录与云存档」在云节点不可用（非 HTTPS 或离线）时禁用。游戏顶栏无品牌组件（显示名只在开始菜单与文档标题出现）；画布自适应细节卡片仅在「画布细节=自动」时渲染于右下角（建造坞上方、检查器左侧），显示时概览图（+84px）与收起按钮（展开 250px/收起 96px）整体上移让位（CSS `:has(.canvas-density-status)` 联动），手动细节模式下卡片隐藏、概览图回位。

**样式令牌**：全部设计数值统一在 `styles.css` 的 `:root`「设计令牌」区管理——圆角（`--radius-xs`~`--radius-pill`）、字重（`--weight-*`）、模糊半径（`--panel-blur-radius`）、扩展色（`--tone-*`，即 `src/styles/` 与 `admin.css` 中重复出现的颜色）；`src/styles/`、`admin.css` 一律引用变量不写裸值，新增数值先入令牌区。`theme.css` 仅承载文档级规则（语言相关排版微调）。单次使用的一次性颜色与 rgba 派生色可保留字面量。

**布局与主题**：游戏进行时主网格（`.factory-canvas`）在桌面布局（≥1101px，非手机壳）下 `position: fixed` 全屏铺满视口；四周界面（`.game-header` 顶栏、`.resource-rail` 左物资栏、`.inspector-panel` 右检查器、`.construction-dock` 建造坞）保持原位悬浮其上，背景为半透明 + `backdrop-filter` 模糊，**模糊半径统一由 `src/styles.css` 设计令牌区的 `--panel-blur-radius` 控制**。画布内悬浮控件（缩放柄、小地图、选择工具条等）用 `calc()` 基于 `--shell-header-height` / `--shell-dock-height` / `--resource-rail-width` / `--inspector-panel-width` 让开四周界面。主题只有暗色一种：暗色调色板与全部设计令牌在 `src/styles.css` 的 `:root`，`theme.css` 仅承载文档级规则，不存在亮色分支。

**手机端**：两套界面——经典版（`OperationsWorkspace.tsx` + `styles.css` 响应式）与新版壳（`data-mobile-shell="true"`，`styles/mobile-*.css`，底部抽屉）。紧凑断点见 `hooks/useCompactLayout.ts`（<600 竖屏 / <900 medium / ≥1101 桌面）。

**控制台调试入口**：游戏界面挂载后（由 App 的 FactoryGame 注册，离开时卸载），在 DevTools 控制台执行 `__DSP_DUMP_SAVE__()` 可输出当前存档的全部信息：折叠分组里包含摘要（版本/模式/种子/星系生成选项/设置/实体与传送带计数/无限矿脉数/科研/勘探/成就，`console.table` 展示实体分类计数）与完整 `GameState` 对象（可右键 Store as global variable 继续检查），返回值为 `{ summary, state }`。实现见 `src/game/saveDebugConsole.ts`。

**画布缩放**：浏览器原生 Ctrl+滚轮缩放在 `App.tsx` 被 `passive:false` 的 wheel 监听劫持——事件落在 `.factory-canvas` 内时以光标为锚点缩放 2D 网格（范围 `canvasMinimumZoom`~1.8），落在四周界面/工作区浮层/开始菜单时不拦截、交还浏览器原生缩放。

**内容目录与物品图标**：物品/建筑/配方/科技/星系等原始目录数据在 `src/content/dsp/`（items、buildings、recipes、technologies、planets、starSystems、proliferators、construction、fuels），`game/content.ts` 负责聚合、派生索引与校验，并 re-export 保持既有导入路径兼容——这是为未来扩展包预留的结构。物品图标支持两种方式：(1) 文本 `symbol`（既有行为）；(2) 图片——按约定放在 `assets/item-icons/<itemId>.png` 由 `content/dsp/itemIcons.ts` 的 import.meta.glob 自动收集，非约定文件名（如测试图标 `assets/Ore.Fe.png` → iron_ore）在 `ITEM_ICON_ALIASES` 登记，`ItemDefinition.icon` 可显式覆盖；`ItemGlyph` 有图标时渲染图片、否则回退 symbol。

**项目显示名**：唯一来源是 `package.json` 的 `displayName`（中文名）与 `displayNameEn`（英文名），由 vite 构建期读取文件注入为全局常量 `__APP_DISPLAY_NAME__` / `__APP_DISPLAY_NAME_EN__`（声明在 `src/vite-env.d.ts`；从文件读取而非 npm_package_* 环境变量，npx vite 直启同样生效，`APP_DISPLAY_NAME*` 环境变量可覆盖）。注入点：`index.html` 的 `<title>`（transformIndexHtml 重写）、PWA manifest 的 name/short_name（dev 用 configureServer 中间件、build 用 closeBundle 写盘重写）、`i18n/locale.tsx` 的文档标题。界面品牌文案一律引用常量，不要硬编码；`i18n/legacyTranslations.ts` 中旧品牌名的英文翻译键仅在运行时值恰好等于键名时由 DOM 翻译桥命中。桌面壳（desktop/）的 productName 属壳侧打包配置，`src/desktop.ts` 只以 string 透传。

**i18n**：`src/i18n/`，`locale.tsx` 提供 Provider，中文为源语言，英文经 `messages.ts` / `legacyTranslations.ts` 映射；`html[data-locale]` 驱动个别 CSS 规则。

**测试约定**：`src/game/` 与 `src/components/` 下普遍采用"源文件同名 `.test.ts(x)` 就近放置"的约定；涉及存档字段的改动必须同步 `save-field-contract.json` 与相关契约测试。

## 代码结构树（src/ 为核心，仅列关键部分）

```
DSPONLINE/
├── index.html                  # 入口 HTML（暗色 color-scheme meta）
├── src/
│   ├── main.tsx                # 启动：路由分发、PWA、原生运行时挂载
│   ├── App.tsx                 # FactoryGame 主入口（画布交互、worker 调度、存档流程）
│   ├── FactoryRuntime.tsx      # FactoryGame 的运行时包装
│   ├── GameLauncher.tsx        # 开始菜单 ↔ 游戏切换
│   ├── theme.css               # 全局设计令牌（--panel-blur-radius 等）+ 文档级规则
│   ├── styles.css              # 主样式表（暗色调色板 :root、布局、四周界面、悬浮控件）
│   ├── styles/                 # 按功能拆分的样式（手机壳、移动端、弹窗、教程等）
│   ├── game/                   # 游戏逻辑核心（纯函数 + worker，均配同名测试）
│   │   ├── engine.ts           # 确定性模拟引擎
│   │   ├── types.ts            # GameState 等核心类型
│   │   ├── storage.ts          # 存档编解码、槽位、快照
│   │   ├── localSaveStore.ts / localSaveCatalog.ts   # 本地持久存档
│   │   ├── simulation.worker.ts / simulationRuntime*  # 模拟 worker 与 durable recovery
│   │   ├── nativeCore.ts       # 原生权威核心（Rust 桥）类型与协议
│   │   ├── uiPreferences.ts    # 设备级 UI 偏好（localStorage）
│   │   ├── sync/               # 自 App.tsx 拆出的同步与存档工具
│   │   │   ├── simulationCheckpointSync.ts   # 分块检查点拼装、权威检查点→UI 同步
│   │   │   └── runtimeSaveUtilities.ts       # 持久化进度类型、封盘结果、主存档字节数
│   │   └── …                   # 内容目录、配方、蓝图、离线结算、统计等
│   ├── components/             # React 组件（StartMenu、各工作区、面板、对话框）
│   ├── hooks/                  # 通用 hooks（画布手势、紧凑布局、性能监测等）
│   ├── i18n/                   # 语言包与 locale Provider
│   ├── pwa.ts / nativeApp.ts / desktop.ts  # PWA、Android(Capacitor)、桌面桥接
│   └── admin.css               # 管理后台样式
├── server/                     # 云服务 API（默认不启用，不在前端修改范围）
├── desktop/                    # Electron 桌面壳（主进程、IPC、打包测试）
├── android/ native/            # Capacitor 工程与 Rust 原生核心
├── scripts/                    # 构建/发布/校验脚本（启动预算、边界校验等）
├── tests/                      # Playwright E2E
├── save-field-contract.json    # 存档字段契约（有契约测试守护）
└── docs/                       # 项目状态、发布记录等文档
```

## 注意事项

- 默认不启用云服务：涉及云账号/云存档/排行榜的功能路径要保持"未绑定/不可用"的默认行为，不要为云功能添加新的启动期依赖。
- 不要向远程推送；所有修改仅保存在本地工作区。
- 修改布局时注意三组坐标基准：四周界面尺寸变量（见上）、安全区 `env(safe-area-inset-*)`、手机壳的 topbar/nav 高度变量。
- `themeId` / `STATION_THEMES` 是轨道站装饰玩法，与 UI 主题无关，勿混淆。
