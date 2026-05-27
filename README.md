# MultiVIT SR — 注意力可视化工具

> 基于 Vision Transformer 的图像超分辨率系统，内置注意力分布可视化与统计分析前端。

---

## 🚀 快速开始

### 前端开发环境配置

如果只需要开发或运行前端界面（Attention Inspector 可视化界面）：

#### 环境要求
- **Node.js**: v18.x 或 v20.x LTS（推荐使用 [nvm](https://github.com/nvm-sh/nvm) 管理 Node.js 版本）
- **npm**: v9.x 或 v10.x（随 Node.js 自动安装）

#### 安装步骤

**1. 使用 nvm 安装 Node.js（推荐）**

```bash
# Windows 用户推荐使用 nvm-windows
# 下载安装：https://github.com/coreybutler/nvm-windows/releases

nvm install 20
nvm use 20
```

**2. 验证 Node.js 和 npm**

```bash
node --version    # 应显示 v18.x.x 或 v20.x.x
npm --version     # 应显示 9.x.x 或 10.x.x
```

**3. 进入前端目录并安装依赖**

```bash
cd web
npm install
```

**4. 启动开发服务器**

```bash
npm run dev
```

前端界面将在 `http://localhost:5173` 运行。

> ⚠️ **注意**：前端需要与后端服务配合使用，请先启动 Python 后端服务（参见下方 [启动后端服务](#启动后端服务)）。

#### 前端详细文档

前端开发的详细说明、技术栈、组件规范、API 集成等请参阅：[web/README.md](web/README.md)

---

## 目录

- [项目简介](#项目简介)
- [系统架构](#系统架构)
- [环境配置](#环境配置)
- [启动后端服务](#启动后端服务)
- [前端说明](#前端说明)
- [API 接口文档](#api-接口文档)
- [模型训练](#模型训练)
- [文件结构](#文件结构)

---

## 项目简介

**MultiVIT SR** 是一个基于 Vision Transformer（ViT）的图像超分辨率模型。输入一张低分辨率（LR）图像，模型输出指定放大倍数（默认 ×4）的高分辨率（HR）图像。

项目内置 **Attention Inspector** 可视化前端（`index.html`），通过与 Python 后端服务通信，提供以下功能：

- 上传图像并触发超分推理
- 以空间热力图形式展示每一层、每个注意力头的注意力分布
- 通过 层 → 头 → Patch 的层级树结构浏览注意力权重（颜色编码行熵/重要性）
- 按需加载多种统计分析图表（KL 散度、有效秩、Wasserstein 距离、余弦相似度矩阵等）

---

## 系统架构

```
index.html  （前端单页应用）
     │  HTTP / FormData
     ▼
Python 后端服务  （Flask / FastAPI，需自行实现）
     │
     ├── MultiVITSR.py   — SimpleViTSR 模型定义与推理入口
     ├── VIT.py          — PatchEmbedding、MyTransformerEncoder、MyTransformer
     └── sr_epoch_80.pth — 预训练权重（不含于仓库，需单独获取）
```

**默认推理配置：**

| 参数 | 值 |
|---|---|
| 输入分辨率（LR） | 64 × 64 |
| 放大倍数 | ×4 |
| Patch 尺寸 | 4 |
| Embedding 维度 | 96 |
| Transformer 层数 | 10 |
| 注意力头数 | 8 |
| 窗口大小 | 8 |
| 输出分辨率（SR） | 256 × 256 |

---

## 环境配置

### 前置要求

- Python 3.9 及以上
- pip

### 第一步：克隆仓库

```bash
git clone https://github.com/your-org/multivit-sr.git
cd multivit-sr
```

### 第二步：创建虚拟环境

```bash
python -m venv .venv
source .venv/bin/activate      # Linux / macOS
.venv\Scripts\activate         # Windows
```

### 第三步：安装依赖

```bash
# 有 CUDA 12.1 的环境
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# 仅 CPU 环境
# pip install torch torchvision

pip install einops torchmetrics matplotlib pillow opencv-python flask
```

> **注意：** 模型代码中引用了本地模块 `HMHT.py`（提供 `LEPE1D` 局部位置编码），请确保该文件存在于项目根目录，否则无法正常导入。

### 第四步：放置预训练权重

将权重文件放置于项目根目录：

```
multivit-sr/
└── sr_epoch_80.pth
```

权重文件请联系项目维护者或训练团队获取。

---

## 启动后端服务

前端通过 HTTP 与本地后端通信。你需要实现（或启动）一个暴露了 [API 接口文档](#api-接口文档) 中所有路由的服务器。以 Flask 为例：

```bash
python server.py          # 默认监听 http://localhost:5000
```

随后在浏览器打开前端：

```bash
# 最简方案：将 index.html 放入 Flask 的 static 目录，由后端一同提供服务
open http://localhost:5000
```

> 若前端与后端运行在不同端口，需在后端配置 CORS 响应头，或使用开发代理转发请求。

### 仅运行单图推理（无需服务器）

如只需对单张图片运行超分，可直接执行：

```bash
python MultiVITSR.py path/to/your/image.png
```

输出文件：

| 文件名 | 说明 |
|---|---|
| `output.png` | 超分结果图像 |
| `sr_result.pt` | 超分结果张量（PyTorch 格式） |
| `attn_list.npy` | 所有层的原始注意力图（NumPy 格式） |

---

## 前端说明

`index.html` 是一个**无需构建、无需 npm**的纯原生 JavaScript 单页应用，仅依赖两个外部 CDN 资源：

- **ECharts 5.5.0** — 所有分析图表的渲染引擎
- **IBM Plex Mono / IBM Plex Sans JP** — 字体（Google Fonts）

### 界面布局

**顶部导航栏** — 面板切换 Tab 与实时状态标签（`待机` / `运行中` / `就绪` / `错误`）。

**左侧边栏** — 图像上传区（点击或拖拽）、RUN MODEL 按钮、熵值颜色图例，以及可折叠的层 → 头 → Patch 注意力树。

**主内容区** — 三个可切换面板：

| Tab 标签 | 面板 ID | 说明 |
|---|---|---|
| 热力图 | `panelHeatmap` | 展示所选层/头/Patch 的注意力热力图图像 |
| 分析图表 | `panelAnalysis` | 按需加载的 ECharts 图表卡片 |
| 模型概览 | `panelInfo` | 模型元数据统计卡片与 API 路由速查表 |

**日志栏** — 侧边栏底部的带时间戳控制台，实时显示所有客户端操作事件。

### 用户操作流程

```
1. 上传图像（文件选择框或拖拽）
       │
       ▼
2. 点击 ▶ RUN MODEL
   → POST /run（multipart/form-data）
       │
       ▼
3. 推理完成后自动请求 GET /tree_stats
   → 渲染左侧注意力树
       │
       ▼
4. 点击树中某个 Patch 格子
   → GET /visualize?layer_id=&head_id=&patch_id=
   → 主区域显示热力图
       │
       ▼
5. 切换至「分析图表」Tab，点击任意分析按钮
   → GET /analysis/*
   → 渲染对应 ECharts 图表
```

### 扩展新图表

`chartHandlers` 对象是所有分析图表的注册表，新增图表只需两步：

**第一步：** 在 `<script>` 中注册：

```javascript
const chartHandlers = {
  // 现有条目 …
  myChart: {
    label: '我的图表',
    dot: '#00d4aa',                      // 色点颜色
    render: myRenderFunction,            // function(data, domContainer)
    route: '/analysis/my_endpoint'       // 后端接口路径
  }
};
```

**第二步：** 在 `#anaHeader` 内添加按钮：

```html
<button class="ana-btn" data-key="myChart" onclick="loadAna(this)">我的图表</button>
```

### 前端关键实现说明

| 概念 | 说明 |
|---|---|
| `anaCache` | 内存缓存对象，同一会话内避免重复请求 |
| `renderChart(container, option)` | ECharts 统一封装，负责实例创建与自适应大小 |
| `setStatus(cls, txt)` | 更新顶栏状态标签，`cls` 可为 `''` / `'busy'` / `'ready'` / `'error'` |
| `log(msg, type)` | 向底部日志栏追加一条记录，`type` 可为 `'ok'` / `'err'` / `'warn'` |
| 服务器 Base URL | 隐式使用同源，无需配置，开发时如跨端口须自行代理 |

---

## API 接口文档

所有接口均相对于服务器根地址（如 `http://localhost:5000`），响应格式均为 `application/json`（`/visualize` 除外）。

---

### `POST /run`

上传图像并执行超分推理。推理结果存储于服务器内存，供后续 `GET` 接口使用。

**请求**

```
Content-Type: multipart/form-data
字段名:  image  （文件，支持 PNG / JPG / BMP）
```

**成功响应 `200`**

```json
{
  "status": "ok",
  "message": "Inference complete"
}
```

**失败响应 `4xx / 5xx`**

```json
{
  "message": "错误描述"
}
```

---

### `GET /visualize`

返回指定层、头、Patch 的注意力热力图，叠加在 LR 输入图像上。

**查询参数**

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `layer_id` | integer | 是 | Transformer 层索引（从 0 开始） |
| `head_id` | integer | 是 | 注意力头索引（从 0 开始） |
| `patch_id` | integer | 是 | 展平序列中的 Patch 索引（从 0 开始） |

**成功响应 `200`**

```
Content-Type: image/png
Body: PNG 二进制数据
```

---

### `GET /tree_stats`

返回注意力树所需的层级统计数据。

**成功响应 `200`**

```json
{
  "meta": {
    "num_layers": 10,
    "num_heads": 8,
    "num_patches": 256
  },
  "layers": [
    {
      "layer": 0,
      "entropy_mean": 3.14,
      "heads": [
        {
          "head": 0,
          "entropy": 3.02,
          "patch_entropies": [2.1, 3.5, "..."]
        }
      ]
    }
  ]
}
```

---

### `GET /analysis/kl_locality`

各层、各头相对于均匀分布的 KL 散度及局部性得分。

**成功响应 `200`**

```json
{
  "layers": [
    {
      "layer": 0,
      "kl_mean": 0.45,
      "locality": 0.78,
      "heads": ["..."]
    }
  ]
}
```

---

### `GET /analysis/funnel`

各层有效秩与主导奇异值，用于漏斗图展示。

**成功响应 `200`**

```json
{
  "layers": [
    { "layer": 0, "eff_rank": 5.2, "dominant_sv": 12.4 }
  ]
}
```



### `GET /analysis/3d_bar`

各层退化指标的相对值，适用于极坐标柱状图（雷达图）展示。

**成功响应 `200`**

```json
{
  "layers": [
    { "layer": 0, "row_var_rel": 0.5, "sparsity_rel": 0.7, "gini_rel": 0.4 }
  ]
}
```





---

## 模型训练

如需从头训练模型：

**第一步：** 准备数据集，将 HR 图像分别放入训练集和评测集目录（例如 Flickr2K 和 Set5）。

**第二步：** 修改 `SR-train.py` 中的数据路径：

```python
train_hr_dir = r'/path/to/Flickr2K'   # 训练集 HR 图像目录
test_hr_dir  = r'/path/to/Set5'        # 测试集 HR 图像目录
```

**第三步：** 启动训练：

```bash
python SR-train.py
```

每 5 个 epoch 自动保存一次检查点（`sr_epoch_<N>.pth`）。训练结束后输出：

| 文件名 | 说明 |
|---|---|
| `sr_epoch_<N>.pth` | 各阶段检查点 |
| `sr_final.pth` | 最终权重 |
| `sr_train_metrics_hxr.csv` | 每轮 Loss / PSNR / SSIM 记录 |
| `sr_train_curves_hxr.png` | 训练曲线可视化图 |

**默认训练超参数：**

| 配置项 | 值 |
|---|---|
| LR Patch 尺寸 | 64 × 64 |
| 放大倍数 | ×4 |
| Batch Size | 4 |
| 优化器 | Adam（β₁=0.9，β₂=0.99） |
| 初始学习率 | 2 × 10⁻⁴ |
| 学习率调度 | MultiStepLR（在总步数 50%/80%/90%/95% 处各乘以 0.5） |
| 损失函数 | L1 Loss |
| 训练轮数 | 80 |

---

## 文件结构

```
multivit-sr/
├── index.html          # 前端单页应用（Attention Inspector）
├── MultiVITSR.py       # 模型定义 + 独立推理脚本
├── VIT.py              # ViT 基础模块（PatchEmbedding、Transformer 层）
├── SR-train.py         # 训练流程
├── sr_epoch_80.pth     # 预训练权重 — 推理必需（不含于仓库）
└── README_zh.md
```