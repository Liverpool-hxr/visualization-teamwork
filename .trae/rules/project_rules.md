# Project Rules for Data Visualization Teamwork

## 项目背景
本项目为数据可视化小组作业，协作者非工程背景。前端开发在`web`文件夹内进行，使用React + TypeScript技术栈。

---

## 🔒 数据来源约束（最高优先级）

### 规则1：唯一数据源
**所有数据必须从根目录的`mock`文件夹获取。**

- ✅ **允许**：从`../mock/`或`../../mock/`读取数据文件
- ❌ **禁止**：从其他任何位置读取或修改数据
- ❌ **禁止**：在web文件夹内创建mock数据

### 规则2：文件操作边界
**禁止修改web文件夹外的任何文件。**

允许操作的文件范围：
- ✅ `web/` 文件夹内的所有文件
- ✅ 从 `mock/` 文件夹读取数据

禁止操作的文件：
- ❌ 根目录下的所有Python文件（`*.py`）
- ❌ 根目录下的所有图片文件（`*.png`, `*.jpg`等）
- ❌ 根目录下的配置文件
- ❌ `static/` 文件夹
- ❌ `log/` 文件夹
- ❌ `.idea/` 文件夹
- ❌ 任何其他根目录文件或文件夹

**当需要修改web外的文件时，应拒绝操作并提示：**
> "禁止修改web文件夹外的文件。数据来源仅限mock文件夹，其他文件属于协作者的工作区域。"

---

## 🛠️ Web工程标准

### 技术栈规范
本项目使用以下技术栈，请严格遵循：

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | React 18+ | 使用函数式组件 + Hooks |
| 语言 | TypeScript | 严格类型检查，禁止使用`any` |
| UI库 | Ant Design | 统一使用Ant Design组件 |
| 可视化 | AntV | G2（图表）、G6（图关系）、X6（流程图） |
| 构建工具 | Vite | 已配置，无需修改 |
| 包管理 | npm | 禁止使用yarn或pnpm |
| 代码检查 | ESLint | 提交前必须通过检查 |

### 代码风格规范

#### 组件规范
```typescript
// ✅ 正确：函数式组件 + TypeScript
import React from 'react';

interface ComponentProps {
  title: string;
  data: number[];
}

export const MyComponent: React.FC<ComponentProps> = ({ title, data }) => {
  return (
    <div>
      {/* 组件内容 */}
    </div>
  );
};

// ❌ 错误：使用class组件
class MyComponent extends React.Component {}
```

#### 样式规范
- 优先使用 **CSS Modules**（`*.module.css`）
- 或使用 **styled-components**
- 禁止内联样式（除动态样式外）

#### 命名规范
- 组件文件：`PascalCase.tsx`（如 `DataChart.tsx`）
- 工具函数：`camelCase.ts`（如 `formatData.ts`）
- 样式文件：`componentName.module.css`（如 `DataChart.module.css`）
- 常量：`UPPER_SNAKE_CASE`（如 `API_BASE_URL`）

### 目录结构规范
```
web/
├── src/
│   ├── components/     # 可复用组件
│   │   ├── common/     # 通用组件
│   │   └── charts/     # 图表组件
│   ├── pages/          # 页面组件
│   ├── hooks/          # 自定义Hooks
│   ├── utils/          # 工具函数
│   ├── services/       # API服务
│   ├── types/          # TypeScript类型定义
│   ├── assets/         # 静态资源
│   └── styles/         # 全局样式
├── public/             # 公共资源
└── package.json
```

---

## 📊 可视化开发规范

### AntV使用指南

#### G2图表开发
```typescript
import { Chart } from '@antv/g2';

// 数据格式要求
const data = [
  { category: 'A', value: 100 },
  { category: 'B', value: 200 },
];

// 图表配置
const chart = new Chart({
  container: 'chart-container',
  autoFit: true,
});

chart.data(data);
chart.interval().position('category*value');
chart.render();
```

#### 数据处理规范
- 所有图表数据必须从`mock`文件夹读取
- 数据格式转换在`utils/`中处理
- 使用TypeScript定义数据类型

---

## 🤝 协作边界

### 前端开发边界
**前端开发仅关注web文件夹内的内容，不干预其他协作者的工作。**

| 前端负责 | 其他协作者负责 |
|---------|--------------|
| web/ 文件夹 | Python模型文件 |
| React组件开发 | 数据处理脚本 |
| 可视化实现 | 训练日志 |
| UI/UX设计 | 其他根目录文件 |

### 沟通协作
- 需要修改数据格式时，与协作者沟通，由协作者调整mock数据
- 发现数据问题时，在mock文件夹查看原始数据，不直接修改
- 保持web文件夹的独立性，确保其他协作者可以独立工作

---

## ⚠️ 重要提醒

### 在执行任何操作前，请检查：
1. ✅ 是否在操作`web/`文件夹内的文件？
2. ✅ 数据是否从`mock/`文件夹读取？
3. ✅ 是否遵循React + TypeScript规范？
4. ✅ 是否使用Ant Design + AntV技术栈？

### 如果违反以上规则：
- 立即停止操作
- 提示用户规则约束
- 提供正确的操作方式

---

## 📝 开发工作流

### 1. 理解需求
- 分析static文件夹已完成的功能
- 使用brainstorming skill思考可视化方案
- 使用ui-ux-pro-max skill优化UI设计

### 2. 开发实施
- 在web/src/下创建组件
- 从mock/读取数据
- 使用AntV实现可视化
- 使用Ant Design美化UI

### 3. 代码质量
- 运行 `npm run lint` 检查代码
- 确保TypeScript无类型错误
- 测试可视化功能

### 4. 提交前检查
- [ ] 代码通过ESLint检查
- [ ] 无TypeScript类型错误
- [ ] 仅修改web/文件夹内的文件
- [ ] 数据来源为mock/文件夹
- [ ] 使用Ant Design + AntV技术栈

---

## 🎨 UI/UX设计规范（ui-ux-pro-max）

### 使用原则

#### 何时使用ui-ux-pro-max
| 场景 | 是否使用 | 原因 |
|------|---------|------|
| 新项目设计系统创建 | ✅ 必须 | 获得专业、一致的设计基础 |
| Landing Page设计 | ✅ 必须 | 提供转化优化的页面结构 |
| 复杂UI组件设计 | ✅ 推荐 | 获得最佳实践和反模式提醒 |
| 简单组件修改 | ⭕ 可选 | 可直接使用Ant Design组件 |
| 已有设计规范的项目 | ⭕ 可选 | 遵循现有设计系统 |

#### 工作流程
```bash
# Step 1: 生成设计系统（项目初期）
python3 .trae/skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system --persist -p "Project Name"

# Step 2: 补充详细查询（按需）
python3 .trae/skills/ui-ux-pro-max/scripts/search.py "animation accessibility" --domain ux
python3 .trae/skills/ui-ux-pro-max/scripts/search.py "dashboard chart" --domain chart

# Step 3: 技术栈指南
python3 .trae/skills/ui-ux-pro-max/scripts/search.py "layout responsive" --stack react
```

### 设计系统持久化

#### Master + Overrides模式
```
design-system/
├── MASTER.md           # 全局设计规范（Source of Truth）
└── pages/
    ├── dashboard.md    # Dashboard页面特定规则（覆盖Master）
    ├── heatmap.md      # 热力图页面特定规则
    └── analysis.md     # 分析图表页面特定规则
```

#### 使用规则
1. **构建页面时**：先检查 `design-system/pages/<page>.md`
2. **页面文件存在**：使用页面规则（覆盖Master）
3. **页面文件不存在**：使用 `design-system/MASTER.md`
4. **冲突时**：页面规则优先级 > Master规则

### 专业UI质量标准

#### 图标与视觉元素
| 规则 | ✅ 正确 | ❌ 错误 |
|------|---------|---------|
| 图标使用 | SVG图标（Heroicons/Lucide） | Emoji作为UI图标 |
| Hover效果 | 颜色/透明度过渡 | Scale变换导致布局偏移 |
| 品牌Logo | 官方SVG（Simple Icons） | 猜测或错误路径 |
| 图标尺寸 | 固定viewBox (24x24) | 随机混合尺寸 |

#### 交互与光标
| 规则 | ✅ 正确 | ❌ 错误 |
|------|---------|---------|
| 可点击元素 | `cursor-pointer` | 默认光标 |
| Hover反馈 | 颜色/阴影/边框变化 | 无反馈 |
| 过渡动画 | 150-300ms | 瞬时或>500ms |

#### 暗色主题对比度
| 规则 | ✅ 正确 | ❌ 错误 |
|------|---------|---------|
| 文本对比度 | 至少4.5:1 | 对比度不足 |
| 玻璃效果 | `bg-white/80` 或更高 | `bg-white/10`（太透明） |
| 边框可见性 | `border-gray-200` | `border-white/10`（不可见） |

#### 布局与间距
| 规则 | ✅ 正确 | ❌ 错误 |
|------|---------|---------|
| 浮动导航栏 | `top-4 left-4 right-4` | `top-0 left-0 right-0` |
| 内容填充 | 考虑固定导航栏高度 | 内容被遮挡 |
| 最大宽度 | 统一 `max-w-6xl` | 混合不同宽度 |

### 预交付检查清单

#### 视觉质量
- [ ] 无Emoji作为图标（使用SVG）
- [ ] 图标来自统一图标集（Heroicons/Lucide）
- [ ] 品牌Logo正确（已验证）
- [ ] Hover状态不导致布局偏移
- [ ] 使用主题色（bg-primary）而非var()包装

#### 交互
- [ ] 所有可点击元素有 `cursor-pointer`
- [ ] Hover状态提供清晰视觉反馈
- [ ] 过渡动画流畅（150-300ms）
- [ ] 焦点状态对键盘导航可见

#### 暗色主题
- [ ] 文本对比度足够（4.5:1最小）
- [ ] 玻璃/透明元素在暗色模式可见
- [ ] 边框在暗色模式可见
- [ ] 测试暗色模式

#### 布局
- [ ] 浮动元素与边缘有适当间距
- [ ] 无内容被固定导航栏遮挡
- [ ] 响应式：375px, 768px, 1024px, 1440px
- [ ] 移动端无横向滚动

#### 可访问性
- [ ] 所有图片有alt文本
- [ ] 表单输入有标签
- [ ] 颜色不是唯一指示器
- [ ] 遵守 `prefers-reduced-motion`

### 与Ant Design集成

#### 主题配置
```typescript
// 基于ui-ux-pro-max设计系统配置Ant Design主题
import type { ThemeConfig } from 'antd';

export const theme: ThemeConfig = {
  token: {
    // 从ui-ux-pro-max设计系统获取的颜色
    colorPrimary: '#00d4aa',
    colorBgBase: '#0d1117',
    colorTextBase: '#e8edf5',
    
    // 从ui-ux-pro-max设计系统获取的字体
    fontFamily: "'Fira Sans', sans-serif",
  },
};
```

#### 组件选择
- **优先**：使用Ant Design组件（已遵循可访问性标准）
- **自定义**：遵循ui-ux-pro-max质量标准
- **图标**：使用 `@ant-design/icons`（Lucide风格）

### 与brainstorming配合

#### 推荐工作流
```
1. brainstorming skill
   ↓ 探索需求、明确目标
   
2. ui-ux-pro-max skill
   ↓ 生成设计系统
   
3. Ant Design实现
   ↓ 组件开发
   
4. 验证检查清单
```

#### 示例
```bash
# Step 1: brainstorming探索需求
# （通过对话明确：数据可视化、暗色主题、专业风格）

# Step 2: ui-ux-pro-max生成设计系统
python3 .trae/skills/ui-ux-pro-max/scripts/search.py "dashboard data visualization AI ML dark mode professional" --design-system --persist -p "MultiVIT SR"

# Step 3: 查询UX最佳实践
python3 .trae/skills/ui-ux-pro-max/scripts/search.py "animation accessibility z-index" --domain ux

# Step 4: 查询React最佳实践
python3 .trae/skills/ui-ux-pro-max/scripts/search.py "performance memo" --stack react
```
