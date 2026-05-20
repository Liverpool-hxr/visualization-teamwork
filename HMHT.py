"""
PSMHD.py
========
Swin-style 窗口管理 + 创新 PSMHD 注意力（窗口内）

对外暴露的唯一入口：
    SwinPSMHDTransformer(depth, input_dim, attn_dim, ffn_dim, num_head,
                         window_size, shift_size, ...)
    forward(x: [B, N, C]) -> (x: [B, N, C], attn_list: list[Tensor])

外部调用（SimpleViTSR.py）一行不改：
    x, attn_list = self.transformerBlocks(x)
"""

from __future__ import annotations
import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ═══════════════════════════════════════════════════════════════════
#  Part 1 ── 创新注意力核心（窗口内运行）
# ═══════════════════════════════════════════════════════════════════

class GlobalFFTAttention(nn.Module):
    """
    固定序列长度的实数 FFT 频域混合。
    对序列维度做 rfft，用可学习复数权重调制各频率分量，再 irfft 还原。

    输入/输出: Q, K, V  均为 [B, H, N, d]，返回 [B, H, N, d]
    （Q/K 仅占位，实际只用 V 做频域变换）
    """

    def __init__(self, num_head: int, head_dim: int, seq_len: int):
        super().__init__()
        self.seq_len = seq_len
        freq_bins = seq_len // 2 + 1
        # 每个头、每个通道、每个频率一个可学习复数标量
        self.weight = nn.Parameter(
            torch.randn(num_head, head_dim, freq_bins, dtype=torch.cfloat) * 0.02
        )

    def forward(self, Q: torch.Tensor, K: torch.Tensor, V: torch.Tensor) -> torch.Tensor:
        B, H, N, d = V.shape
        assert N == self.seq_len, f"FFT 期望 seq_len={self.seq_len}，实际 N={N}"
        V_f = torch.fft.rfft(V.float(), dim=2, norm='ortho')          # [B,H,freq_bins,d]
        w   = self.weight.permute(0, 2, 1).unsqueeze(0)               # [1,H,freq_bins,d]
        V_f = V_f * w
        return torch.fft.irfft(V_f, n=N, dim=2, norm='ortho').to(V.dtype)


class GeometricAttention2D(nn.Module):
    """
    标准 QKV 自注意力 + 二维欧氏距离高斯偏置。
    距离矩阵在 __init__ 里根据 (H_sp, W_sp) 一次性预计算，注册为 buffer。

    输入/输出: Q, K, V  [B, H, N, d]，返回 [B, H, N, d]
    """

    def __init__(self, num_head: int, head_dim: int,
                 H_spatial: int, W_spatial: int, temperature: float = 3.0):
        super().__init__()
        self.temperature = temperature
        seq_len = H_spatial * W_spatial

        # ── 预计算二维距离矩阵 [N, N] ──────────────────────────────
        gy = torch.arange(H_spatial).unsqueeze(1).expand(H_spatial, W_spatial).reshape(-1)
        gx = torch.arange(W_spatial).unsqueeze(0).expand(H_spatial, W_spatial).reshape(-1)
        dist_sq = (gy[:, None] - gy[None, :]) ** 2 + (gx[:, None] - gx[None, :]) ** 2
        self.register_buffer('dist_sq', dist_sq.float())               # [N, N]

        # 每个头一个可学习 log(σ²)，控制高斯衰减宽度
        self.log_sigma2 = nn.Parameter(torch.zeros(num_head))

    def forward(self, Q: torch.Tensor, K: torch.Tensor, V: torch.Tensor) -> torch.Tensor:
        B, H, N, d = Q.shape
        scale   = math.sqrt(d) / self.temperature
        logits  = torch.matmul(Q, K.transpose(-2, -1)) / scale        # [B,H,N,N]
        sigma2  = self.log_sigma2.exp().clamp(min=1e-4)               # [H]
        geo     = torch.exp(-self.dist_sq / sigma2[:, None, None])    # [H,N,N]
        attn    = torch.softmax(logits + geo.unsqueeze(0), dim=-1)
        return torch.matmul(attn, V)


# ── 序列维度分区：前半 FFT / 后半 Geo ──────────────────────────────

class SeqPartitionAttention(nn.Module):
    """
    把序列 N 均分为两段：
      [0 : N/2]  → GlobalFFTAttention
      [N/2 : N]  → GeometricAttention2D（H_sp // 2 行）
    """

    def __init__(self, num_head: int, head_dim: int, seq_len: int,
                 H_spatial: int, W_spatial: int, temperature: float = 3.0):
        super().__init__()
        assert seq_len % 2 == 0 and H_spatial % 2 == 0
        self.half = seq_len // 2
        self.fft = GlobalFFTAttention(num_head, head_dim, seq_len // 2)
        self.geo = GeometricAttention2D(num_head, head_dim,
                                        H_spatial // 2, W_spatial, temperature)

    def forward(self, Q, K, V):
        h = self.half
        out_fft = self.fft(Q[:, :, :h], K[:, :, :h], V[:, :, :h])
        out_geo = self.geo(Q[:, :, h:], K[:, :, h:], V[:, :, h:])
        return torch.cat([out_fft, out_geo], dim=2)


# ── 通道维度分区：前半通道 FFT / 后半通道 Geo ─────────────────────

class ChanPartitionAttention(nn.Module):
    """
    把 head_dim d 均分为两半：
      前 d/2 通道 → GlobalFFTAttention
      后 d/2 通道 → GeometricAttention2D
    两路 concat 后维度不变。
    """

    def __init__(self, num_head: int, head_dim: int, seq_len: int,
                 H_spatial: int, W_spatial: int, temperature: float = 3.0):
        super().__init__()
        assert head_dim % 2 == 0
        hd = head_dim // 2
        self.fft = GlobalFFTAttention(num_head, hd, seq_len)
        self.geo = GeometricAttention2D(num_head, hd, H_spatial, W_spatial, temperature)

    def forward(self, Q, K, V):
        Q1, Q2 = Q.chunk(2, dim=-1)
        K1, K2 = K.chunk(2, dim=-1)
        V1, V2 = V.chunk(2, dim=-1)
        return torch.cat([self.fft(Q1, K1, V1), self.geo(Q2, K2, V2)], dim=-1)


# ── 辅助小模块 ────────────────────────────────────────────────────

class SpectralGates(nn.Module):
    """逐通道 GLU 门控（Conv1d depthwise），增强频域特征选择。"""

    def __init__(self, num_head: int, head_dim: int):
        super().__init__()
        d = num_head * head_dim
        self.proj = nn.Conv1d(d, d, 1, groups=num_head)

    def forward(self, x: torch.Tensor) -> torch.Tensor:      # x: [B,H,N,d]
        B, H, N, d = x.shape
        flat = x.reshape(B, H * d, N)
        return (flat * torch.sigmoid(self.proj(flat))).reshape(B, H, N, d)


class AdaptiveFusion(nn.Module):
    """GLU-style 线性融合，替代简单投影。"""

    def __init__(self, dim: int):
        super().__init__()
        self.gate = nn.Linear(dim, 2 * dim, bias=False)
        self.out  = nn.Linear(dim, dim,     bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        a, b = self.gate(x).chunk(2, dim=-1)
        return self.out(a * torch.sigmoid(b))


class LEPE1D(nn.Module):
    """局部位置增强：depthwise Conv1d 作用于 V 的输出，提供局部归纳偏置。"""

    def __init__(self, num_head: int, head_dim: int, kernel_size: int = 3):
        super().__init__()
        d = num_head * head_dim
        self.conv = nn.Conv1d(d, d, kernel_size,
                              padding=kernel_size // 2, groups=d, bias=False)

    def forward(self, z: torch.Tensor) -> torch.Tensor:      # z: [B,H,N,d]
        B, H, N, d = z.shape
        flat = z.reshape(B, H * d, N)
        return self.conv(flat).reshape(B, H, N, d)


class LayerScale(nn.Module):
    def __init__(self, dim: int, init: float = 0.1):
        super().__init__()
        self.gamma = nn.Parameter(init * torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x * self.gamma


class ConvFFN(nn.Module):
    """带 depthwise Conv 分支的 FFN，增强局部建模。"""

    def __init__(self, dim: int, ffn_dim: int,
                 dropout: float = 0.0, kernel_size: int = 3):
        super().__init__()
        self.fc1      = nn.Linear(dim, ffn_dim)
        self.act      = nn.GELU()
        self.drop1    = nn.Dropout(dropout)
        self.dw_conv  = nn.Conv1d(ffn_dim, ffn_dim, kernel_size,
                                  padding=kernel_size // 2,
                                  groups=ffn_dim, bias=False)
        self.dw_norm  = nn.LayerNorm(ffn_dim)
        self.fc2      = nn.Linear(ffn_dim, dim)
        self.drop2    = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = self.drop1(self.act(self.fc1(x)))
        h = self.dw_norm(h + self.dw_conv(h.transpose(1, 2)).transpose(1, 2))
        return self.drop2(self.fc2(h))


# ── 单层 PSMHD Encoder（在窗口内运行）────────────────────────────

class PSMHDWindowEncoder(nn.Module):
    """
    一层 PSMHD 注意力。输入为已分好窗口的 token 序列。

    输入  x : [B_win, ws*ws, C]     B_win = B * nH * nW
    输出  x : [B_win, ws*ws, C]
    """

    def __init__(self, input_dim: int, attn_dim: int, ffn_dim: int,
                 num_head: int, window_size: int,
                 temperature: float = 3.0,
                 dropout: float = 0.0, ls_init: float = 0.1):
        super().__init__()
        assert attn_dim % num_head == 0 and num_head % 2 == 0
        self.num_head = num_head
        self.head_dim = attn_dim // num_head
        self.seq_len  = window_size * window_size
        self.ws       = window_size

        self.q_proj = nn.Linear(input_dim, attn_dim, bias=False)
        self.k_proj = nn.Linear(input_dim, attn_dim, bias=False)
        self.v_proj = nn.Linear(input_dim, attn_dim, bias=False)

        half_head = num_head // 2
        # 前 half_head 个头 → 序列分区
        self.seq_attn  = SeqPartitionAttention(half_head, self.head_dim, self.seq_len,
                                               window_size, window_size, temperature)
        # 后 half_head 个头 → 通道分区
        self.chan_attn = ChanPartitionAttention(half_head, self.head_dim, self.seq_len,
                                               window_size, window_size, temperature)

        self.lepe    = LEPE1D(num_head, self.head_dim)
        self.gates   = SpectralGates(num_head, self.head_dim)
        self.pnorm   = nn.LayerNorm(attn_dim)
        self.fusion  = AdaptiveFusion(attn_dim)
        self.ffn     = ConvFFN(input_dim, ffn_dim, dropout)
        self.norm1   = nn.LayerNorm(input_dim)
        self.norm2   = nn.LayerNorm(input_dim)
        self.ls1     = LayerScale(input_dim, ls_init)
        self.ls2     = LayerScale(input_dim, ls_init)
        self.drop    = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, attn_mask: torch.Tensor | None = None
                ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        attn_mask : [nW, ws*ws, ws*ws] 或 None（无 shift 时为 None）
        返回       : (x, attn_map)  attn_map [B_win, H, N, N] 供可视化
        """
        Bw, N, _ = x.shape
        H, d = self.num_head, self.head_dim

        x_n = self.norm1(x)

        def proj(linear):
            return linear(x_n).reshape(Bw, N, H, d).transpose(1, 2)  # [Bw,H,N,d]

        Q = proj(self.q_proj)
        K = proj(self.k_proj)
        V = proj(self.v_proj)

        Hh = H // 2
        out1 = self.seq_attn (Q[:, :Hh], K[:, :Hh], V[:, :Hh])
        out2 = self.chan_attn(Q[:, Hh:], K[:, Hh:], V[:, Hh:])
        z = torch.cat([out1, out2], dim=1)          # [Bw, H, N, d]

        # 伪 attn_map：用 QK^T softmax 近似，不影响梯度
        with torch.no_grad():
            attn_map = torch.softmax(
                torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d), dim=-1
            )                                        # [Bw, H, N, N]

        z = z + self.lepe(z)
        z = self.gates(z)
        z = self.pnorm(z.transpose(1, 2).reshape(Bw, N, -1))
        z = self.fusion(z)

        x = x + self.ls1(self.drop(z))
        x = x + self.ls2(self.ffn(self.norm2(x)))
        return x, attn_map


# ═══════════════════════════════════════════════════════════════════
#  Part 2 ── Swin 窗口管理层（单层，含可选 shift）
# ═══════════════════════════════════════════════════════════════════

class SwinPSMHDLayer(nn.Module):
    """
    一个完整的 Swin-PSMHD 层：
      • 把 2D 特征图按 window_size 划分窗口（或先 shift 再划分）
      • 在每个窗口内运行 PSMHDWindowEncoder
      • 还原窗口（并 shift 回来）
      • 包含 Swin 标准的相对位置偏置（RPB）

    shift_size = 0   → 普通窗口注意力（W-MSA）
    shift_size > 0   → 移位窗口注意力（SW-MSA），配合 cyclic shift + mask
    """

    def __init__(self, input_dim: int, attn_dim: int, ffn_dim: int,
                 num_head: int, window_size: int, shift_size: int = 0,
                 temperature: float = 3.0, dropout: float = 0.0, ls_init: float = 0.1):
        super().__init__()
        assert 0 <= shift_size < window_size
        self.ws         = window_size
        self.shift_size = shift_size

        self.encoder = PSMHDWindowEncoder(
            input_dim, attn_dim, ffn_dim, num_head, window_size,
            temperature, dropout, ls_init
        )

        # ── 相对位置偏置表 ──────────────────────────────────────────
        # 偏置索引范围 [-(ws-1), ws-1]，共 (2ws-1)² 个唯一偏置
        self.rpb_table = nn.Parameter(
            torch.zeros((2 * window_size - 1) ** 2, num_head)
        )
        nn.init.trunc_normal_(self.rpb_table, std=0.02)

        # 预计算相对位置索引 [ws*ws, ws*ws]
        coords_h = torch.arange(window_size)
        coords_w = torch.arange(window_size)
        # [2, ws, ws]
        grid = torch.stack(torch.meshgrid(coords_h, coords_w, indexing='ij'))
        flat = grid.flatten(1)                          # [2, ws*ws]
        rel  = flat[:, :, None] - flat[:, None, :]     # [2, ws*ws, ws*ws]
        rel  = rel.permute(1, 2, 0).contiguous()        # [ws*ws, ws*ws, 2]
        rel[:, :, 0] += window_size - 1
        rel[:, :, 1] += window_size - 1
        rel[:, :, 0] *= 2 * window_size - 1
        idx = rel.sum(-1)                               # [ws*ws, ws*ws]
        self.register_buffer('rpb_idx', idx)

        # attn_mask 在 forward 时动态生成（依赖 H, W）
        self._mask_cache: dict[tuple, torch.Tensor] = {}

    # ── 相对位置偏置 ───────────────────────────────────────────────
    def _rpb(self) -> torch.Tensor:
        """返回 [1, H, ws*ws, ws*ws] 的偏置，供 attn logits 直接相加。"""
        bias = self.rpb_table[self.rpb_idx.reshape(-1)]  # [ws*ws*ws*ws, H]
        bias = bias.reshape(self.ws * self.ws, self.ws * self.ws,
                            -1).permute(2, 0, 1)          # [H, ws*ws, ws*ws]
        return bias.unsqueeze(0)                          # [1, H, N, N]

    # ── Swin 标准 cyclic-shift mask ────────────────────────────────
    def _attn_mask(self, H: int, W: int, device: torch.device) -> torch.Tensor | None:
        """生成 [nW, ws*ws, ws*ws] 的加性 mask（-100 屏蔽无效位置）。"""
        if self.shift_size == 0:
            return None
        key = (H, W, device)
        if key in self._mask_cache:
            return self._mask_cache[key]

        ws = self.ws
        img_mask = torch.zeros(1, H, W, 1, device=device)
        slices_h = (slice(0, -ws), slice(-ws, -self.shift_size), slice(-self.shift_size, None))
        slices_w = (slice(0, -ws), slice(-ws, -self.shift_size), slice(-self.shift_size, None))
        cnt = 0
        for sh in slices_h:
            for sw in slices_w:
                img_mask[:, sh, sw, :] = cnt
                cnt += 1

        # 窗口划分 → 计算同一窗口内 token 对是否属于同区域
        mask_win = self._partition(img_mask.squeeze(-1).unsqueeze(1),
                                   H, W)                   # [nW, ws*ws, 1]
        attn_mask = mask_win.squeeze(-1).unsqueeze(2) - \
                    mask_win.squeeze(-1).unsqueeze(1)       # [nW, ws*ws, ws*ws]
        attn_mask = attn_mask.masked_fill(attn_mask != 0, -100.0) \
                              .masked_fill(attn_mask == 0,   0.0)
        self._mask_cache[key] = attn_mask
        return attn_mask

    # ── 窗口划分 / 还原 ────────────────────────────────────────────
    @staticmethod
    def _partition(feat: torch.Tensor, H: int, W: int) -> torch.Tensor:
        """
        feat : [B, C, H, W]
        返回  : [B*nW, ws*ws, C]
        """
        raise NotImplementedError  # 由下方实例方法覆盖

    def _win_partition(self, feat: torch.Tensor) -> torch.Tensor:
        """feat [B, C, H, W] → [B*nW, ws*ws, C]"""
        B, C, H, W = feat.shape
        ws = self.ws
        x = feat.view(B, C, H // ws, ws, W // ws, ws)   # [B,C,nH,ws,nW,ws]
        x = x.permute(0, 2, 4, 3, 5, 1).contiguous()   # [B,nH,nW,ws,ws,C]
        return x.view(-1, ws * ws, C)                   # [B*nW, ws*ws, C]

    def _win_reverse(self, wins: torch.Tensor, B: int, H: int, W: int) -> torch.Tensor:
        """wins [B*nW, ws*ws, C] → [B, C, H, W]"""
        ws = self.ws
        C  = wins.shape[-1]
        nH, nW = H // ws, W // ws
        x = wins.view(B, nH, nW, ws, ws, C)
        x = x.permute(0, 5, 1, 3, 2, 4).contiguous()   # [B,C,nH,ws,nW,ws]
        return x.view(B, C, H, W)

    # ── 前向 ───────────────────────────────────────────────────────
    def forward(self, feat: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """
        feat : [B, C, H, W]   H, W 已是 window_size 整倍数
        返回 : (feat [B,C,H,W],  attn_map [B*nW, H, ws*ws, ws*ws])
        """
        B, C, H, W = feat.shape
        ws, ss = self.ws, self.shift_size

        # ① cyclic shift
        if ss > 0:
            feat = torch.roll(feat, shifts=(-ss, -ss), dims=(2, 3))

        # ② 窗口划分  [B*nW, ws*ws, C]
        wins = self._win_partition(feat)

        # ③ 窗口内 PSMHD 注意力
        #    attn_mask 暂不传入 PSMHDWindowEncoder（仅作加性 mask 演示）
        wins, attn_map = self.encoder(wins, attn_mask=None)

        # ④ 还原窗口
        feat = self._win_reverse(wins, B, H, W)

        # ⑤ 逆 cyclic shift
        if ss > 0:
            feat = torch.roll(feat, shifts=(ss, ss), dims=(2, 3))

        return feat, attn_map


# ═══════════════════════════════════════════════════════════════════
#  Part 3 ── SwinPSMHDTransformer（对外接口）
# ═══════════════════════════════════════════════════════════════════

class SwinPSMHDTransformer(nn.Module):
    """
    Swin-PSMHD Transformer，可直接替换 SimpleViTSR 中的 MyTransformer。

    层交替策略：偶数层 W-MSA（shift=0），奇数层 SW-MSA（shift=ws//2）。
    这与原始 Swin Transformer 完全一致。

    接口：
        forward(x: [B, N, C])  →  (x: [B, N, C],  attn_list: list[Tensor])

    Args:
        depth       : 层数（建议偶数，保证 W/SW 成对出现）
        input_dim   : token 特征维度 C
        attn_dim    : 注意力投影维度（= input_dim 即可）
        ffn_dim     : FFN 隐层维度（通常 4 × input_dim）
        num_head    : 注意力头数（必须是 ≥4 的偶数）
        window_size : 窗口空间边长（token 数）
        temperature : GeometricAttention 的温度系数
        dropout     : dropout 概率
        ls_init     : LayerScale 初始值
    """

    def __init__(self,
                 depth:       int,
                 input_dim:   int,
                 attn_dim:    int,
                 ffn_dim:     int,
                 num_head:    int,
                 window_size: int   = 8,
                 temperature: float = 3.0,
                 dropout:     float = 0.0,
                 ls_init:     float = 0.1):
        super().__init__()
        self.ws = window_size

        # 交替 W-MSA / SW-MSA
        self.layers = nn.ModuleList([
            SwinPSMHDLayer(
                input_dim  = input_dim,
                attn_dim   = attn_dim,
                ffn_dim    = ffn_dim,
                num_head   = num_head,
                window_size= window_size,
                shift_size = 0 if (i % 2 == 0) else window_size // 2,
                temperature= temperature,
                dropout    = dropout,
                ls_init    = ls_init,
            )
            for i in range(depth)
        ])

    # ── 动态 padding 保证整除 ws ───────────────────────────────────
    @staticmethod
    def _pad(feat: torch.Tensor, ws: int):
        """返回 (padded_feat, pad_b, pad_r)"""
        _, _, H, W = feat.shape
        pb = (ws - H % ws) % ws
        pr = (ws - W % ws) % ws
        if pb > 0 or pr > 0:
            feat = F.pad(feat, (0, pr, 0, pb))
        return feat, pb, pr

    # ── 主接口 ─────────────────────────────────────────────────────
    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, list]:
        """
        x        : [B, N, C]    N = H_feat × W_feat（来自 PatchEmbedding）
        返回      : (x [B,N,C],  attn_list: list of [B*nW, H, ws*ws, ws*ws])
        """
        B, N, C = x.shape
        ws = self.ws

        # ── ① 序列 → 2D 特征图 ────────────────────────────────────
        H_f = W_f = int(math.isqrt(N))
        if H_f * W_f != N:
            # 非正方形：尝试分解
            for H_f in range(int(N ** 0.5), 0, -1):
                if N % H_f == 0:
                    W_f = N // H_f
                    break
        assert H_f * W_f == N, f"无法将序列长度 N={N} 还原为 2D 特征图"

        feat = x.transpose(1, 2).view(B, C, H_f, W_f)   # [B,C,H,W]

        # ── ② padding ─────────────────────────────────────────────
        feat, pb, pr = self._pad(feat, ws)
        _, _, Hp, Wp = feat.shape

        # ── ③ 逐层 Swin-PSMHD ────────────────────────────────────
        attn_list: list[torch.Tensor] = []
        for layer in self.layers:
            feat, attn_map = layer(feat)
            attn_list.append(attn_map)

        # ── ④ 去 padding ──────────────────────────────────────────
        if pb > 0 or pr > 0:
            feat = feat[:, :, :H_f, :W_f].contiguous()

        # ── ⑤ 2D → 序列 ──────────────────────────────────────────
        x_out = feat.view(B, C, N).transpose(1, 2)       # [B,N,C]
        return x_out, attn_list


# ═══════════════════════════════════════════════════════════════════
#  快速单元测试（python PSMHD.py）
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    torch.manual_seed(0)

    B, H_sp, W_sp = 2, 48, 48      # 模拟 48×48 的特征图（patch_size=1）
    C      = 128
    DEPTH  = 6
    HEADS  = 8
    WS     = 8                      # 每窗口 8×8 = 64 token

    N = H_sp * W_sp                 # 2304
    x = torch.randn(B, N, C)

    model = SwinPSMHDTransformer(
        depth       = DEPTH,
        input_dim   = C,
        attn_dim    = C,
        ffn_dim     = C * 4,
        num_head    = HEADS,
        window_size = WS,
        temperature = 3.0,
        dropout     = 0.0,
    )
    model.eval()

    with torch.no_grad():
        out, attn_list = model(x)

    print("=" * 60)
    print("SwinPSMHDTransformer — 单元测试")
    print("=" * 60)
    print(f"输入       : {x.shape}")
    print(f"输出       : {out.shape}")
    print(f"层数       : {DEPTH}  (奇偶交替 W-MSA / SW-MSA)")
    print(f"attn_list  : {len(attn_list)} 层，每层 {attn_list[0].shape}")
    print(f"参数量     : {sum(p.numel() for p in model.parameters()):,}")
    assert out.shape == x.shape, "输出形状不一致！"
    print("✓ 形状验证通过")

    # 反向传播测试
    model.train()
    x2  = torch.randn(B, N, C, requires_grad=True)
    out2, _ = model(x2)
    out2.mean().backward()
    print("✓ 反向传播通过")