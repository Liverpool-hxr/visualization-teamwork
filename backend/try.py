import json
import os
import numpy as np

# ---------- 配置（与你的模型对齐） ----------
NUM_LAYERS = 10
NUM_HEADS = 8
LR_SIZE = 64
PATCH_SIZE = 4
NUM_PATCHES = (LR_SIZE // PATCH_SIZE) ** 2  # 256
UNIFORM_LOCALITY = 7.5625 / NUM_PATCHES      # 0.029541015625

np.random.seed(42)

# ---------- 辅助函数 ----------
def mock_kl_locality():
    layers = []
    for l in range(NUM_LAYERS):
        # 随机生成每头 KL 和 locality，趋势：深层 KL 降低，locality 升高
        kl_per_head = [round(np.random.uniform(0.05, 0.4 - l * 0.03), 6) for _ in range(NUM_HEADS)]
        loc_per_head = [round(np.random.uniform(0.02, 0.06 + l * 0.002), 6) for _ in range(NUM_HEADS)]
        layers.append({
            "layer": l,
            "kl_per_head": kl_per_head,
            "locality_per_head": loc_per_head,
            "kl_mean": round(np.mean(kl_per_head), 6),
            "locality_mean": round(np.mean(loc_per_head), 6)
        })
    return {
        "layers": layers,
        "num_layers": NUM_LAYERS,
        "num_heads": NUM_HEADS,
        "baseline_kl": 0.0,
        "baseline_locality": round(UNIFORM_LOCALITY, 6)
    }

def mock_funnel():
    # 有效秩和奇异能量相对值，随层数递减
    er = [100.0]
    ms = [100.0]
    for _ in range(1, NUM_LAYERS):
        er.append(round(er[-1] * np.random.uniform(0.85, 0.95), 2))
        ms.append(round(ms[-1] * np.random.uniform(0.88, 0.97), 2))
    layers = []
    for l in range(NUM_LAYERS):
        layers.append({
            "layer": l,
            "effective_rank_rel": er[l],
            "singular_energy_rel": ms[l]
        })
    return {
        "layers": layers,
        "num_layers": NUM_LAYERS,
        "num_heads": NUM_HEADS
    }

def mock_3d_bar():
    # 三个指标相对值（以第0层为100）
    data = np.zeros((NUM_LAYERS, 3))
    data[0] = [100, 100, 100]
    for l in range(1, NUM_LAYERS):
        # 模拟变化趋势
        data[l, 0] = round(data[l-1, 0] * np.random.uniform(1.0, 1.1), 2)   # row_var_rel 略升
        data[l, 1] = round(data[l-1, 1] * np.random.uniform(0.95, 1.05), 2) # sparsity_rel 波动
        data[l, 2] = round(data[l-1, 2] * np.random.uniform(1.0, 1.05), 2)  # gini_rel 略升
    layers = []
    for l in range(NUM_LAYERS):
        layers.append({
            "layer": l,
            "row_var_rel": data[l, 0],
            "sparsity_rel": data[l, 1],
            "gini_rel": data[l, 2]
        })
    return {
        "layers": layers,
        "num_layers": NUM_LAYERS,
        "num_heads": NUM_HEADS,
        "metrics": ["row_var", "sparsity", "gini"]
    }

def mock_tree_stats():
    layers = []
    for l in range(NUM_LAYERS):
        layer_entropy = np.random.uniform(1.0, 3.0)
        layer_max = np.random.uniform(0.1, 0.5)
        heads = []
        for h in range(NUM_HEADS):
            head_entropy = round(layer_entropy * np.random.uniform(0.9, 1.1), 4)
            head_max = round(layer_max * np.random.uniform(0.9, 1.1), 4)
            patches = []
            for p in range(NUM_PATCHES):
                patches.append({
                    "patch_id": p,
                    "entropy": round(head_entropy * np.random.uniform(0.8, 1.2), 4),
                    "max_attn": round(head_max * np.random.uniform(0.8, 1.2), 4)
                })
            heads.append({"head_id": h, "entropy": head_entropy, "max_attn": head_max, "patches": patches})
        layers.append({
            "layer_id": l,
            "entropy": round(layer_entropy, 4),
            "max_attn": round(layer_max, 4),
            "heads": heads
        })
    return {
        "layers": layers,
        "meta": {"num_layers": NUM_LAYERS, "num_heads": NUM_HEADS, "num_patches": NUM_PATCHES}
    }

# ---------- 写入文件 ----------
def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == '__main__':
    base = 'mock'
    save_json(os.path.join(base, 'analysis', 'kl_locality.json'), mock_kl_locality())
    save_json(os.path.join(base, 'analysis', 'funnel.json'), mock_funnel())
    save_json(os.path.join(base, 'analysis', '3d_bar.json'), mock_3d_bar())
    save_json(os.path.join(base, 'tree_stats.json'), mock_tree_stats())
    print("Mock data generated in ./mock/")