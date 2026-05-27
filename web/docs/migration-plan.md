# React迁移计划

## 1. 当前项目评估

### 1.1 现有配置
| 项目 | 版本 | 状态 |
|------|------|------|
| React | 19.2.6 | ✅ 最新 |
| Vite | 8.0.12 | ✅ 最新 |
| TypeScript | 6.0.2 | ✅ 最新 |
| ESLint | 10.3.0 | ✅ 已配置 |

### 1.2 缺失依赖
| 依赖 | 用途 | 优先级 |
|------|------|--------|
| antd | UI组件库 | 高 |
| @antv/g2 | 图表库 | 高 |
| @antv/g2plot | 高级图表 | 中 |
| react-router-dom | 路由管理 | 高 |
| @ant-design/icons | 图标库 | 高 |

---

## 2. 迁移步骤

### Phase 1：环境准备（1天）

#### Step 1.1：安装依赖
```bash
# UI库和图标
npm install antd @ant-design/icons

# 可视化库
npm install @antv/g2 @antv/g2plot

# 路由
npm install react-router-dom

# 工具库（可选）
npm install dayjs lodash
npm install -D @types/lodash
```

#### Step 1.2：配置Ant Design主题
创建 `src/styles/theme.ts`：
```typescript
import type { ThemeConfig } from 'antd';

export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#00d4aa',
    colorBgBase: '#0d1117',
    colorTextBase: '#e8edf5',
    borderRadius: 6,
    fontFamily: "'Fira Sans', sans-serif",
  },
  components: {
    Layout: {
      colorBgBody: '#080b10',
      colorBgHeader: '#0d1117',
    },
    Menu: {
      colorBgContainer: '#0d1117',
    },
    Card: {
      colorBgContainer: '#131921',
    },
  },
};
```

#### Step 1.3：配置路由
创建 `src/router/index.tsx`：
```typescript
import { createBrowserRouter } from 'react-router-dom';
import Layout from '@/components/common/Layout';
import Heatmap from '@/pages/Heatmap';
import Analysis from '@/pages/Analysis';
import Overview from '@/pages/Overview';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Heatmap /> },
      { path: 'analysis', element: <Analysis /> },
      { path: 'overview', element: <Overview /> },
    ],
  },
]);
```

---

### Phase 2：基础组件（2-3天）

#### Step 2.1：创建Layout组件
```
src/components/common/Layout/
├── index.tsx          # 主布局
├── TopBar.tsx         # 顶部导航
├── Sidebar.tsx        # 侧边栏
└── styles.module.css  # 样式
```

**功能：**
- 三栏布局（TopBar + Sidebar + Content）
- 响应式适配
- 暗色主题

#### Step 2.2：创建TopBar组件
**功能：**
- Logo展示
- 标签页切换（热力图、分析图表、模型概览）
- 状态指示器

**技术：**
- Ant Design Tabs
- 自定义样式

#### Step 2.3：创建Sidebar组件
**功能：**
- 图像上传区域
- 树形结构展示
- 操作日志

**技术：**
- Ant Design Upload
- Ant Design Tree
- 自定义树形组件（用于Patch网格）

---

### Phase 3：核心功能（3-4天）

#### Step 3.1：图像上传功能
```
src/components/upload/ImageUpload/
├── index.tsx          # 上传组件
├── useUpload.ts       # 上传Hook
└── styles.module.css
```

**功能：**
- 拖拽上传
- 文件类型验证（PNG/JPG/BMP）
- 预览缩略图
- 文件信息展示

**数据流：**
```
用户上传 → 文件验证 → 预览显示 → 触发模型运行（Mock）
```

#### Step 3.2：树形结构功能
```
src/components/tree/AttentionTree/
├── index.tsx          # 树形组件
├── TreeNode.tsx       # 树节点
├── PatchGrid.tsx      # Patch网格
├── useTree.ts         # 树形Hook
└── styles.module.css
```

**功能：**
- 三级树结构（Layer → Head → Patch）
- 展开/收起动画
- 熵值颜色编码
- Patch网格展示
- 点击选择Patch

**数据来源：**
```
mock/tree_stats.json → useMockData Hook → AttentionTree组件
```

#### Step 3.3：热力图功能
```
src/components/charts/HeatmapChart/
├── index.tsx          # 热力图组件
├── useHeatmap.ts      # 热力图Hook
└── styles.module.css
```

**功能：**
- 热力图展示
- 缩放交互
- 颜色映射

**数据来源：**
```
mock/heatmap/layer_X_head_Y_patch_Z.json → HeatmapChart组件
```

---

### Phase 4：图表组件（4-5天）

#### Step 4.1：KL散度图表
```
src/components/charts/KLLocalityChart/
├── index.tsx
├── useKLLocality.ts
└── styles.module.css
```

**图表类型：** 多系列折线图
**数据来源：** `mock/analysis/kl_locality.json`

#### Step 4.2：漏斗图
```
src/components/charts/FunnelChart/
├── index.tsx
└── useFunnel.ts
```

**图表类型：** 分组柱状图
**数据来源：** `mock/analysis/funnel.json`

#### Step 4.3：退化柱状图
```
src/components/charts/DegradeChart/
├── index.tsx
└── useDegrade.ts
```

**图表类型：** 多系列柱状图
**数据来源：** `mock/analysis/degrade_bar.json`

#### Step 4.4：相似度矩阵图
```
src/components/charts/LayerSimilarityChart/
├── index.tsx
└── useLayerSimilarity.ts

src/components/charts/HeadSimilarityChart/
├── index.tsx
└── useHeadSimilarity.ts
```

**图表类型：** 热力图
**数据来源：** 
- `mock/analysis/layer_similarity.json`
- `mock/analysis/head_similarity.json`

#### Step 4.5：其他图表（可选）
- Patch相似度图
- 高级统计图
- Wasserstein距离图

---

### Phase 5：页面组装（2天）

#### Step 5.1：热力图页面
```
src/pages/Heatmap/
├── index.tsx          # 页面组件
└── styles.module.css
```

**组成：**
- ImageUpload组件
- AttentionTree组件
- HeatmapChart组件

#### Step 5.2：分析图表页面
```
src/pages/Analysis/
├── index.tsx
└── styles.module.css
```

**组成：**
- 图表选择器（Ant Design Tabs或Button Group）
- 各图表组件（懒加载）

#### Step 5.3：模型概览页面
```
src/pages/Overview/
├── index.tsx
└── styles.module.css
```

**组成：**
- 模型信息卡片
- API路由列表

---

### Phase 6：优化完善（2-3天）

#### Step 6.1：动画效果
- 页面切换动画
- 树节点展开动画
- 图表加载动画
- Hover效果

#### Step 6.2：交互优化
- 键盘导航
- 焦点管理
- 状态反馈

#### Step 6.3：响应式适配
- 移动端布局
- 平板布局
- 桌面布局

#### Step 6.4：性能优化
- 代码分割
- 图表优化
- 状态管理优化

---

## 3. 迁移优先级

### 高优先级（核心功能）
1. ✅ Layout组件（布局基础）
2. ✅ TopBar组件（导航基础）
3. ✅ Sidebar组件（侧边栏基础）
4. ✅ ImageUpload组件（图像上传）
5. ✅ AttentionTree组件（树形结构）
6. ✅ HeatmapChart组件（热力图）

### 中优先级（主要图表）
7. ✅ KLLocalityChart组件（KL散度）
8. ✅ FunnelChart组件（漏斗图）
9. ✅ DegradeChart组件（退化柱状图）
10. ✅ LayerSimilarityChart组件（层间相似度）
11. ✅ HeadSimilarityChart组件（头间相似度）

### 低优先级（增强功能）
12. ⭕ Patch相似度图
13. ⭕ 高级统计图
14. ⭕ Wasserstein距离图
15. ⭕ 3D图表

---

## 4. Mock数据结构

### 4.1 tree_stats.json
```json
{
  "meta": {
    "num_layers": 12,
    "num_heads": 8,
    "num_patches": 64
  },
  "layers": [
    {
      "layer_id": 0,
      "entropy": 2.34,
      "heads": [
        {
          "head_id": 0,
          "entropy": 2.12,
          "max_attn": 0.89,
          "patches": [
            {
              "patch_id": 0,
              "entropy": 1.98,
              "max_attn": 0.76
            }
          ]
        }
      ]
    }
  ]
}
```

### 4.2 heatmap数据
```
mock/heatmap/layer_0_head_0_patch_0.json
```
```json
{
  "data": [[0.1, 0.2, ...], [0.3, 0.4, ...], ...],
  "shape": [8, 8]
}
```

### 4.3 analysis数据
```
mock/analysis/kl_locality.json
mock/analysis/funnel.json
mock/analysis/degrade_bar.json
mock/analysis/layer_similarity.json
mock/analysis/head_similarity.json
```

---

## 5. 验收标准

### 5.1 功能验收
- [ ] 图像上传功能正常
- [ ] 树形结构展示正确
- [ ] 热力图渲染正确
- [ ] 所有图表渲染正确
- [ ] 数据从mock正确读取

### 5.2 UI验收
- [ ] 暗色主题正确应用
- [ ] 布局符合设计
- [ ] 动画效果流畅
- [ ] 响应式适配正常

### 5.3 性能验收
- [ ] 首屏加载 < 3s
- [ ] 图表渲染流畅
- [ ] 无内存泄漏

### 5.4 代码质量
- [ ] ESLint检查通过
- [ ] TypeScript无错误
- [ ] 代码符合规范

---

## 6. 风险与应对

### 6.1 技术风险
| 风险 | 影响 | 应对措施 |
|------|------|----------|
| AntV G2学习曲线 | 中 | 先实现简单图表，逐步优化 |
| 暗色主题适配 | 低 | 参考Ant Design暗色主题文档 |
| 性能问题 | 中 | 使用代码分割、懒加载 |
| Mock数据格式 | 低 | 与协作者沟通确认格式 |

### 6.2 协作风险
| 风险 | 影响 | 应对措施 |
|------|------|----------|
| Mock数据未就绪 | 高 | 先用假数据开发，后续替换 |
| 需求变更 | 中 | 保持组件灵活性，易于修改 |
| 时间压力 | 中 | 优先核心功能，次要功能可延后 |

---

## 7. 时间估算

| Phase | 工作量 | 时间 |
|-------|--------|------|
| Phase 1：环境准备 | 低 | 1天 |
| Phase 2：基础组件 | 中 | 2-3天 |
| Phase 3：核心功能 | 高 | 3-4天 |
| Phase 4：图表组件 | 高 | 4-5天 |
| Phase 5：页面组装 | 中 | 2天 |
| Phase 6：优化完善 | 中 | 2-3天 |
| **总计** | - | **14-18天** |

---

## 8. 下一步行动

### 立即执行（Mock数据就绪后）
1. 安装所需依赖
2. 配置Ant Design主题
3. 创建基础Layout组件
4. 实现图像上传功能

### 待Mock数据就绪
- 与协作者确认Mock数据格式
- 实现Mock数据读取服务
- 测试数据流

### 后续优化
- 性能优化
- 可访问性优化
- 文档完善
