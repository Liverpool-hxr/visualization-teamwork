# MultiVIT SR Attention Inspector - 可视化设计方案

## 1. 项目概述

### 1.1 项目背景
将static/index.html的MultiVIT SR Attention Inspector迁移至React，使用Ant Design + AntV G2技术栈，优化视觉设计和交互体验。

### 1.2 核心目标
- ✅ 迁移核心功能（热力图、分析图表）
- ✅ 优化UI和交互体验
- ✅ 使用AntV G2替代ECharts
- ✅ 数据来源：mock文件夹

---

## 2. 技术架构

### 2.1 技术栈
| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | React | 18+ | 函数式组件 + Hooks |
| 语言 | TypeScript | 5+ | 严格类型检查 |
| UI库 | Ant Design | 5+ | 暗色主题定制 |
| 可视化 | AntV G2 | 5+ | 图表渲染 |
| 构建工具 | Vite | 5+ | 已配置 |
| 包管理 | npm | - | 禁止yarn/pnpm |
| 代码检查 | ESLint | - | 提交前检查 |

### 2.2 项目结构
```
web/
├── src/
│   ├── components/
│   │   ├── common/              # 通用组件
│   │   │   ├── Layout/          # 整体布局
│   │   │   │   ├── index.tsx
│   │   │   │   └── styles.module.css
│   │   │   ├── Sidebar/         # 侧边栏
│   │   │   │   ├── index.tsx
│   │   │   │   └── styles.module.css
│   │   │   └── TopBar/          # 顶部导航
│   │   │       ├── index.tsx
│   │   │       └── styles.module.css
│   │   ├── charts/              # 图表组件
│   │   │   ├── HeatmapChart/
│   │   │   │   ├── index.tsx
│   │   │   │   └── useHeatmap.ts
│   │   │   ├── KLLocalityChart/
│   │   │   │   ├── index.tsx
│   │   │   │   └── useKLLocality.ts
│   │   │   ├── FunnelChart/
│   │   │   ├── DegradeChart/
│   │   │   ├── LayerSimilarityChart/
│   │   │   └── HeadSimilarityChart/
│   │   ├── tree/                # 树形结构
│   │   │   └── AttentionTree/
│   │   │       ├── index.tsx
│   │   │       ├── TreeNode.tsx
│   │   │       └── useTree.ts
│   │   └── upload/              # 上传组件
│   │       └── ImageUpload/
│   │           ├── index.tsx
│   │           └── useUpload.ts
│   ├── pages/
│   │   ├── Heatmap/             # 热力图页面
│   │   │   └── index.tsx
│   │   ├── Analysis/            # 分析图表页面
│   │   │   └── index.tsx
│   │   └── Overview/            # 模型概览页面
│   │       └── index.tsx
│   ├── hooks/
│   │   ├── useMockData.ts       # Mock数据Hook
│   │   └── useAttention.ts      # 注意力数据Hook
│   ├── services/
│   │   └── mockService.ts       # Mock数据服务
│   ├── types/
│   │   ├── attention.ts         # 注意力类型定义
│   │   ├── chart.ts             # 图表类型定义
│   │   └── tree.ts              # 树形结构类型定义
│   ├── styles/
│   │   ├── theme.ts             # Ant Design主题配置
│   │   ├── global.css           # 全局样式
│   │   └── variables.css        # CSS变量
│   └── utils/
│       ├── chart.ts             # 图表工具函数
│       └── color.ts             # 颜色工具函数
├── public/
│   └── mock/                    # Mock数据（从根目录mock读取）
└── package.json
```

---

## 3. UI设计方案

### 3.1 设计系统（基于ui-ux-pro-max）

#### 3.1.1 设计风格
**风格：Cyberpunk UI**
- 关键词：Neon, dark mode, terminal, HUD, sci-fi, futuristic
- 适用场景：数据可视化、AI/ML工具、开发者工具
- 性能：中等 | 可访问性：有限（暗色+霓虹）

#### 3.1.2 配色方案
```css
/* 主色调 */
--primary-color: #00d4aa;        /* Teal - 主色 */
--secondary-color: #4da6ff;      /* Blue - 辅助色 */
--accent-color: #f0b429;         /* Amber - 强调色 */
--danger-color: #ff5f57;         /* Red - 危险色 */
--purple-color: #b48eff;         /* Purple - 特殊色 */

/* 背景色 */
--bg-0: #080b10;                 /* 最深背景 */
--bg-1: #0d1117;                 /* 主背景 */
--bg-2: #131921;                 /* 次背景 */
--bg-3: #1a2233;                 /* 卡片背景 */

/* 文本色 */
--text-0: #e8edf5;               /* 主文本 */
--text-1: #8fa3bf;               /* 次文本 */
--text-2: #4a6080;               /* 弱文本 */

/* 边框色 */
--border-1: #1f2d42;             /* 主边框 */
--border-2: #263347;             /* 次边框 */
```

#### 3.1.3 字体方案
**字体：Fira Code / Fira Sans**
- Fira Code：代码、数据、标签（等宽字体）
- Fira Sans：正文、标题（无衬线字体）

```css
/* 字体导入 */
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');

/* 字体使用 */
--font-mono: 'Fira Code', monospace;
--font-sans: 'Fira Sans', sans-serif;
```

#### 3.1.4 视觉效果
- **霓虹发光**：text-shadow用于强调元素
- **故障动画**：skew/offset用于特殊效果
- **扫描线**：::before overlay用于背景
- **终端风格**：等宽字体用于数据和代码

### 3.2 Ant Design主题配置

```typescript
// src/styles/theme.ts
import type { ThemeConfig } from 'antd';

export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#00d4aa',
    colorSuccess: '#2ed573',
    colorWarning: '#f0b429',
    colorError: '#ff5f57',
    colorInfo: '#4da6ff',
    
    colorBgBase: '#0d1117',
    colorTextBase: '#e8edf5',
    
    borderRadius: 6,
    fontFamily: "'Fira Sans', sans-serif",
    fontFamilyCode: "'Fira Code', monospace",
  },
  components: {
    Layout: {
      colorBgBody: '#080b10',
      colorBgHeader: '#0d1117',
      colorBgSider: '#0d1117',
    },
    Menu: {
      colorBgContainer: '#0d1117',
      colorItemBgSelected: 'rgba(0, 212, 170, 0.1)',
      colorItemTextSelected: '#00d4aa',
    },
    Card: {
      colorBgContainer: '#131921',
    },
    Button: {
      primaryShadow: '0 0 10px rgba(0, 212, 170, 0.3)',
    },
  },
};
```

### 3.3 布局设计

#### 3.3.1 整体布局
```
┌─────────────────────────────────────────────────────────┐
│  TopBar (48px)                                           │
│  ┌──────┬─────────────────────────────────────┬────────┐│
│  │ Logo │ Tabs: [热力图 | 分析图表 | 模型概览] │ Status ││
│  └──────┴─────────────────────────────────────┴────────┘│
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │  Main Content                                │
│ (300px)  │  ┌────────────────────────────────────────┐ │
│          │  │                                        │ │
│  Upload  │  │  Panel Content (Heatmap/Analysis/Info) │ │
│  Tree    │  │                                        │ │
│  Log     │  │                                        │ │
│          │  └────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────┘
```

#### 3.3.2 响应式断点
```css
/* 移动端 */
@media (max-width: 767px) {
  /* Sidebar折叠 */
  /* 单列布局 */
}

/* 平板 */
@media (min-width: 768px) and (max-width: 1023px) {
  /* Sidebar可折叠 */
  /* 双列布局 */
}

/* 桌面 */
@media (min-width: 1024px) {
  /* 三栏布局 */
  /* 固定Sidebar */
}
```

### 3.4 组件设计

#### 3.4.1 TopBar组件
- **Logo**：SR标识，teal背景
- **Tabs**：Ant Design Tabs，自定义样式
- **Status**：状态指示器，带动画效果

#### 3.4.2 Sidebar组件
- **Upload区域**：拖拽上传，预览缩略图
- **树形结构**：层/头/Patch三级树，可展开/收起
- **Log区域**：操作日志，实时更新

#### 3.4.3 图表组件
- **HeatmapChart**：热力图，支持缩放和交互
- **KLLocalityChart**：KL散度折线图
- **FunnelChart**：漏斗图/柱状图
- **DegradeChart**：多维退化柱状图
- **LayerSimilarityChart**：层间相似度热力图
- **HeadSimilarityChart**：头间相似度热力图

---

## 4. 数据流设计

### 4.1 数据来源
所有数据从根目录的`mock`文件夹读取，禁止修改web外的文件。

```
mock/
├── tree_stats.json              # 树形统计数据
├── heatmap/                     # 热力图数据
│   ├── layer_0_head_0_patch_0.json
│   ├── layer_0_head_0_patch_1.json
│   └── ...
└── analysis/                    # 分析数据
    ├── kl_locality.json         # KL散度与局部性
    ├── funnel.json              # 漏斗图数据
    ├── degrade_bar.json         # 退化柱状图
    ├── layer_similarity.json    # 层间相似度
    ├── head_similarity.json     # 头间相似度
    ├── patch_similarity.json    # Patch相似度
    ├── advanced_stats.json      # 高级统计
    └── head_wasserstein.json    # Wasserstein距离
```

### 4.2 数据流
```
mock文件夹
    ↓
mockService.ts（读取JSON数据）
    ↓
useMockData Hook（管理数据状态）
    ↓
组件（消费数据）
```

### 4.3 类型定义

```typescript
// src/types/attention.ts
export interface LayerData {
  layer_id: number;
  entropy: number;
  heads: HeadData[];
}

export interface HeadData {
  head_id: number;
  entropy: number;
  max_attn: number;
  patches: PatchData[];
}

export interface PatchData {
  patch_id: number;
  entropy: number;
  max_attn: number;
}

export interface TreeStats {
  meta: {
    num_layers: number;
    num_heads: number;
    num_patches: number;
  };
  layers: LayerData[];
}

// src/types/chart.ts
export interface KLData {
  layers: Array<{
    kl_mean: number;
    kl_per_head: number[];
  }>;
  num_layers: number;
  num_heads: number;
}

export interface FunnelData {
  layers: Array<{
    layer: number;
    effective_rank_rel: number;
    singular_energy_rel: number;
  }>;
}

export interface SimilarityMatrix {
  cosine: number[][];
}
```

---

## 5. 交互设计

### 5.1 动画效果
- **页面切换**：淡入淡出，300ms
- **树节点展开**：高度动画，200ms
- **图表加载**：骨架屏 + 淡入
- **Hover效果**：颜色过渡，150ms

### 5.2 交互反馈
- **上传成功**：绿色提示 + 缩略图显示
- **加载中**：骨架屏 + 状态指示
- **错误提示**：红色提示 + 错误信息
- **选择反馈**：高亮 + 边框

### 5.3 键盘导航
- **方向键**：Patch选择导航
- **Tab**：焦点切换
- **Enter**：确认选择
- **Esc**：取消操作

---

## 6. 性能优化

### 6.1 代码分割
```typescript
// 路由懒加载
const Heatmap = lazy(() => import('./pages/Heatmap'));
const Analysis = lazy(() => import('./pages/Analysis'));
const Overview = lazy(() => import('./pages/Overview'));
```

### 6.2 图表优化
- 使用AntV G2的`autoFit`自动适配
- 大数据集使用采样或聚合
- 图表实例复用，避免重复创建

### 6.3 状态管理
- 使用React Context管理全局状态
- 使用useMemo缓存计算结果
- 使用useCallback缓存回调函数

---

## 7. 可访问性

### 7.1 ARIA属性
- 所有交互元素添加`aria-label`
- 图表添加`aria-describedby`
- 状态变化添加`aria-live`

### 7.2 键盘支持
- 所有可点击元素支持键盘操作
- 焦点顺序合理
- 焦点样式清晰

### 7.3 颜色对比度
- 文本对比度至少4.5:1
- 大文本对比度至少3:1
- 不仅依赖颜色传达信息

---

## 8. 实施计划

### Phase 1：基础架构（2-3天）
- [ ] 创建项目结构
- [ ] 配置Ant Design暗色主题
- [ ] 实现整体布局组件
- [ ] 配置路由

### Phase 2：核心组件（3-4天）
- [ ] 实现图像上传组件
- [ ] 实现树形结构组件
- [ ] 实现热力图组件
- [ ] 实现状态管理

### Phase 3：图表组件（4-5天）
- [ ] 实现KL散度图表
- [ ] 实现漏斗图
- [ ] 实现退化柱状图
- [ ] 实现相似度矩阵图
- [ ] 实现其他分析图表

### Phase 4：优化完善（2-3天）
- [ ] 添加动画效果
- [ ] 优化交互体验
- [ ] 响应式适配
- [ ] 性能优化
- [ ] 可访问性优化

---

## 9. 验收标准

### 9.1 功能验收
- [ ] 所有核心功能正常工作
- [ ] 数据正确从mock文件夹读取
- [ ] 图表正确渲染
- [ ] 交互功能正常

### 9.2 UI验收
- [ ] 视觉设计符合设计系统
- [ ] 暗色主题正确应用
- [ ] 响应式布局正常
- [ ] 动画效果流畅

### 9.3 性能验收
- [ ] 首屏加载时间 < 3s
- [ ] 图表渲染流畅
- [ ] 无明显卡顿

### 9.4 代码质量
- [ ] ESLint检查通过
- [ ] TypeScript无类型错误
- [ ] 代码符合规范

---

## 10. 附录

### 10.1 参考资源
- [Ant Design文档](https://ant.design/)
- [AntV G2文档](https://g2.antv.antgroup.com/)
- [React文档](https://react.dev/)
- [TypeScript文档](https://www.typescriptlang.org/)

### 10.2 设计灵感
- GitHub暗色主题
- VS Code暗色主题
- ECharts官方示例
- AntV G2官方示例
