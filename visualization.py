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
from flask import Flask, request, jsonify, Response, send_from_directory
import subprocess
from scipy.stats import entropy as scipy_entropy
from sklearn.decomposition import PCA
from sklearn.utils.extmath import randomized_svd

plt.rcParams["font.sans-serif"] = ["SimHei", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

app = Flask(__name__, static_folder="static")

IMG_PATH  = "input.png"
ATTN_FILE = "attn_list.npy"
SR_FILE   = "sr_result.pt"

LR_SIZE    = 64
PATCH_SIZE = 2
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

def effective_rank(mat):
    _, s, _ = randomized_svd(mat, n_components=min(20, mat.shape[0]), random_state=0)
    p = s / (s.sum() + 1e-8)
    return float(np.exp(-np.sum(p * np.log(p + 1e-8))))

def nuclear_norm(mat):
    _, s, _ = randomized_svd(mat, n_components=min(20, mat.shape[0]), random_state=0)
    return float(s.sum())

def mat_vec(mat, eps=1e-8):
    n = mat / (mat.sum(-1, keepdims=True) + eps)
    return n.flatten()

def cosine_sim(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))

def frob_sim(A, B):
    return float(np.sum(A * B) / (np.linalg.norm(A,'fro') * np.linalg.norm(B,'fro') + 1e-8))

def cka(X, Y):
    def center(K):
        n = K.shape[0]; H = np.eye(n) - np.ones((n,n))/n
        return H @ K @ H
    Kx, Ky = center(X @ X.T), center(Y @ Y.T)
    return float(np.sum(Kx*Ky) / (np.sqrt(np.sum(Kx*Kx)*np.sum(Ky*Ky)) + 1e-8))

def jsd(p, q, eps=1e-8):
    p = p/(p.sum()+eps); q = q/(q.sum()+eps); m = 0.5*(p+q)
    return float(np.clip(0.5*scipy_entropy(p,m,base=2)+0.5*scipy_entropy(q,m,base=2),0,1))

def spectral_sim(A, B, k=10):
    k = min(k, A.shape[0]-1, B.shape[0]-1)
    _, sa, _ = randomized_svd(A, n_components=k, random_state=0)
    _, sb, _ = randomized_svd(B, n_components=k, random_state=0)
    sa /= np.linalg.norm(sa)+1e-8; sb /= np.linalg.norm(sb)+1e-8
    return float(np.dot(sa, sb))

def wasserstein_1d(u, v):
    us, vs = np.sort(u.flatten()), np.sort(v.flatten())
    if len(us) != len(vs):
        x = np.linspace(0,1,len(us))
        vs = np.interp(x, np.linspace(0,1,len(vs)), vs)
    return float(np.mean(np.abs(us - vs)))

def cosine_matrix(vecs):
    V = np.stack(vecs)
    V = V / (np.linalg.norm(V, axis=1, keepdims=True) + 1e-8)
    return V @ V.T

def frob_matrix(mats):
    N = len(mats)
    S = np.zeros((N, N))
    norms = [np.linalg.norm(m,'fro')+1e-8 for m in mats]
    for i in range(N):
        for j in range(i, N):
            v = np.sum(mats[i]*mats[j])/(norms[i]*norms[j])
            S[i,j] = S[j,i] = v
    return S

def cka_matrix(X_list):
    N = len(X_list)
    S = np.zeros((N, N))
    for i in range(N):
        for j in range(i, N):
            v = cka(X_list[i], X_list[j])
            S[i,j] = S[j,i] = v
    return S


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

def compute_degrade_data(al):
    L, H = len(al), al[0].shape[1]
    diag = np.zeros(L); rv = np.zeros(L); sp = np.zeros(L); cd = np.zeros(L)
    for l in range(L):
        d = r = s = c = 0.0
        for h in range(H):
            m = al[l][0, h]
            d += np.mean(np.diag(m))
            r += row_var(m)
            s += sparse_ratio(m)
            sv = np.linalg.svd(m, compute_uv=False)
            c += sv[0] / (sv[-1] + 1e-8)
        diag[l] = d / H
        rv[l] = r / H
        sp[l] = s / H
        cd[l] = c / H

    def rel(a): return (a / a[0] * 100).tolist()
    return {
        "layers": [{
            "layer": l,
            "diag_self_attn_rel": round(rel(diag)[l], 2),
            "row_var_rel": round(rel(rv)[l], 2),
            "sparsity_rel": round(rel(sp)[l], 2),
            "cond_num_inv_rel": round((cd[0] / cd * 100)[l], 2)
        } for l in range(L)],
        "raw_diag": diag.tolist(),
        "raw_row_var": rv.tolist(),
        "raw_sparsity": sp.tolist(),
        "raw_cond_num": cd.tolist(),
        "num_layers": L,
        "num_heads": H
    }

def compute_layer_sim_data(al):
    L, H = len(al), al[0].shape[1]
    cos = np.zeros((L, L)); frob = np.zeros((L, L))
    ck = np.zeros((L, L)); spec = np.zeros((L, L)); jsd_m = np.zeros((L, L))
    for h in range(H):
        mats = [al[l][0, h] for l in range(L)]
        vecs = [mat_vec(m) for m in mats]
        Xl   = [mat_vec(m).reshape(mats[0].shape) for m in mats]
        for i in range(L):
            for j in range(L):
                cos[i, j]   += cosine_sim(vecs[i], vecs[j])
                frob[i, j]  += frob_sim(mats[i], mats[j])
                spec[i, j]  += spectral_sim(mats[i], mats[j])
                jsd_m[i, j] += 1 - jsd(vecs[i], vecs[j])
                ck[i, j]    += cka(Xl[i], Xl[j])
    for arr in [cos, frob, ck, spec, jsd_m]:
        arr /= H
    return {
        "layers": list(range(L)),
        "cosine": np.round(cos, 4).tolist(),
        "frobenius": np.round(frob, 4).tolist(),
        "cka": np.round(ck, 4).tolist(),
        "spectral": np.round(spec, 4).tolist(),
        "jsd_complement": np.round(jsd_m, 4).tolist(),
        "num_heads": H
    }

def compute_head_sim_data(al):
    L, H = len(al), al[0].shape[1]
    layers_data = []
    for l in range(L):
        mats = [al[l][0, h] for h in range(H)]
        vecs = [mat_vec(m) for m in mats]
        Xl   = [mat_vec(m).reshape(mats[0].shape) for m in mats]
        cos = cosine_matrix(vecs)
        ck  = cka_matrix(Xl)
        frob = frob_matrix(mats)
        mask = ~np.eye(H, dtype=bool)
        diversity_cos = round(float(1 - cos[mask].mean()), 6)
        diversity_cka = round(float(1 - ck[mask].mean()), 6)
        diversity_frob = round(float(1 - frob[mask].mean()), 6)
        layers_data.append({
            "layer": l,
            "cosine": np.round(cos, 4).tolist(),
            "cka": np.round(ck, 4).tolist(),
            "frobenius": np.round(frob, 4).tolist(),
            "diversity": {
                "cosine": diversity_cos,
                "cka": diversity_cka,
                "frobenius": diversity_frob
            }
        })
    return {"layers": layers_data, "num_layers": L, "num_heads": H}

def compute_patch_sim_data(al, layer_id=0, head_id=0, all_head=False):
    L, H = len(al), al[0].shape[1]
    if all_head or head_id == -1:
        mat = np.mean([al[layer_id][0, h] for h in range(H)], axis=0)
        suffix = f"L{layer_id} All-Head Avg"
    else:
        head_id = max(0, min(head_id, H-1))
        mat = al[layer_id][0, head_id]
        suffix = f"L{layer_id} H{head_id}"

    N = mat.shape[0]; g = int(round(N**0.5))
    vecs = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-8)
    patch_cos = vecs @ vecs.T

    ent = row_entropy(mat)
    max_attn = np.max(mat, axis=1)
    var_attn = np.var(mat, axis=1)
    gini_per_patch = np.array([gini(mat[p:p+1, :]) for p in range(N)])

    return {
        "layer": layer_id,
        "head": head_id if not all_head else -1,
        "suffix": suffix,
        "patch_cos_sim": np.round(patch_cos, 4).tolist(),
        "entropy": np.round(ent.reshape(g, g), 4).tolist(),
        "max_attn": np.round(max_attn.reshape(g, g), 4).tolist(),
        "row_var": np.round(var_attn.reshape(g, g), 4).tolist(),
        "gini": np.round(gini_per_patch.reshape(g, g), 4).tolist(),
        "num_patches": N,
        "grid_size": g
    }

def compute_advanced_data(al):
    L, H = len(al), al[0].shape[1]
    er_mat = np.zeros((L, H)); nn_mat = np.zeros((L, H))
    ent_box = []
    spec_idx = np.zeros(L)
    cka_adj = np.zeros(L-1)
    pca_vecs = []; pca_l = []; pca_h = []

    for l in range(L):
        le = []; hvecs = []
        for h in range(H):
            m = al[l][0, h]
            er_mat[l, h] = effective_rank(m)
            nn_mat[l, h] = nuclear_norm(m)
            le.extend(row_entropy(m).tolist())
            v = mat_vec(m); hvecs.append(v)
            pca_vecs.append(v); pca_l.append(l); pca_h.append(h)
        ent_box.append(le)
        cos = cosine_matrix(hvecs)
        mask = ~np.eye(H, dtype=bool)
        spec_idx[l] = np.std(cos[mask])

    for l in range(L-1):
        vals = []
        for h in range(H):
            X = mat_vec(al[l][0, h]).reshape(al[l][0, h].shape)
            Y = mat_vec(al[l+1][0, h]).reshape(al[l+1][0, h].shape)
            vals.append(cka(X, Y))
        cka_adj[l] = np.mean(vals)

    pca_np = np.stack(pca_vecs)
    pca_model = PCA(n_components=2, random_state=0).fit(pca_np)
    xy = pca_model.transform(pca_np).tolist()

    return {
        "effective_rank": np.round(er_mat, 2).tolist(),
        "nuclear_norm": np.round(nn_mat, 2).tolist(),
        "pca": {
            "points": [{"x": xy[i][0], "y": xy[i][1],
                        "layer": pca_l[i], "head": pca_h[i]} for i in range(len(xy))],
            "explained_variance": pca_model.explained_variance_ratio_.tolist()
        },
        "cka_adjacent": [round(v, 4) for v in cka_adj.tolist()],
        "head_spec_idx": [round(v, 4) for v in spec_idx.tolist()],
        "entropy_box": [[round(val, 4) for val in layer_ents] for layer_ents in ent_box],
        "num_layers": L,
        "num_heads": H
    }

def compute_wasserstein_data(al):
    L, H = len(al), al[0].shape[1]
    layers_data = []
    mean_wd = np.zeros(L)
    for l in range(L):
        wmat = np.zeros((H, H))
        mats = [al[l][0, h] for h in range(H)]
        for i in range(H):
            for j in range(i+1, H):
                d = wasserstein_1d(mats[i], mats[j])
                wmat[i, j] = wmat[j, i] = d
        mask = ~np.eye(H, dtype=bool)
        mean_wd[l] = wmat[mask].mean()
        layers_data.append({
            "layer": l,
            "wasserstein_matrix": np.round(wmat, 4).tolist(),
            "mean_wasserstein": round(float(mean_wd[l]), 4)
        })
    return {
        "layers": layers_data,
        "mean_wd_over_layers": [round(float(v), 4) for v in mean_wd.tolist()],
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
        subprocess.run(["python", "MultiVITSR.py", IMG_PATH], check=True)
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


@app.route("/analysis/degrade_bar")
def analysis_degrade_bar():
    ok, miss = check_files()
    if not ok: return jsonify({"message": f"{miss} not found"}), 400
    try:
        al = load_attn()
        data = compute_degrade_data(al)
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


@app.route("/analysis/layer_similarity")
def analysis_layer_similarity():
    ok, miss = check_files()
    if not ok: return jsonify({"message": f"{miss} not found"}), 400
    try:
        al = load_attn()
        data = compute_layer_sim_data(al)
        return jsonify(data)
    except Exception as e:
        return jsonify({"message": str(e)}), 400


@app.route("/analysis/head_similarity")
def analysis_head_similarity():
    ok, miss = check_files()
    if not ok: return jsonify({"message": f"{miss} not found"}), 400
    try:
        al = load_attn()
        data = compute_head_sim_data(al)
        return jsonify(data)
    except Exception as e:
        return jsonify({"message": str(e)}), 400


@app.route("/analysis/patch_similarity")
def analysis_patch_similarity():
    ok, miss = check_files()
    if not ok: return jsonify({"message": f"{miss} not found"}), 400
    try:
        al = load_attn()
        L, H = len(al), al[0].shape[1]
        layer_id = max(0, min(int(request.args.get("layer_id", 0)), L-1))
        head_id  = int(request.args.get("head_id", 0))
        all_head = request.args.get("all_head", "0") == "1"
        data = compute_patch_sim_data(al, layer_id, head_id, all_head)
        return jsonify(data)
    except Exception as e:
        return jsonify({"message": str(e)}), 400


@app.route("/analysis/advanced_stats")
def analysis_advanced_stats():
    ok, miss = check_files()
    if not ok: return jsonify({"message": f"{miss} not found"}), 400
    try:
        al = load_attn()
        data = compute_advanced_data(al)
        return jsonify(data)
    except Exception as e:
        return jsonify({"message": str(e)}), 400


@app.route("/analysis/head_wasserstein")
def analysis_head_wasserstein():
    ok, miss = check_files()
    if not ok: return jsonify({"message": f"{miss} not found"}), 400
    try:
        al = load_attn()
        data = compute_wasserstein_data(al)
        return jsonify(data)
    except Exception as e:
        return jsonify({"message": str(e)}), 400


@app.route("/analysis/all")
def analysis_all():
    ok, miss = check_files()
    if not ok: return jsonify({"message": f"{miss} not found"}), 400
    try:
        al = load_attn()
        result = {
            "meta": {"num_layers": len(al), "num_heads": int(al[0].shape[1])},
            "kl_locality": compute_kl_locality_data(al),
            "funnel": compute_funnel_data(al),
            "degrade_bar": compute_degrade_data(al),
            "3d_bar": compute_3d_bar_data(al),    # 需补充实现，可内联
            "layer_similarity": compute_layer_sim_data(al),
            "head_similarity": compute_head_sim_data(al),
            "patch_similarity_example": compute_patch_sim_data(al, 0, 0),
            "advanced_stats": compute_advanced_data(al),
            "head_wasserstein": compute_wasserstein_data(al),
        }
        return jsonify(result)
    except Exception as e:
        return jsonify({"message": str(e)}), 400

# 补充 3d_bar 的计算函数，避免 all 路由报错
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


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)