# MultiVIT SR — 技术说明文档

> 本文档面向需要制作海报、PPT 或了解项目核心原理的成员。
> 无需阅读代码，即可理解模型架构、数据含义及所有可视化指标。

---

## 一、模型架构

### 1.1 整体流程

```
输入图像 (64×64)
    │
    ▼
Patch Embedding ── 切成 4×4 小块 (16×16 = 256 patches)
    │               每个 patch 映射为 96 维向量
    ▼
位置编码 ── 可学习的绝对位置编码 + LEPE（Local Enhancement Position Encoding）
    │
    ▼
┌──────────────────────────┐
│  Transformer Block × N   │  ← 核心，N = 10~12 层
│  ┌────────────────────┐  │
│  │ Multi-Head Attention│  │  ← 每层有 H = 6~12 个注意力头
│  │ (Window-based)     │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ MLP + Residual     │  │
│  └────────────────────┘  │
└──────────────────────────┘
    │
    ▼
上采样模块 ── PixelShuffle / 子像素卷积
    │
    ▼
输出图像 (256×256)  ← ×4 超分辨率
```

### 1.2 核心：Multi-Head Self-Attention

每个注意力头的计算过程：

```
给定输入 X ∈ R^{N×d}（N=256 个 patch，d=96 维）

Q = X · W_Q     (Query:  我要查什么)
K = X · W_K     (Key:    我能提供什么)
V = X · W_V     (Value:  我实际传送什么内容)

Attention Matrix:   A = softmax(QK^T / √d)   ∈ R^{N×N}
Output:              O = A · V

每个 A[i][j] 表示 Patch i 对 Patch j 的关注权重（0~1，每行之和为 1）
```

**多头机制**：每个头学习不同的注意力模式——有的关注局部纹理，有的关注全局结构。

---

## 二、核心分析对象

整个分析系统的核心数据是 **注意力权重矩阵 `A ∈ R^{N×N}`**（N = 256 个 patch）。

模型推理后，这个矩阵会被保存为 `attn_list.npy`，包含**所有层 × 所有头**的注意力权重。

前端类型定义：
```typescript
Layer[]          // 所有层
  └── Head[]     // 每层的所有注意力头
       └── Patch[]  // 每个头的所有 patch 统计
```

---

## 三、可视化指标详解

以下所有指标均从注意力权重矩阵 `A = (a_{ij})` 计算得到，其中 `a_{ij}` 表示 patch `i` 关注 patch `j` 的权重。`N = 256` 为总 patch 数。

---

### 3.1 行熵（Row Entropy）

> **衡量每个 patch 的注意力是"集中"还是"分散"。**

**公式**（对第 i 行）：
```
H_i = -Σ_j p_{ij} · ln(p_{ij})
其中 p_{ij} = a_{ij} / (Σ_k a_{ik} + ε)
```

**含义**：
| 熵值 | 含义 |
|---|---|
| **低熵** (~2-3) | 注意力高度集中在少数几个 patch 上 → 该 head 在做"聚焦"式注意 |
| **高熵** (~5.0+) | 注意力均匀分布在所有 patch 上 → 该 head 在做"全局"式注意 |
| 理论最大值 | ln(256) ≈ 5.545 (完全均匀分布) |

**可视化映射**：前端热力图中，低熵 = 绿色（高重要性），高熵 = 红色（低重要性）。

---

### 3.2 KL 散度 vs 均匀分布

> **衡量每行注意力与完全均匀分布的差异程度。**

**公式**：
```
KL_i = Σ_j p_{ij} · ln(p_{ij} / q)
其中 q = 1/N = 1/256 (均匀分布概率)
KL = Σ_i KL_i / N
```

**含义**：
- KL 值越大 → 注意力 ≠ 均匀分布 → 该 head 有**明确的关注偏好**
- KL 值越小 → 注意力接近均匀 → 该 head 没有选择性，可能是**退化/冗余的**

---

### 3.3 局部性得分（Locality Score）

> **衡量注意力是否偏向空间上相邻的 patch。**

**公式**：
```
Locality = (1/N) · Σ_i Σ_{j ∈ Neighbor(i)} a_{ij}
其中 Neighbor(i) = {j | |row_i - row_j| ≤ 1 且 |col_i - col_j| ≤ 1}
```

**含义**：
- 高分 → 该 head 主要关注**邻近 patches**（局部特征提取器）
- 低分 → 该 head 主要关注**全局/远距离** patches
- 这是区分"局部注意力头"和"全局注意力头"的关键指标

---

### 3.4 有效秩（Effective Rank）

> **衡量注意力矩阵的"真实自由度"——有多少个有意义的独立模式。**

**方法**（sklearn-style Randomized SVD）：
```
1. 生成随机投影矩阵 Omega (N×k, k=12)
2. Y = A · Omega
3. QR 分解 → 正交基 Q (N×k)
4. B = Q^T · A  (k×N, 小矩阵)
5. 对 B·B^T (k×k) 做特征值分解 → 奇异值 s_i
6. 有效秩 = count(s_i > s_1 · ε) , ε=0.001
```

**含义**：
- 有效秩高 → 注意力矩阵包含丰富的独立信息模式
- 有效秩低 → 注意力矩阵退化，几个模式就足够描述了
- 深层通常有效秩更低（注意力模式趋于固定）

---

### 3.5 奇异能量比（Singular Energy Ratio）

> **最大奇异值占总能量的比例——矩阵的"集中度"。**

**公式**：
```
Energy Ratio = s_1 / (Σ_i s_i + ε)
```

**含义**：
- 接近 1 → 一个主导模式解释了几乎所有注意力
- 接近 0 → 注意力分散在多个等价模式上
- 该指标与有效秩互补：有效秩看"有几个模式"，能量比看"第一个模式有多强"

---

### 3.6 行方差（Row Variance）

> **衡量不同 patch 的注意力分布差异是否显著。**

**公式**：
```
RowVar = (1/N) · Σ_i Var(row_i)
其中 Var(row_i) = (1/N) · Σ_j (a_{ij} - mean(row_i))²
```

**含义**：
- 高方差 → 不同 patch 的注意力模式差异大，信息丰富
- 低方差 → 所有 patch 的注意力都很相似 → **可能退化**

---

### 3.7 稀疏度（Sparsity Ratio）

> **注意力矩阵中"显著值"的占比。**

**公式**：
```
mean = Σ_{i,j} a_{ij} / (N·N)
threshold = mean × 1.2
Sparsity = count(a_{ij} > threshold) / (N·N)
```

**含义**：
- 高稀疏度 → 注意力集中在少数 patch 对上，其余接近 0
- 低稀疏度 → 注意力较为均匀分布

---

### 3.8 Max Attention

> **每行注意力最大值的平均值。**

**公式**：
```
MaxAttn = (1/N) · Σ_i max_j(a_{ij})
```

**含义**：
- 大值 → 每个 patch 都有明确的一个"最关注对象"
- 小值 → 注意力无明确焦点

---

## 四、跨层演变趋势

随着网络层数加深，注意力模式通常呈现以下变化：

| 指标 | 浅层 (Layer 0-2) | 深层 (Layer 8-11) | 解释 |
|---|---|---|---|
| 有效秩 | 高 | **降低** | 注意力模式趋于固化 |
| 奇异能量比 | 低 | **升高** | 主导模式越来越强 |
| KL 散度 | 中 | 波动 | 取决于任务和输入 |
| 局部性 | 高 | **降低** | 浅层关注局部纹理，深层拓宽视野 |
| 行方差 | 高 | **降低** | patch 间差异减小 |

这反映了 Transformer 的通用规律：**浅层提取局部特征，深层逐步整合全局信息**。

---

## 五、后端保留说明

`backend/` 下的 Python 代码在当前纯前端演示模式下**不需要运行**，保留目的：

1. **模型推理**：`python backend/MultiVITSR.py image.png` → 输出 `attn_list.npy` + 超分图
2. **模型训练**：`backend/SR-train.py`
3. **算法参考**：前端 `math.ts` 完全对标 `visualization.py`

前端纯静态运行：`cd web && npm install && npm run dev`，无需 Python/PyTorch/GPU。

---

## 六、参考文献

- Dosovitskiy et al., "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale" (ViT, 2020)
- Vaswani et al., "Attention Is All You Need" (Transformer, 2017)
- Raghu et al., "Do Vision Transformers See Like Convolutional Neural Networks?" (2021)
- Halko et al., "Finding Structure with Randomness: Probabilistic Algorithms for Constructing Approximate Matrix Decompositions" (Randomized SVD, 2011)
