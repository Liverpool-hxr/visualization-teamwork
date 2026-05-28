# React迁移计划 - 任务清单

## 📋 任务总览

根据 [migration-plan.md](file:///e:/visualization-teamwork/web/docs/migration-plan.md) 和 [visualization-design.md](file:///e:/visualization-teamwork/web/docs/visualization-design.md)，本项目分为6个阶段，共包含 **25+** 个核心任务。

---

## Phase 1：环境准备（1天）

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| P1-01 | 安装依赖：antd, @ant-design/icons, @antv/g2, @antv/g2plot, react-router-dom | ⏳ pending | 高 | - |
| P1-02 | 安装工具库：dayjs, lodash | ⏳ pending | P1-01 |
| P1-03 | 创建主题配置 src/styles/theme.ts | ⏳ pending | P1-01 |
| P1-04 | 创建全局样式 src/styles/global.css | ⏳ pending | P1-03 |
| P1-05 | 创建路由配置 src/router/index.tsx | ⏳ pending | P1-01 |
| P1-06 | 配置路径别名 vite.config.ts | ⏳ pending | - |

---

## Phase 2：基础组件（2-3天）

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| P2-01 | 创建 Layout 组件 src/components/common/Layout/ | ⏳ pending | 高 | P1-03, P1-04 |
| P2-02 | 创建 TopBar 组件 src/components/common/TopBar/ | ⏳ pending | 高 | P2-01 |
| P2-03 | 创建 Sidebar 组件 src/components/common/Sidebar/ | ⏳ pending | 高 | P2-01 |
| P2-04 | 创建 Loading 组件 src/components/common/Loading/ | ⏳ pending | 中 | - |
| P2-05 | 创建 Modal 组件 src/components/common/Modal/ | ⏳ pending | 中 | - |

---

## Phase 3：核心功能（3-4天）

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| P3-01 | 创建类型定义 src/types/attention.ts | ✅ completed | 高 | - |
| P3-02 | 创建类型定义 src/types/chart.ts | ✅ completed | 高 | - |
| P3-03 | 创建 Mock 服务 src/services/mockService.ts | ✅ completed | 高 | P3-01, P3-02 |
| P3-04 | 创建 useMockData Hook src/hooks/useMockData.ts | ✅ completed | 高 | P3-03 |
| P3-05 | 创建 ImageUpload 组件 src/components/upload/ImageUpload/ | ✅ completed | 高 | P2-03, P3-04 |
| P3-06 | 创建 AttentionTree 组件 src/components/tree/AttentionTree/ | ✅ completed | 高 | P2-03, P3-04 |
| P3-07 | 创建 TreeNode 组件 src/components/tree/AttentionTree/TreeNode.tsx | ✅ completed | 高 | P3-06 |
| P3-08 | 创建 PatchGrid 组件 src/components/tree/AttentionTree/PatchGrid.tsx | ✅ completed | 高 | P3-06 |
| P3-09 | 创建 HeatmapChart 组件 src/components/charts/HeatmapChart/ | ✅ completed | 高 | P3-04 |

---

## Phase 4：图表组件（4-5天）

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| P4-01 | 创建 KLLocalityChart 组件 src/components/charts/KLLocalityChart/ | ⏳ pending | 高 | P3-04 |
| P4-02 | 创建 FunnelChart 组件 src/components/charts/FunnelChart/ | ⏳ pending | 高 | P3-04 |
| P4-03 | 创建 DegradeChart 组件 src/components/charts/DegradeChart/ | ⏳ pending | 高 | P3-04 |
| P4-04 | 创建 LayerSimilarityChart 组件 src/components/charts/LayerSimilarityChart/ | ⏳ pending | 高 | P3-04 |
| P4-05 | 创建 HeadSimilarityChart 组件 src/components/charts/HeadSimilarityChart/ | ⏳ pending | 高 | P3-04 |
| P4-06 | 创建 PatchSimilarityChart 组件 src/components/charts/PatchSimilarityChart/ | ⏳ pending | 中 | P4-04 |
| P4-07 | 创建 AdvancedStatsChart 组件 src/components/charts/AdvancedStatsChart/ | ⏳ pending | 中 | P3-04 |
| P4-08 | 创建 WassersteinChart 组件 src/components/charts/WassersteinChart/ | ⏳ pending | 低 | P3-04 |

---

## Phase 5：页面组装（2天）

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| P5-01 | 创建 Heatmap 页面 src/pages/Heatmap/ | ⏳ pending | 高 | P3-05, P3-06, P3-09 |
| P5-02 | 创建 Analysis 页面 src/pages/Analysis/ | ⏳ pending | 高 | P4-01 ~ P4-05 |
| P5-03 | 创建 Overview 页面 src/pages/Overview/ | ⏳ pending | 中 | P2-01 |
| P5-04 | 更新 App.tsx 集成路由 | ⏳ pending | P1-05, P5-01 ~ P5-03 |
| P5-05 | 更新 main.tsx 配置主题 | ⏳ pending | P1-03, P5-04 |

---

## Phase 6：优化完善（2-3天）

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| P6-01 | 添加页面切换动画 | ⏳ pending | 中 | P5-01 ~ P5-03 |
| P6-02 | 添加树节点展开动画 | ⏳ pending | 中 | P3-06 |
| P6-03 | 添加图表加载动画 | ⏳ pending | 中 | P3-09, P4-01 ~ P4-05 |
| P6-04 | 实现键盘导航功能 | ⏳ pending | 中 | P3-06 |
| P6-05 | 添加响应式适配 | ⏳ pending | 中 | 所有组件 |
| P6-06 | 代码分割与懒加载 | ⏳ pending | 高 | P5-01 ~ P5-03 |
| P6-07 | 性能优化：useMemo/useCallback | ⏳ pending | 中 | 所有组件 |
| P6-08 | 添加 ARIA 属性支持 | ⏳ pending | 低 | 所有组件 |
| P6-09 | ESLint 代码检查 | ⏳ pending | 高 | 所有代码 |
| P6-10 | TypeScript 类型检查 | ⏳ pending | 高 | 所有代码 |

---

## 🎯 优先级排序

### 高优先级（核心功能）
1. P1-01 ~ P1-06 - 环境准备
2. P2-01 ~ P2-03 - 基础布局组件
3. P3-01 ~ P3-09 - 核心功能组件
4. P4-01 ~ P4-05 - 主要图表组件
5. P5-01 ~ P5-05 - 页面组装
6. P6-06, P6-09, P6-10 - 性能优化与代码质量

### 中优先级（增强功能）
1. P2-04, P2-05 - 通用组件
2. P4-06, P4-07 - 次要图表
3. P6-01 ~ P6-05, P6-07 - 动画与交互优化

### 低优先级（可选功能）
1. P4-08 - Wasserstein距离图
2. P6-08 - ARIA可访问性

---

## 🔗 任务引用方式

后续开发时，可通过任务编号直接引用，例如：
- **任务**: `P1-01` - 安装依赖
- **任务**: `P3-09` - 创建 HeatmapChart 组件

---

## 📅 时间估算

| Phase | 工作量 | 时间 |
|-------|--------|------|
| Phase 1 | 低 | 1天 |
| Phase 2 | 中 | 2-3天 |
| Phase 3 | 高 | 3-4天 |
| Phase 4 | 高 | 4-5天 |
| Phase 5 | 中 | 2天 |
| Phase 6 | 中 | 2-3天 |
| **总计** | - | **14-18天** |

---

## ✅ 验收标准

### 功能验收
- [ ] 图像上传功能正常
- [ ] 树形结构展示正确
- [ ] 热力图渲染正确
- [ ] 所有图表渲染正确
- [ ] 数据从mock正确读取

### UI验收
- [ ] 暗色主题正确应用
- [ ] 布局符合设计
- [ ] 动画效果流畅
- [ ] 响应式适配正常

### 代码质量
- [x] ESLint检查通过
- [x] TypeScript无错误
- [x] 代码符合规范