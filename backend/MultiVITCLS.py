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

from VIT import PatchEmbedding, build_sinusoidal_position_embedding, MyTransformerEncoder


class SimpleViT(nn.Module):
    def __init__(self, img_size=64, patch_size=4, num_classes=10,
                 embed_dim=128, layer=4, num_heads=8, conv_dim=64, stage=4):
        super().__init__()
        self.stage = stage

        self.channel_embed = nn.Conv2d(3, conv_dim, kernel_size=3, padding=1)
        self.patch_embed = PatchEmbedding(img_size, patch_size, conv_dim, embed_dim)

        # CLS token
        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))

        # Patch only pos embed (+1 for CLS)
        num_patch = (img_size // patch_size) ** 2
        pe = build_sinusoidal_position_embedding(num_patch, embed_dim).unsqueeze(0)
        self.register_buffer("pos_embed", pe)

        # multi-stage
        self.stages = nn.ModuleList()
        D = embed_dim

        for s in range(stage):
            blocks = nn.ModuleList([
                MyTransformerEncoder(D, D, D * 4, num_heads, 0.1)
                for _ in range(layer)
            ])


            self.stages.append(
                nn.ModuleDict({
                    "blocks": blocks,
                })
            )

        self.fc = nn.Linear(D, num_classes)

    def forward(self, x):
        x = self.channel_embed(x)
        x = self.patch_embed(x)
        x = x + self.pos_embed
        # concat CLS
        cls_token = self.cls_token.expand(x.size(0), -1, -1)
        x = torch.cat([cls_token, x], dim=1)

        attn_list = []

        # multi-stage
        for s in range(self.stage):
            stage = self.stages[s]
            stage_attn = []  # 当前 stage 的所有 layer attention

            for block in stage["blocks"]:
                x, attn = block(x)
                stage_attn.append(attn)
            attn_list.append(stage_attn)
        # CLS for classification
        cls_out = x[:, 0]

        return self.fc(cls_out)  #, attn_list


if __name__ == '__main__':
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # 预处理
    transform = transforms.Compose([
        transforms.Resize((128, 128)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.5071, 0.4865, 0.4409],
            std=[0.2673, 0.2564, 0.2762]
        ),
    ])

    # 加载图片
    img = Image.open("dog.png").convert("RGB")  # 替换成你的图片路径
    x = transform(img).unsqueeze(0)  # [1, 3, 224, 224]

    # 加载模型和权重
    model = SimpleViT(img_size=128, patch_size=8, num_classes=100, embed_dim=128, num_heads=8, layer=3, stage=2)
    # model.load_state_dict(torch.load("simplevit_epoch_25.pth", map_location=device))
    model.to(device)
    model.eval()

    # 推理
    x = x.to(device)
    with torch.no_grad():
        y, attn_list = model(x)
        pred = y.argmax(dim=1).item()

    print("预测类别:", pred)

    # 指定要查看的 layer/head
    stage_id = 0
    layer_id = 0  # 第几层
    head_id = 0  # 第几个 head

    # 取出某层某个head的注意力矩阵（不改模型）
    attn = attn_list[stage_id][layer_id]  # tensor shape [B, h, N, N]
    attn_np = attn[0, head_id].cpu().numpy()  # [N, N]

    # cls token 对所有 patch 的注意力（第一行，去掉 cls 自己）
    patch_attn = attn_np[0, 1:]  # length = num_patches
    num_patches = patch_attn.shape[0]

    # patch 网格尺寸（与你的 patch_size 和 img_size 对应）
    img_size = 128
    patch_size = 8
    H_patch = W_patch = img_size // patch_size

    # reshape 成 (H_patch, W_patch)
    patch_attn = patch_attn.reshape(H_patch, W_patch).astype(float)

    # ------------------ 统一归一化（percentile 裁剪，避免单图 min/max 放大） ------------------
    low_p, high_p = 1.0, 99.0
    vmin = np.percentile(patch_attn, low_p)
    vmax = np.percentile(patch_attn, high_p)
    attn_clipped = np.clip(patch_attn, vmin, vmax)
    attn_norm = (attn_clipped - vmin) / (vmax - vmin + 1e-12)  # 0-1

    # ------------------ 色块对齐调整 ------------------
    scale = patch_size  # 更直观：每个 patch 对应 patch_size x patch_size 像素
    attn_map = np.kron(attn_norm, np.ones((scale, scale)))  # 精确块状放大

    # ------------------ 转 uint8 并上色（cv2.COLORMAP_JET） ------------------
    attn_uint8 = np.uint8(255 * attn_map)
    heatmap_bgr = cv2.applyColorMap(attn_uint8, cv2.COLORMAP_JET)  # BGR
    heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB)  # 转为 RGB 以便 matplotlib 正确显示

    # ------------------ 叠加（确保 orig dtype 为 uint8） ------------------
    orig = np.array(img.resize((img_size, img_size))).astype(np.uint8)
    alpha = 0.4  # 热力图透明度，可调
    overlay = cv2.addWeighted(orig, 1 - alpha, heatmap_rgb, alpha, 0)

    # ------------------ 显示 overlay 与 colorbar（colorbar 基于归一化后的 attn_map） ------------------
    plt.figure(figsize=(6, 6))
    plt.imshow(overlay)
    plt.title(f"Layer {layer_id}, Head {head_id} Attention Overlay")
    plt.axis('off')

    # 单独显示 colorbar（便于读数）
    plt.figure(figsize=(6, 1.2))
    plt.imshow(attn_map, cmap='jet', aspect='auto')
    plt.gca().set_visible(False)
    cbar = plt.colorbar(orientation='horizontal', fraction=0.6, pad=0.2)
    cbar.set_label('normalized attention (after percentile clipping)')
    plt.show()
