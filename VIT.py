import torch
import torch.nn.functional as F
import torch.nn as nn
import numpy as np
import matplotlib.pyplot as plt
from einops import rearrange
import torchvision.transforms as transforms
from PIL import Image
import cv2
import copy


class LEPE1D(nn.Module):
    """局部位置增强：depthwise Conv1d 作用于 V 的输出，提供局部归纳偏置。"""

    def __init__(self, num_head: int, head_dim: int, kernel_size: int = 3):
        super().__init__()
        d = num_head * head_dim
        self.conv = nn.Conv1d(d, d, kernel_size,
                              padding=kernel_size // 2, groups=d, bias=False)

    def forward(self, z: torch.Tensor) -> torch.Tensor:  # z: [B,H,N,d]
        B, H, N, d = z.shape
        flat = z.reshape(B, H * d, N)
        return self.conv(flat).reshape(B, H, N, d)



class PatchEmbedding(nn.Module):
    def __init__(self, patch_size=4, input_chans=128, embed_dim=128):
        super().__init__()
        self.patch_size = patch_size
        self.proj = nn.Conv2d(input_chans, embed_dim, kernel_size=patch_size, stride=patch_size)

    def forward(self, x):
        # x: [B, conv_dim, H, W]
        x = self.proj(x)  # [B, embed_dim, H//patch_size, W//patch_size]
        B, C, H, W = x.shape
        # 展平为序列 [B, H*W, C]
        x = x.flatten(2).transpose(1, 2)  # [B, H*W, embed_dim]
        return x, (H, W)  # 返回 grid size

class MyTransformerEncoder(nn.Module):
    def __init__(self, input_dim, attn_dim, ffn_dim, num_head, dropout=0.0):
        super().__init__()
        self.num_head = num_head
        self.head_dim = attn_dim // num_head

        # QKV 投影
        self.query = nn.Linear(input_dim, attn_dim, bias=False)
        self.key = nn.Linear(input_dim, attn_dim, bias=False)
        self.value = nn.Linear(input_dim, attn_dim, bias=False)

        # 输出投影
        self.out_proj = nn.Linear(attn_dim, input_dim)

        # FFN
        self.ffn = nn.Sequential(
            nn.Linear(input_dim, ffn_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(ffn_dim, input_dim),
            nn.Dropout(dropout)
        )

        self.norm1 = nn.LayerNorm(input_dim)
        self.norm2 = nn.LayerNorm(input_dim)

        self.lepe = LEPE1D(num_head, self.head_dim)

    def forward(self, x):
        x_norm = self.norm1(x)
        B, N, _ = x_norm.shape

        Q = self.query(x_norm).reshape(B, N, self.num_head, self.head_dim).transpose(1, 2)
        K = self.key(x_norm).reshape(B, N, self.num_head, self.head_dim).transpose(1, 2)
        V = self.value(x_norm).reshape(B, N, self.num_head, self.head_dim).transpose(1, 2)

        # 用 sdpa 做前向（参与梯度）
        #attn_out = F.scaled_dot_product_attention(Q, K, V)
        scores = (Q @ K.transpose(-2, -1)) / (self.head_dim ** 0.5) * 3.0
        attn_weights = torch.softmax(scores, dim=-1)
        attn_out = attn_weights @ V + self.lepe(V)


        attn_out = attn_out.transpose(1, 2).reshape(B, N, self.num_head * self.head_dim)
        x = x + self.out_proj(attn_out)

        x_ffn = self.norm2(x)
        x = x + self.ffn(x_ffn)

        return x, attn_weights

class MyTransformer(nn.Module):
    """
    Multi-layer PS-MHD Transformer.

    prev_specs is threaded through layers as a [B, H, F] tensor
    (previously a Python list of per-head tensors).
    """

    def __init__(
        self,
        depth,
        input_dim,
        attn_dim,
        ffn_dim,
        num_head,
        dropout=0.0,
    ):
        super().__init__()

        self.layers = nn.ModuleList([
            MyTransformerEncoder(
                input_dim=input_dim,
                attn_dim=attn_dim,
                ffn_dim=ffn_dim,
                num_head=num_head,
                dropout=dropout,
            )
            for _ in range(depth)
        ])

    def forward(self, x):
        attn_maps = []
        for layer in self.layers:
            x, attn_map = layer(x)
            attn_maps.append(attn_map)
        return x, attn_maps

class DownSampler(nn.Module):
    """
    Correct downsampling for ViT patches + cls token.
    Patches: Conv2d(stride=2)     --> spatial downsample + channel *2
    CLS:     Linear(C → 2C)       --> only channel transform
    """

    def __init__(self, dim):
        super().__init__()
        self.conv = nn.Conv2d(dim, dim * 2, kernel_size=2, stride=2)
        self.cls_proj = nn.Linear(dim, dim * 2)

    def forward(self, x):
        cls = x[:, :1]  # (B,1,C)
        p = x[:, 1:]  # (B,N,C)

        B, N, C = p.shape
        H = W = int(N ** 0.5)

        # Patch下采样
        p = p.reshape(B, H, W, C).permute(0, 3, 1, 2)  # B,C,H,W
        p = self.conv(p)  # B,2C,H/2,W/2
        p = p.flatten(2).transpose(1, 2)  # B,N/4,2C
        # CLS升维（不下采样）
        cls = self.cls_proj(cls)  # B,1,2C

        return torch.cat([cls, p], dim=1)


def build_sinusoidal_position_embedding(n_positions, dim):
    pe = torch.zeros(n_positions, dim)
    position = torch.arange(0, n_positions, dtype=torch.float).unsqueeze(1)
    div_term = torch.exp(torch.arange(0, dim, 2).float() * (-np.log(10000.0) / dim))
    pe[:, 0::2] = torch.sin(position * div_term)
    pe[:, 1::2] = torch.cos(position * div_term)
    return pe  # [N, dim]


