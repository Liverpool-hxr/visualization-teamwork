# MultiVIT SR — Attention Inspector

> 基于 Vision Transformer 的图像超分辨率系统，内置注意力分布可视化与统计分析前端。

---

## 快速开始

整个项目分为 **后端（Python Flask）** 和 **前端（React）** 两部分，需要分别启动。

### 1. 环境要求

| 组件 | 要求 |
|---|---|
| Python | 3.9+ |
| Node.js | 18.x / 20.x LTS |
| npm | 9.x+ |

### 2. 安装 Python 依赖

```bash
# Windows
pip install torch torchvision matplotlib pillow opencv-python flask scipy scikit-learn numpy
```

> 有 CUDA 环境的可用 `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121`。
> 模型代码依赖同目录下的 `backend/HMHT.py`，请确保该文件存在。

### 3. 放置预训练权重

将权重文件放置于 `backend/` 目录下（如 `sr_epoch_80.pth`），并在 `backend/MultiVITSR.py` 中指定正确的权重路径。

### 4. 启动后端服务

```bash
python backend/visualization.py
```

后端默认监听 `http://localhost:8080`。

### 5. 安装前端依赖 & 启动前端

```bash
cd web
npm install
npm run dev
```

前端开发服务器运行在 `http://localhost:5173`，并已配置代理将 `/run`、`/tree_stats`、`/visualize`、`/analysis/*` 请求转发到后端 `http://localhost:8080`。

> 打开浏览器访问 `http://localhost:5173` 即可使用。

---

## 系统架构

```
┌──────────────────────┐     HTTP / FormData     ┌──────────────────────┐
│  web/ (React 前端)    │ ◄─────────────────────► │  backend/ (Flask)     │
│  Vite + TypeScript   │   :5173  ──代理──► :8080 │  visualization.py     │
│                      │                         │  MultiVITSR.py        │
│  Heatmap / Analysis  │                         │  VIT.py               │
│  / Overview 三路由    │                         │  attn_list.npy        │
└──────────────────────┘                         └──────────────────────┘
```

### 前端路由

| 路由 | 页面 | 说明 |
|---|---|---|
| `/heatmap` | Attention Heatmap | 注意力热力图 + 头间相似度热力图 |
| `/analysis` | Analysis Charts | KL 散度 / 有效秩漏斗 / 3D 退化指标 |
| `/overview` | Model Overview | 模型配置、运行时统计、API 路由速查 |

---

## 项目结构

```
ViT/
├── backend/                 # Python 后端
│   ├── visualization.py     # Flask 服务入口（启动这个）
│   ├── MultiVITSR.py        # 模型定义 + 单图推理
│   ├── VIT.py               # ViT 基础模块
│   ├── SR-train.py          # 训练脚本
│   ├── HMHT.py              # LEPE1D 局部位置编码
│   ├── attn_list.npy        # 推理后生成的注意力数据
│   └── sr_result.pt         # 推理后生成的超分结果
├── web/                     # React 前端
│   ├── src/
│   │   ├── components/      # 可复用组件
│   │   │   ├── shell/       # Layout / TopBar / Sidebar 外壳
│   │   │   ├── tree/        # AttentionTree 注意力树
│   │   │   └── common/      # PageTransition 等通用组件
│   │   ├── pages/           # 三个路由页面
│   │   │   ├── Heatmap/     # 热力图页
│   │   │   ├── Analysis/    # 分析图表页
│   │   │   └── Overview/    # 模型概览页
│   │   ├── store/           # 全局状态管理 (InspectorProvider)
│   │   ├── services/        # API 调用封装
│   │   ├── hooks/           # 自定义 Hooks
│   │   └── types/           # TypeScript 类型定义
│   ├── vite.config.ts       # Vite 配置（含开发代理）
│   └── package.json
├── static/
│   └── index.html           # 原始单页 HTML（模板/参考，不再使用）
├── mock/                    # Mock 数据（开发参考，不再使用）
└── README.md
```

---

## API 接口文档

后端 `visualization.py` 暴露以下接口，基础地址为 `http://localhost:8080`。

### `POST /run`

上传图像并执行超分推理。

- **Content-Type:** `multipart/form-data`
- **字段:** `image`（文件，PNG / JPG / BMP）

**成功响应 `200`**
```json
{ "message": "run completed" }
```

---

### `GET /visualize`

返回指定层、头、Patch 的注意力热力图（PNG）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `layer_id` | int | 是 | Transformer 层索引 |
| `head_id` | int | 是 | 注意力头索引 |
| `patch_id` | int | 是 | Patch 索引 |

**成功响应 `200`** — `Content-Type: image/png`

---

### `GET /tree_stats`

返回注意力树所需的层级统计数据。

```json
{
  "meta": { "num_layers": 10, "num_heads": 8, "num_patches": 256 },
  "layers": [
    {
      "layer_id": 0,
      "entropy": 3.14,
      "max_attn": 0.05,
      "heads": [
        {
          "head_id": 0,
          "entropy": 3.02,
          "patches": [
            { "patch_id": 0, "entropy": 2.1, "max_attn": 0.03 }
          ]
        }
      ]
    }
  ]
}
```

---

### `GET /analysis/kl_locality`

各层、各头相对于均匀分布的 KL 散度及局部性得分。

---

### `GET /analysis/funnel`

各层有效秩与主导奇异值能量（用于柱状图）。

---

### `GET /analysis/3d_bar`

各层退化指标的相对值（用于极坐标柱状图）。

---

## 仅运行单图推理（无需服务器）

```bash
python backend/MultiVITSR.py path/to/your/image.png
```

输出文件（在 `backend/` 下）：
- `output.png` — 超分结果图像
- `attn_list.npy` — 所有层的原始注意力图

---

## 模型训练

```bash
python backend/SR-train.py
```

修改 `SR-train.py` 中的数据路径指向你的数据集。每 5 个 epoch 自动保存检查点，训练结束输出 PSNR/SSIM 曲线图。
