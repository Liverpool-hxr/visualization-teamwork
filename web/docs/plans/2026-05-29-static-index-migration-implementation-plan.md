# static/index.html 迁移到 web(React) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在保留 `/heatmap`、`/analysis`、`/overview` 三路由的前提下，把 `static/index.html` 的 TopBar/Sidebar/日志/状态/树形 Patch 网格 与 ECharts 图表体验迁移到 React，并保持从后端真实接口拉取数据。

**Architecture:** 以统一的 `InspectorLayout` 作为外壳（TopBar + Sidebar + Router Outlet），用全局 `InspectorStore` 管理文件、状态、日志、树、选中 patch 与图表缓存；三个路由页只负责右侧内容区渲染（heatmap/png、analysis/echarts、overview/info）。

**Tech Stack:** React + TypeScript + Vite + Ant Design（容器组件）+ ECharts（图表）+ fetch（API）

---

## Task 1: 引入 ECharts（作为静态模板图表渲染引擎）

**Files:**
- Modify: `web/package.json`

**Step 1: 写一个最小渲染验证页面（无需测试，先确保依赖可用）**
- 说明：本项目当前没有 Jest/Vitest 测试框架，先用“可运行验证”替代单测，后续如需要可补 Vitest。

**Step 2: 安装依赖**

Run:
- `npm i echarts`

Expected:
- `package-lock.json` 更新

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(web): 引入ECharts依赖\n\n- 安装echarts用于对齐static图表渲染"
```

---

## Task 2: 搭建全局 InspectorStore（状态/日志/选中 patch/缓存）

**Files:**
- Create: `web/src/store/inspectorStore.tsx`
- Modify: `web/src/main.tsx`（挂 Provider）

**Step 1: 写“最小可用 store”代码（不改页面）**
- 状态字段：
  - status、logs、file、previewUrl、tree、selected、heatmapUrl、analysisCache
- action：
  - setStatus / pushLog / setFile / setTree / setSelected / setHeatmapUrl / setAnalysisCache

**Step 2: 在 main.tsx 挂载 Provider**

**Step 3: 手动验证**
- 启动 `npm run dev` 确认无 runtime error

**Step 4: Commit**

```bash
git add src/store/inspectorStore.tsx src/main.tsx
git commit -m "feat(web): 新增Inspector全局状态容器\n\n- 建立status/log/tree/selection等共享状态\n- 为跨路由联动做准备"
```

---

## Task 3: 重构 Layout 为 static 风格外壳（TopBar Tab + 状态，Sidebar 常驻）

**Files:**
- Create: `web/src/components/shell/InspectorLayout/index.tsx`
- Create: `web/src/components/shell/InspectorLayout/index.module.css`
- Create: `web/src/components/shell/TopBarStatic/index.tsx`
- Create: `web/src/components/shell/TopBarStatic/index.module.css`
- Create: `web/src/components/shell/SidebarStatic/index.tsx`
- Create: `web/src/components/shell/SidebarStatic/index.module.css`
- Modify: `web/src/router/index.tsx`（用 InspectorLayout 包裹 Outlet）

**Step 1: 先只做静态 UI（不接接口）**
- TopBar Tab 点击：使用 `useNavigate` 跳转三路由
- StatusChip：从 store 读 `status`
- Sidebar：放置占位区块（上传区/按钮区/图例/树/日志）

**Step 2: 手动验证**
- `npm run dev`：确认 3 个路由都能看到一致外壳，内容区正常切换

**Step 3: Commit**

```bash
git add src/components/shell src/router/index.tsx
git commit -m "refactor(web): 引入static风格Layout外壳\n\n- 新增TopBarStatic与SidebarStatic骨架\n- 三路由页面统一在外壳内渲染"
```

---

## Task 4: Sidebar 上传 + RUN + 加载树 + 日志（对齐 static 交互）

**Files:**
- Modify: `web/src/components/shell/SidebarStatic/index.tsx`
- Modify: `web/src/services/api.ts`（如需补接口方法）
- Modify: `web/src/hooks/useApiData.ts`（可选：把“enabled=false+refetch”封装更顺滑）

**Step 1: 上传模块**
- 复用现有 `ImageUpload`，但交互对齐：
  - 选图后写入 store（file + previewUrl）
  - pushLog('已选择: xxx')

**Step 2: RUN MODEL 按钮**
- 点击 → store.setStatus('busy') + pushLog('启动超分模型…')
- 调用 `api.runModel(file)`
- 成功 → pushLog('模型运行完成') + setStatus('ready') + 自动触发 loadTree
- 失败 → pushLog('运行失败: ...', 'err') + setStatus('error')

**Step 3: “加载树”按钮（显式）**
- 点击 → 调 `api.getTreeStats`，写入 store.tree
- 失败显示 error/log

**Step 4: 日志面板**
- 读取 store.logs 渲染；按 level 上色

**Step 5: Commit**

```bash
git add src/components/shell/SidebarStatic src/services/api.ts src/hooks/useApiData.ts
git commit -m "feat(web): 迁移static侧栏交互并接入后端\n\n- 增加RUN与加载树按钮并写入全局日志/状态\n- 保留run后自动加载树的体验"
```

---

## Task 5: 注意力树改为 static 的“Patch 网格”并联动 /visualize

**Files:**
- Modify: `web/src/components/tree/AttentionTree/index.tsx`
- Modify: `web/src/components/tree/AttentionTree/index.module.css`
- Modify: `web/src/services/api.ts`（visualize blob 已有则不改）
- Modify: `web/src/components/shell/SidebarStatic/index.tsx`（把 tree 放侧栏并接 selection）

**Step 1: Tree 展示与展开折叠**
- 展示层、头、patch grid（和 static 体验一致）

**Step 2: Patch 点击**
- 写入 store.selected
- setStatus('busy') + pushLog('加载热力图 ...')
- 调 `api.getVisualizeBlob`，生成 objectURL 写入 store.heatmapUrl
- 成功 setStatus('ready')；失败 setStatus('error')

**Step 3: Commit**

```bash
git add src/components/tree/AttentionTree src/components/shell/SidebarStatic src/services/api.ts
git commit -m "refactor(web): 迁移static注意力树与热力图联动\n\n- 树改为层/头/patch网格结构并支持选中高亮\n- 点击patch请求/visualize并写入全局heatmapUrl"
```

---

## Task 6: /heatmap 页面改为“只读展示”全局 heatmapUrl（对齐 static 面板）

**Files:**
- Modify: `web/src/pages/Heatmap/index.tsx`

**Step 1: 页面只从 store 读取**
- 未选 patch：提示“选择 Patch 查看热力图”
- 已有 heatmapUrl：展示图片

**Step 2: Commit**

```bash
git add src/pages/Heatmap/index.tsx
git commit -m "refactor(web): Heatmap页改为基于全局状态展示\n\n- 从全局heatmapUrl读取并展示/visualize结果\n- 未选择patch时显示占位提示"
```

---

## Task 7: /analysis 页面迁移为 static 的 ECharts 三图（按需加载 + 缓存）

**Files:**
- Modify: `web/src/pages/Analysis/index.tsx`
- Create: `web/src/pages/Analysis/charts/renderers.ts`（可选：集中 chart option）

**Step 1: 改为 ECharts 渲染**
- KL：折线（每头虚线 + 均值粗线）
- 漏斗：两柱
- 3D：极坐标柱状

**Step 2: 数据加载策略**
- 优先读 store.analysisCache
- 没有则请求后端 `/analysis/*`，写 cache

**Step 3: Commit**

```bash
git add src/pages/Analysis
git commit -m "refactor(web): Analysis页迁移为static风格ECharts三图\n\n- 使用后端analysis接口按需加载并缓存\n- 图形形态对齐static的折线/柱状/极坐标柱状"
```

---

## Task 8: /overview 页面改为 static info 面板风格（读取 tree/meta）

**Files:**
- Modify: `web/src/pages/Overview/index.tsx`

**Step 1: 读取 store.tree/meta 与 store.analysisCache**
- 展示层数/头数/patch数
- 展示 API 路由速查（静态列表）

**Step 2: Commit**

```bash
git add src/pages/Overview/index.tsx
git commit -m "refactor(web): Overview页对齐static信息面板\n\n- 展示模型元信息与API路由速查\n- 从全局tree/meta读取数据避免重复请求"
```

---

## Task 9: 回归验证与清理（确保“直接出效果”）

**Files:**
- Modify: `web/README.md`（补充运行说明：后端端口/环境变量/代理）
- Optional: `web/src/hooks/useMockData.ts`（标记 deprecated 或移除引用说明）

**Step 1: 联调验证步骤（手动）**
- 后端启动：`python backend/visualization.py`（8080）
- 前端启动：`npm run dev`
- 验证流程：
  - 上传图片 → RUN → 自动加载树
  - 点击 Patch → heatmap 出图
  - Analysis：三按钮各自加载数据并出图；“全部加载”可并发请求
  - Overview：元信息正确显示

**Step 2: 构建与检查**
- `npm run lint`
- `npm run build`

**Step 3: Commit**

```bash
git add README.md src/hooks/useMockData.ts
git commit -m "docs(web): 更新联调运行说明与清理mock入口\n\n- 补充后端端口与前端代理配置说明\n- 标记/清理mock数据入口避免误用"
```

