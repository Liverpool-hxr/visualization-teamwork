# Attention Inspector — 前端

MultiVIT SR 的可视化前端，基于 React + TypeScript + ECharts 构建。

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
```

访问 `http://localhost:5173`。

> 开发代理已配置在 `vite.config.ts`，会将 API 请求转发到 `http://localhost:8080`（后端 `visualization.py`）。请确保后端已启动。

---

## 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | React 19 + TypeScript |
| 构建 | Vite |
| UI | Ant Design（Image 等轻量组件） |
| 图表 | ECharts |
| 路由 | React Router v7 |
| 样式 | CSS Modules |

---

## 项目结构

```
web/
├── src/
│   ├── components/
│   │   ├── shell/           # InspectorLayout / TopBarStatic / SidebarStatic
│   │   ├── tree/            # AttentionTree 注意力树（层→头→Patch 网格）
│   │   └── common/          # PageTransition 等通用组件
│   ├── pages/
│   │   ├── Heatmap/         # 热力图页：/visualize 图片 + 头间相似度热力图
│   │   ├── Analysis/        # 分析图表页：KL折线 / 漏斗柱状 / 极坐标柱状
│   │   └── Overview/        # 模型概览页：配置 / 统计 / API 路由
│   ├── store/               # InspectorProvider — 全局状态（文件/日志/树/选中Patch/缓存）
│   ├── services/api.ts      # 后端 API 封装
│   ├── hooks/               # useApiData 等自定义 Hooks
│   └── types/               # TypeScript 类型定义
├── vite.config.ts           # Vite 配置（含后端代理）
└── package.json
```

---

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm install` | 安装依赖 |
| `npm run dev` | 启动开发服务器 (localhost:5173) |
| `npm run build` | 构建生产版本 → `dist/` |
| `npm run lint` | ESLint 代码检查 |

---

## 用户操作流程

```
1. 上传图像（左侧拖拽或点击）
2. 点击 ▶ RUN MODEL  → POST /run
3. 推理完成后自动加载树  → GET /tree_stats
4. 展开树节点，点击 Patch  → GET /visualize → 热力图显示
5. 切换 Tab 到"分析图表" → 点击按钮加载 ECharts 图表  → GET /analysis/*
```
