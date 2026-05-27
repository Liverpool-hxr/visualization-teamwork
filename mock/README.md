# Mock 数据交接文档

## 概述

本目录为 ViT-SR 注意力分析后端的静态 Mock 数据，供前端开发阶段使用。
每个 JSON 文件对应一个后端 REST 接口，数据结构与真实接口完全一致。

**核心参数（与真实模型对齐）**

| 参数 | 值 | 说明 |
|------|----|------|
| `num_layers` | 10 | Transformer 层数 |
| `num_heads` | 8 | 每层注意力头数 |
| `LR_SIZE` | 64 | 输入低分辨率图像边长 |
| `PATCH_SIZE` | 4 | patch 像素大小 |
| `NUM_PATCHES` | 1024 | 总 patch 数（32×32 grid） |
| `UNIFORM_PROB` | 0.000977 | 均匀分布基准概率 |
| `UNIFORM_LOCALITY` | 0.007385 | 均匀分布局部性基准 |

---

## 接口 → 文件 映射表

### 1. `GET /analysis/kl_locality`
**文件：** `analysis_kl_locality.json`  
**说明：** 各层各 head 的 KL 散度（衡量注意力偏离均匀分布程度）与局部性得分。

```json
{
  "layers": [
    {
      "layer": 0,
      "kl_per_head": [0.051, "..."],      
      "locality_per_head": [0.0076, "..."], 
      "kl_mean": 0.051,
      "locality_mean": 0.0077
    }

  ],
  "num_layers": 10,
  "num_heads": 8,
  "baseline_kl": 0.0,          
  "baseline_locality": 0.007385
}
```

---

### 2. `GET /analysis/funnel`
**文件：** `analysis_funnel.json`  
**说明：** 逐层有效秩和奇异能量的相对变化（以第 0 层为 100% 基准）。

```json
{
  "layers": [
    {
      "layer": 0,
      "effective_rank_rel": 100.0, 
      "singular_energy_rel": 100.0   
    }

  ],
  "num_layers": 10,
  "num_heads": 8
}
```



### 3. `GET /analysis/3d_bar`
**文件：** `analysis_3d_bar.json`  
**说明：** 行方差、稀疏度、Gini 系数三项指标逐层相对值，适合三维柱状图展示。

```json
{
  "layers": [
    {
      "layer": 0,
      "row_var_rel": 100.0,
      "sparsity_rel": 100.0,
      "gini_rel": 100.0
    }
  ],
  "num_layers": 10,
  "num_heads": 8,
  "metrics": ["row_var", "sparsity", "gini"]
}
```



### 4. `GET /tree_stats`
**文件：** `tree_stats.json`  
**说明：** 树形层级数据：Layer → Head → Patch，含熵和最大注意力权重，用于树形/旭日图。

```json
{
  "layers": [
    {
      "layer_id": 0,
      "entropy": 5.12,
      "max_attn": 0.021,
      "heads": [
        {
          "head_id": 0,
          "entropy": 5.34,
          "max_attn": 0.019,
          "patches": [
            {"patch_id": 0, "entropy": 4.81, "max_attn": 0.015}
          ]
        }
        
      ]
    }

  ],
  "meta": {
    "num_layers": 10,
    "num_heads": 8,
    "num_patches": 256  
  }
}
```

---

### 5. `GET /visualize`

**文件：**  `visualize.jpg`（Mock 占位图）
说明： 根据指定的层、注意力头、Patch 返回注意力热力图的可视化结果，图像包含三栏：LR 输入、注意力覆盖叠加、SR 超分结果。

参数：

layer_id (int)：层索引（0 到 num_layers - 1）

head_id (int)：注意力头索引（0 到 num_heads - 1）

patch_id (int)：Patch 索引（0 到 num_patches - 1）

返回：

Content-Type: image/png

二进制图片数据，可直接作为 <img> 标签的 src 或下载展示。




