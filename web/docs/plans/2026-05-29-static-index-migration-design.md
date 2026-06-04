# static/index.html 模块迁移到 web(React) 的设计方案

日期：2026-05-29

## 目标与约束

### 目标
- 保留 `web` 现有三路由页面：
  - `/heatmap`
  - `/analysis`
  - `/overview`
- 将 `static/index.html` 的“功能模块与交互体验”迁移到 React：
  - 顶部 TopBar：Tab + 状态 Chip（待机/运行中/就绪/错误）
  - 左侧 Sidebar：上传/运行/树/图例/日志（交互与视觉风格对齐 static）
  - 注意力树：**层 → 头 → Patch 网格**，展开/折叠流畅，支持选中高亮
  - 数据来源：全部从后端接口拉取（保留真实后端数据链路）
- 图表风格与形式对齐 static：
  - `Analysis`：折线（KL/局部性）、柱状（漏斗）、极坐标柱状（3D 指标）
  - 不额外新增“真正的饼图/环图”（按用户选择 1：严格按 static 的 3 张分析图）

### 非目标
- 不改后端接口定义（仅消费后端现有接口）
- 不要求重写所有既有 chart 组件（允许逐步下线旧实现）

## 当前问题诊断（为何“运行后没有加载树按钮”）

- `static/index.html` 中：点击 RUN 后会自动请求 `/tree_stats`；同时 UI 有完整的状态与日志反馈。
- `web` 现状（改造前）：页面偏 demo + mock 驱动，缺少“run → loadTree → selectPatch → visualize”的完整链路与可见按钮。

迁移后将确保：
- Sidebar 中存在显式按钮：
  - `▶ RUN MODEL`（POST `/run`）
  - `加载树`（GET `/tree_stats`）
- 同时保留“run 成功后自动 loadTree”的体验。

## 信息架构（保留路由，统一外壳）

### 总体布局（全站一致）
- TopBar（固定高度）
- Workspace：
  - Sidebar（固定宽度）
  - Content（路由切换区域：Heatmap/Analysis/Overview）

### 路由职责
- `/heatmap`：
  - 展示 `/visualize` 返回 PNG
  - Patch 选择由 Sidebar 的树触发，右侧只负责展示与占位说明
- `/analysis`：
  - 展示三张分析图（ECharts），数据来自后端 `/analysis/*`
  - 支持按需加载与缓存（对齐 static 的 `anaCache` 思路）
- `/overview`：
  - 展示模型概览信息卡片与 API 路由速查（对齐 static 的 info 面板）

## 统一数据与状态（关键：跨路由联动）

### 全局状态（建议：Context + reducer 或轻量 store）
建议建立 `InspectorStore`，至少包含：
- `file`: File | null（用户选择的图像文件）
- `previewUrl`: string | null（本地预览 DataURL / objectURL）
- `status`: 'idle' | 'busy' | 'ready' | 'error'
- `logs`: Array<{ ts: number; level: 'ok'|'warn'|'err'; message: string }>
- `tree`: AttentionTreeData | null（/tree_stats）
- `selected`: { layerId; headId; patchId } | null
- `heatmapImageUrl`: string | null（由 visualize blob 生成的 objectURL）
- `analysisCache`: { kl?: KLLocalityData; fn?: FunnelData; bar3d?: ThreeDBarData }

### 全局动作（Action）
- `selectFile(file)`
- `runModel()`
- `loadTree()`
- `selectPatch(layerId, headId, patchId)` → 触发 `loadVisualize()`
- `loadAnalysis(type)` / `loadAllAnalysis()`
- `log(level, message)`
- `setStatus(status)`

### 后端接口（保持不变）
- `POST /run`（multipart/form-data: image）
- `GET /tree_stats`（JSON）
- `GET /visualize?layer_id=&head_id=&patch_id=`（PNG 二进制）
- `GET /analysis/kl_locality`（JSON）
- `GET /analysis/funnel`（JSON）
- `GET /analysis/3d_bar`（JSON）

## 组件拆分（保留模块化，但对齐 static 体验）

### TopBar
- `TopBarTabs`：Tab 点击 → 路由跳转（/heatmap /analysis /overview）
- `StatusChip`：根据全局 `status` 显示样式与文案

### Sidebar（迁移 static 的模块）
- `ImageDropzone`：上传/拖拽/预览信息
- `RunButton`：触发 run
- `EntropyLegend`：颜色条 + 文案
- `AttentionTree`：层/头/patch grid + 展开/折叠 + 选中
- `LogPanel`：底部日志

### Heatmap 内容区
- `HeatmapViewer`：
  - 未选择 patch：占位提示（对齐 static）
  - 已选择 patch：展示 PNG 图

### Analysis 内容区（ECharts）
- `AnalysisControls`：
  - 三按钮：KL、漏斗、3D
  - 全部加载
- `AnalysisCardGrid`：
  - 每张图一个 card（对齐 static）
  - 复用 `renderChart(container, option)` 统一处理 resize

### Overview 内容区
- `InfoCards`（输入分辨率、放大倍数、patch 尺寸、检测到层数/头数/patch 数）
- `ApiRoutesList`（路由速查）

## 图表规范（与 static 一致）

### KL/局部性（折线）
- 多条虚线：每个 head 的 KL 曲线
- 一条粗线：KL 均值

### 漏斗（柱状）
- 两组柱：有效秩相对值、主导奇异值能量

### 3D 指标（极坐标柱状）
- 三组系列：row_var、sparsity、gini
- baseline = 100（相对 L0）

## 开发与联调策略

### 开发代理
- dev：Vite proxy 转发 `/run` `/tree_stats` `/visualize` `/analysis` 到后端 baseUrl（默认 `http://localhost:8080`）
- prod：可通过 `VITE_API_BASE_URL` 指向后端（若要跨域，后端需 CORS）

### 缓存与性能
- `tree_stats` 数据量较大：只在需要时请求，避免频繁刷新
- `visualize` 返回 PNG：使用 objectURL，并在更新/卸载时释放 URL
- analysis 使用会话内缓存（避免重复请求）

## 验收标准（Done Definition）
- Sidebar 有明确“RUN MODEL”与“加载树”按钮
- run 成功后自动 loadTree（同时按钮仍可手动触发）
- Tree 展开/折叠流畅；Patch 网格可选中；选中后 Heatmap 页立即显示 `/visualize` 图
- Analysis 页展示 3 张与 static 形态一致的图（折线/柱状/极坐标柱状），数据来自后端
- Overview 页显示 meta 信息与路由速查（样式/结构对齐 static）

