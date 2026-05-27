# Attention Inspector - 前端可视化界面

> MultiVIT SR 项目的可视化前端界面，基于 React + TypeScript 构建，提供注意力分布热力图和统计分析图表。

---

## 目录

- [项目简介](#项目简介)
- [技术栈](#技术栈)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [开发指南](#开发指南)
- [项目结构](#项目结构)
- [组件开发规范](#组件开发规范)
- [API 集成](#api-集成)
- [代码规范](#代码规范)
- [常用命令](#常用命令)

---

## 项目简介

Attention Inspector 是 MultiVIT SR 项目的前端可视化界面，用于展示 Vision Transformer 模型在图像超分辨率过程中的注意力分布。

### 核心功能

- **热力图可视化**：以空间热力图形式展示每一层、每个注意力头的注意力分布
- **层级浏览**：通过 层 → 头 → Patch 的层级树结构浏览注意力权重
- **统计分析**：提供多种统计分析图表（KL 散度、有效秩、Wasserstein 距离、余弦相似度矩阵等）
- **实时交互**：上传图像、触发推理、浏览结果、切换图表

### 界面布局

| 区域 | 说明 |
|------|------|
| 顶部导航栏 | 面板切换 Tab 与实时状态标签 |
| 左侧边栏 | 图像上传、模型运行、注意力树浏览、日志显示 |
| 主内容区 | 热力图、分析图表、模型概览三个可切换面板 |

---

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | React 18+ | 函数式组件 + Hooks |
| 语言 | TypeScript | 严格类型检查 |
| 构建工具 | Vite | 快速的开发服务器和构建 |
| UI 库 | Ant Design 5.x | 企业级 UI 组件库 |
| 可视化 | AntV (G2 / G6 / X6) | 图表和关系图可视化 |
| 包管理 | npm | Node.js 默认包管理器 |
| 代码检查 | ESLint | 代码质量检查 |

---

## 环境要求

- **Node.js**: v18.x 或 v20.x LTS
- **npm**: v9.x 或 v10.x
- **操作系统**: Windows / macOS / Linux

### 推荐使用 nvm 管理 Node.js 版本

```bash
# macOS / Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Windows
# 下载并安装 nvm-windows：https://github.com/coreybutler/nvm-windows/releases
nvm install 20
nvm use 20
```

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置后端服务地址

在 `.env` 文件中配置后端服务地址（如果后端不在 `http://localhost:5000`）：

```env
VITE_API_BASE_URL=http://localhost:5000
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173` 查看应用。

### 4. 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

---

## 开发指南

### 技术栈选择理由

#### 为什么使用 React + TypeScript

- **类型安全**：TypeScript 提供编译时类型检查，减少运行时错误
- **现代前端标准**：React 18+ 的函数式组件和 Hooks 是当前主流实践
- **生态系统丰富**：大量的第三方库和工具支持

#### 为什么使用 Ant Design + AntV

- **统一的设计语言**：提供一致的 UI 组件和图表风格
- **开箱即用**：组件经过良好测试，可直接用于生产环境
- **数据可视化专长**：AntV 是阿里巴巴开源的专业可视化库

### 组件开发流程

1. **创建组件**：在 `src/components/` 或 `src/pages/` 下创建组件文件夹
2. **定义类型**：使用 TypeScript interface 定义 Props 和状态类型
3. **实现组件**：使用 React Hooks 和 Ant Design 组件
4. **编写样式**：使用 CSS Modules（`*.module.css`）
5. **代码检查**：运行 `npm run lint` 确保代码质量

详细规范请参见 [组件开发规范](#组件开发规范)。

---

## 项目结构

```
web/
├── src/
│   ├── components/           # 可复用组件
│   │   ├── common/          # 通用组件（Button、Modal、Card 等）
│   │   └── charts/          # 图表组件（HeatmapChart、LineChart 等）
│   ├── pages/               # 页面组件
│   │   ├── Heatmap/         # 热力图页面
│   │   ├── Analysis/        # 分析图表页面
│   │   └── Overview/        # 模型概览页面
│   ├── hooks/               # 自定义 Hooks
│   ├── services/            # API 服务
│   │   └── api.ts           # API 调用封装
│   ├── types/               # TypeScript 类型定义
│   │   ├── chart.ts         # 图表相关类型
│   │   └── api.ts           # API 响应类型
│   ├── utils/               # 工具函数
│   │   └── format.ts        # 数据格式化
│   ├── styles/              # 全局样式
│   │   └── theme.ts         # Ant Design 主题配置
│   ├── App.tsx              # 应用主组件
│   └── main.tsx             # 应用入口
├── public/                   # 公共资源
├── .env                      # 环境变量
├── package.json
├── tsconfig.json             # TypeScript 配置
├── vite.config.ts            # Vite 配置
└── eslint.config.js          # ESLint 配置
```

---

## 组件开发规范

### 组件分类原则

#### 可复用组件 (`components/`)

适用于：
- 在多个页面或组件中使用（≥2 处）
- 功能独立，不依赖特定页面上下文
- 通过 props 配置，不硬编码业务逻辑
- 纯展示组件，数据通过 props 传入

示例：
```
components/
├── common/
│   ├── Button/
│   ├── Modal/
│   └── Loading/
└── charts/
    ├── HeatmapChart/
    └── LineChart/
```

#### 页面组件 (`pages/`)

适用于：
- 对应特定路由路径
- 管理页面级状态和数据
- 包含特定业务逻辑
- 组合多个可复用组件

示例：
```
pages/
├── Heatmap/
│   ├── index.tsx
│   ├── HeatmapHeader.tsx
│   └── useHeatmapData.ts
└── Analysis/
    └── index.tsx
```

### 文件命名规则

| 文件类型 | 命名规则 | 示例 |
|---------|---------|------|
| 组件文件夹 | PascalCase | `HeatmapChart/` |
| 主文件 | `index.tsx` | `HeatmapChart/index.tsx` |
| 样式文件 | `index.module.css` | `HeatmapChart/index.module.css` |
| 类型定义 | `ComponentName.types.ts` | `HeatmapChart.types.ts` |
| 组件 Hook | `useComponentName.ts` | `useHeatmapChart.ts` |

### 组件模板

```typescript
import React from 'react';
import styles from './index.module.css';

interface ComponentProps {
  title: string;
  data: number[];
  onChange?: (value: number) => void;
}

const Component: React.FC<ComponentProps> = ({ title, data, onChange }) => {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{title}</h2>
      {/* 组件内容 */}
    </div>
  );
};

export default Component;
```

### 样式模板

```css
.container {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 12px;
}
```

---

## API 集成

### API 服务封装

所有 API 调用都应在 `src/services/api.ts` 中封装：

```typescript
// src/services/api.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const api = {
  async runModel(image: File): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('image', image);

    const response = await fetch(`${API_BASE_URL}/run`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  },

  async getVisualize(params: {
    layer_id: number;
    head_id: number;
    patch_id: number;
  }): Promise<string> {
    const query = new URLSearchParams({
      layer_id: String(params.layer_id),
      head_id: String(params.head_id),
      patch_id: String(params.patch_id),
    });

    const response = await fetch(`${API_BASE_URL}/visualize?${query}`);
    return response.url; // 返回图片 URL
  },

  async getTreeStats(): Promise<TreeStatsResponse> {
    const response = await fetch(`${API_BASE_URL}/tree_stats`);
    return response.json();
  },
};
```

### 数据类型定义

```typescript
// src/types/api.ts
export interface ApiResponse {
  status: 'ok' | 'error';
  message?: string;
}

export interface TreeStatsResponse {
  meta: {
    num_layers: number;
    num_heads: number;
    num_patches: number;
  };
  layers: LayerStats[];
}

export interface LayerStats {
  layer: number;
  entropy_mean: number;
  heads: HeadStats[];
}

export interface HeadStats {
  head: number;
  entropy: number;
  patch_entropies: number[];
}
```

---

## 代码规范

### TypeScript 规范

- ✅ 使用 `interface` 定义对象类型
- ✅ 使用 `type` 定义联合类型、交叉类型
- ✅ 避免使用 `any`，尽量使用 `unknown` 替代
- ✅ 导出类型定义放在 `src/types/` 目录

### React 规范

- ✅ 使用函数式组件 + Hooks
- ✅ 组件文件使用 PascalCase 命名
- ✅ Props 类型使用 interface 定义
- ✅ 使用 CSS Modules 管理样式

### CSS 规范

- ✅ 优先使用 CSS Modules（`*.module.css`）
- ✅ 或使用 styled-components
- ✅ 避免内联样式（除动态样式外）
- ✅ 使用语义化的类名

### ESLint 检查

提交代码前请运行：

```bash
npm run lint
```

修复自动可修复的问题：

```bash
npm run lint:fix
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm install` | 安装项目依赖 |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | 运行 ESLint 检查 |
| `npm run lint:fix` | 自动修复 ESLint 问题 |

---

## 常见问题

### Q: 后端服务无法连接？

1. 确保 Python 后端服务已启动（参见顶层 README）
2. 检查 `.env` 文件中的 `VITE_API_BASE_URL` 配置
3. 确认后端服务地址和端口正确

### Q: 安装依赖失败？

1. 清除 npm 缓存：`npm cache clean --force`
2. 删除 `node_modules` 和 `package-lock.json`
3. 重新安装：`npm install`

### Q: TypeScript 类型错误？

1. 确保所有类型都已正确定义
2. 运行 `npm run build` 查看完整的类型错误列表
3. 使用 `unknown` 替代 `any`

---

## 参考资源

- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [Ant Design 官方文档](https://ant.design/)
- [AntV 官方文档](https://antv.vision/)
- [Vite 官方文档](https://vitejs.dev/)
