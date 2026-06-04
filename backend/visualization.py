import matplotlib
matplotlib.use('Agg')  # 仍保留，供 /visualize 使用
from matplotlib import pyplot as plt

import os
import io
import base64

import cv2
import torch
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, Response
import subprocess
from scipy.stats import entropy as scipy_entropy
from sklearn.decomposition import PCA
from sklearn.utils.extmath import randomized_svd

plt.rcParams["font.sans-serif"] = ["SimHei", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)

IMG_PATH  = os.path.join(BASE_DIR, "input.png")
ATTN_FILE = os.path.join(BASE_DIR, "attn_list.npy")
SR_FILE   = os.path.join(BASE_DIR, "sr_result.pt")

LR_SIZE    = 64
PATCH_SIZE = 4
UPSCALE    = 4
NUM_PATCHES = (LR_SIZE // PATCH_SIZE) ** 2
UNIFORM_PROB     = 1 / NUM_PATCHES
UNIFORM_LOCALITY = 7.5625 / NUM_PATCHES


# ── Utilities ──────────────────────────────────────────────────

def fig_to_b64(fig) -> str:
    """仅保留，供 /visualize 使用"""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=150)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()

def png_response(b64: str) -> Response:
    """仅保留，供 /visualize 使用"""
    return Response(base64.b64decode(b64), mimetype="image/png")

def load_attn():
    return np.load(ATTN_FILE, allow_pickle=True)

def check_files():
    for f in [IMG_PATH, ATTN_FILE, SR_FILE]:
        if not os.path.exists(f):
            return False, f
    return True, None


# ── Metrics ────────────────────────────────────────────────────

def kl_uniform(mat, eps=1e-8):
    n = mat / (mat.sum(-1, keepdims=True) + eps)
    u = np.full_like(n, UNIFORM_PROB)
    return np.mean(np.sum(n * np.log(n / (u + eps) + eps), axis=-1))

def locality_score(mat):
    N = mat.shape[0]
    g = int(round(N ** 0.5))
    idx = np.arange(N)
    r, c = idx // g, idx % g
    dr = np.abs(r[:, None] - r[None, :])
    dc = np.abs(c[:, None] - c[None, :])
    return np.mean(np.sum(mat * ((dr <= 1) & (dc <= 1)), axis=1))

def row_entropy(mat, eps=1e-8):
    n = mat / (mat.sum(-1, keepdims=True) + eps)
    return -np.sum(n * np.log(n + eps), axis=-1)

def mean_entropy(mat):
    return float(row_entropy(mat).mean())

def row_var(mat):
    return float(np.mean(np.var(mat, axis=1)))

def sparse_ratio(mat):
    return float(np.sum(mat > mat.mean() * 1.2) / mat.size)

def gini(mat):
    x = np.sort(mat.flatten())
    n = len(x)
    return float((n + 1 - 2 * np.cumsum(x).sum() / x.sum()) / n)

def svd_metrics(mat, eps=1e-3):
    _, s, _ = randomized_svd(mat, n_components=min(20, mat.shape[0]), random_state=0)
    valid = s[s > s[0] * eps]
    return len(valid), s[0] / (s.sum() + 1e-8)


# ── Extracted computation functions (for reuse) ─────────────────

def compute_kl_locality_data(al):
    L, H = len(al), al[0].shape[1]
    kl = np.zeros((L, H))
    lc = np.zeros((L, H))
    for l in range(L):
        for h in range(H):
            m = al[l][0, h]
            kl[l, h] = kl_uniform(m)
            lc[l, h] = locality_score(m)
    layers = []
    for l in range(L):
        layers.append({
            "layer": l,
            "kl_per_head": [round(float(kl[l, h]), 6) for h in range(H)],
            "locality_per_head": [round(float(lc[l, h]), 6) for h in range(H)],
            "kl_mean": round(float(kl[l].mean()), 6),
            "locality_mean": round(float(lc[l].mean()), 6)
        })
    return {
        "layers": layers,
        "num_layers": L,
        "num_heads": H,
        "baseline_kl": 0.0,
        "baseline_locality": UNIFORM_LOCALITY
    }

def compute_funnel_data(al):
    L, H = len(al), al[0].shape[1]
    er = np.zeros(L)
    ms = np.zeros(L)
    for l in range(L):
        rs = mss = 0.0
        for h in range(H):
            r, m = svd_metrics(al[l][0, h])
            rs += r
            mss += m
        er[l] = rs / H
        ms[l] = mss / H
    er_rel = (er / er[0] * 100).tolist()
    ms_rel = (ms / ms[0] * 100).tolist()
    return {
        "layers": [{
            "layer": l,
            "effective_rank_rel": round(er_rel[l], 2),
            "singular_energy_rel": round(ms_rel[l], 2)
        } for l in range(L)],
        "num_layers": L,
        "num_heads": H
    }



# ── Routes ─────────────────────────────────────────────────────

@app.route("/run", methods=["POST"])
def run_sr():
    if "image" not in request.files:
        return jsonify({"message": "image file missing"}), 400
    try:
        request.files["image"].save(IMG_PATH)
        multivit_path = os.path.join(BASE_DIR, "MultiVITSR.py")
        subprocess.run(["python", multivit_path, IMG_PATH], check=True, cwd=BASE_DIR)
        return jsonify({"message": "run completed"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 400


@app.route("/visualize", methods=["GET"])
def visualize():
    ok, miss = check_files()
    if not ok: return jsonify({"message": f"{miss} not found"}), 400
    try:
        img      = Image.open(IMG_PATH).convert("RGB")
        layer_id = int(request.args.get("layer_id", 0))
        head_id  = int(request.args.get("head_id", 0))
        patch_id = int(request.args.get("patch_id", 0))

        attn = load_attn()[layer_id][0, head_id]
        N = attn.shape[0]; g = int(round(N**0.5))
        patch_id = min(patch_id, N-1)

        pa = attn[patch_id].reshape(g, g)
        vmin, vmax = np.percentile(pa, 1), np.percentile(pa, 99)
        an = (np.clip(pa, vmin, vmax) - vmin) / (vmax - vmin + 1e-8)
        ab = np.kron(an, np.ones((PATCH_SIZE, PATCH_SIZE)))
        ds = g * PATCH_SIZE

        hm = cv2.applyColorMap((ab*255).astype(np.uint8), cv2.COLORMAP_JET)
        hm = cv2.cvtColor(hm, cv2.COLOR_BGR2RGB)
        orig = np.array(img.resize((ds, ds)))
        ov = cv2.addWeighted(orig, 0.6, hm, 0.4, 0)

        row, col = patch_id//g, patch_id%g
        cx, cy = col*PATCH_SIZE + PATCH_SIZE/2 - 0.5, row*PATCH_SIZE + PATCH_SIZE/2 - 0.5

        sr = torch.load(SR_FILE)
        fig, axes = plt.subplots(1, 3, figsize=(12, 4))
        axes[0].imshow(orig);  axes[0].set_title("LR Input");  axes[0].axis("off")
        axes[1].imshow(ov);    axes[1].set_title(f"Attn L{layer_id} H{head_id} P{patch_id}"); axes[1].axis("off")
        for i in range(0, ds+1, PATCH_SIZE):
            axes[1].axhline(i-.5, color="white", ls="--", lw=0.5)
            axes[1].axvline(i-.5, color="white", ls="--", lw=0.5)
        axes[1].scatter(cx, cy, marker="*", s=600, c="red", edgecolors="black")
        axes[2].imshow(sr[0].cpu().permute(1,2,0).numpy())
        axes[2].set_title(f"SR x{UPSCALE}"); axes[2].axis("off")
        fig.tight_layout()
        return png_response(fig_to_b64(fig))
    except Exception as e:
        return jsonify({"message": str(e)}), 400


# ── Analysis routes (JSON only) ─────────────────────────────────

@app.route("/analysis/kl_locality")
def analysis_kl_locality():
    ok, miss = check_files()
    if not ok: return jsonify({"message": f"{miss} not found"}), 400
    try:
        al = load_attn()
        data = compute_kl_locality_data(al)
        return jsonify(data)
    except Exception as e:
        return jsonify({"message": str(e)}), 400


@app.route("/analysis/funnel")
def analysis_funnel():
    ok, miss = check_files()
    if not ok: return jsonify({"message": f"{miss} not found"}), 400
    try:
        al = load_attn()
        data = compute_funnel_data(al)
        return jsonify(data)
    except Exception as e:
        return jsonify({"message": str(e)}), 400



@app.route("/analysis/3d_bar")
def analysis_3d_bar():
    ok, miss = check_files()
    if not ok: return jsonify({"message": f"{miss} not found"}), 400
    try:
        al = load_attn()
        L, H = len(al), al[0].shape[1]
        data = np.zeros((L, 3))
        for l in range(L):
            r=s=g=0.0
            for h in range(H):
                m = al[l][0,h]
                r += row_var(m); s += sparse_ratio(m); g += gini(m)
            data[l] = [r/H, s/H, g/H]
        rel = data / data[0] * 100
        return jsonify({
            "layers": [{
                "layer": l,
                "row_var_rel": round(float(rel[l, 0]), 2),
                "sparsity_rel": round(float(rel[l, 1]), 2),
                "gini_rel": round(float(rel[l, 2]), 2)
            } for l in range(L)],
            "num_layers": L,
            "num_heads": H,
            "metrics": ["row_var", "sparsity", "gini"]
        })
    except Exception as e:
        return jsonify({"message": str(e)}), 400







def compute_3d_bar_data(al):
    L, H = len(al), al[0].shape[1]
    data = np.zeros((L, 3))
    for l in range(L):
        r=s=g=0.0
        for h in range(H):
            m = al[l][0,h]
            r += row_var(m); s += sparse_ratio(m); g += gini(m)
        data[l] = [r/H, s/H, g/H]
    rel = data / data[0] * 100
    return {
        "layers": [{
            "layer": l,
            "row_var_rel": round(float(rel[l, 0]), 2),
            "sparsity_rel": round(float(rel[l, 1]), 2),
            "gini_rel": round(float(rel[l, 2]), 2)
        } for l in range(L)],
        "num_layers": L,
        "num_heads": H,
        "metrics": ["row_var", "sparsity", "gini"]
    }


@app.route("/tree_stats")
def tree_stats():
    ok, miss = check_files()
    if not ok: return jsonify({"message": f"{miss} not found"}), 400
    try:
        al = load_attn(); L, H = len(al), al[0].shape[1]
        P = al[0].shape[2]
        layers = []
        for l in range(L):
            le = lm = 0.0; heads = []
            for h in range(H):
                m = al[l][0,h]
                he = mean_entropy(m); hm = float(np.mean(np.max(m, axis=-1)))
                le += he; lm += hm
                patches = []
                for p in range(P):
                    row = m[p:p+1,:]
                    patches.append({
                        "patch_id": p,
                        "entropy": round(mean_entropy(row), 4),
                        "max_attn": round(float(np.max(row)), 4)
                    })
                heads.append({"head_id": h, "entropy": round(he,4), "max_attn": round(hm,4), "patches": patches})
            layers.append({"layer_id": l, "entropy": round(le/H,4), "max_attn": round(lm/H,4), "heads": heads})
        return jsonify({"layers": layers, "meta": {"num_layers": L, "num_heads": H, "num_patches": P}})
    except Exception as e:
        return jsonify({"message": str(e)}), 400



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)