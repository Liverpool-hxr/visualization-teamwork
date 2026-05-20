import math
from itertools import repeat
from time import time

import torch
import torch.nn as nn
import numpy as np
import matplotlib.pyplot as plt
import torchmetrics
import torchvision
from einops import rearrange
import torchvision.transforms as transforms
from PIL import Image
import cv2
import sys
import torch.nn.functional as F
from torchvision.transforms import InterpolationMode

from torchvision.utils import save_image

# 你自己的模块
from VIT import PatchEmbedding, MyTransformer, build_sinusoidal_position_embedding



class PatchUnEmbed(nn.Module):
    """将序列 [B, N, C] 还原为 2D 特征图 [B, C, H, W]"""

    def __init__(self, embed_dim, patch_size):
        super().__init__()
        self.embed_dim = embed_dim
        self.patch_size = patch_size

    def forward(self, x, x_size):
        B, HW, C = x.shape
        x = x.transpose(1, 2).view(B, self.embed_dim, x_size[0], x_size[1])  # B Ph*Pw C
        return x


class Upsample(nn.Sequential):
    """Upsample module.

    Args:
        scale (int): Scale factor. Supported scales: 2^n and 3.
        num_feat (int): Channel number of intermediate features.
    """

    def __init__(self, scale, num_feat):
        m = []
        if (scale & (scale - 1)) == 0:  # scale = 2^n
            for _ in range(int(math.log(scale, 2))):
                m.append(nn.Conv2d(num_feat, 4 * num_feat, 3, 1, 1))
                m.append(nn.PixelShuffle(2))
        elif scale == 3:
            m.append(nn.Conv2d(num_feat, 9 * num_feat, 3, 1, 1))
            m.append(nn.PixelShuffle(3))
        else:
            raise ValueError(f'scale {scale} is not supported. ' 'Supported scales: 2^n and 3.')
        super(Upsample, self).__init__(*m)



class SimpleViTSR(nn.Module):
    def __init__(self,
                 patch_size=4,
                 embed_dim=128,
                 num_layers=3,
                 num_heads=8,
                 window_size=32,
                 upscale_factor=4,
                 max_seq_len=4096):
        super().__init__()

        self.norm = nn.LayerNorm(embed_dim)
        pos_embed_table = build_sinusoidal_position_embedding(max_seq_len, embed_dim)
        # 注册为 buffer，不参与训练，随模型保存
        self.register_buffer('pos_embed_table', pos_embed_table)  # [max_seq_len, C]

        self.window_size = window_size

        self.upscale = upscale_factor
        self.patch_size = patch_size
        # ------------------ 前端卷积 ------------------
        self.conv_in = nn.Conv2d(3, embed_dim, 3, 1, 1)

        self.shallow_down = nn.Conv2d(embed_dim, embed_dim,
                                      kernel_size=patch_size,
                                      stride=patch_size)

        # ------------------ Patch Embedding ------------------
        self.patch_embed = PatchEmbedding(patch_size, input_chans= embed_dim, embed_dim=embed_dim)
        self.unpatch = PatchUnEmbed(embed_dim, patch_size)
        num_feat=64

        self.transformerBlocks = MyTransformer(
            depth=num_layers,
            input_dim=embed_dim,
            attn_dim=embed_dim,
            ffn_dim=embed_dim*4,
            num_head=num_heads,
            dropout=0.0,
        )

        self.conv_after_body = nn.Sequential(nn.Conv2d(embed_dim, embed_dim // 4, 3, 1, 1),
                                             nn.LeakyReLU(negative_slope=0.2, inplace=True),
                                             nn.Conv2d(embed_dim // 4, embed_dim // 4, 1, 1, 0),
                                             nn.LeakyReLU(negative_slope=0.2, inplace=True),
                                             nn.Conv2d(embed_dim // 4, embed_dim, 3, 1, 1))

        # for classical SR
        self.conv_before_upsample = nn.Sequential(nn.Conv2d(embed_dim, num_feat, 3, 1, 1),
                                                  nn.LeakyReLU(inplace=True))
        self.upsample = Upsample(self.upscale * self.patch_size, num_feat)
        self.conv_last = nn.Conv2d(num_feat, 3, 3, 1, 1)

    def forward(self, x):
        h_ori, w_ori = x.size()[-2], x.size()[-1]
        mod = self.window_size * self.patch_size
        h_pad = ((h_ori + mod - 1) // mod) * mod - h_ori
        w_pad = ((w_ori + mod - 1) // mod) * mod - w_ori
        h, w = h_ori + h_pad, w_ori + w_pad
        x = torch.cat([x, torch.flip(x, [2])], 2)[:, :, :h, :]
        x = torch.cat([x, torch.flip(x, [3])], 3)[:, :, :, :w]


        # Shallow feature
        x = self.conv_in(x)
        shallow = x

        # Transformer
        x, x_size = self.patch_embed(x)
        x, attn_list = self.transformerBlocks(x)
        x = self.norm(x)

        # 还原空间 + 残差对齐
        x = self.unpatch(x, x_size)
        x = self.conv_after_body(x) + self.shallow_down(shallow)  # 局部残差

        # 上采样输出
        x = self.conv_before_upsample(x)
        x = self.conv_last(self.upsample(x))


        # unpadding
        x = x[..., :h_ori * self.upscale * self.patch_size, :w_ori * self.upscale * self.patch_size]

        return x, attn_list


# ------------------------------ 测试推理 + 可视化 ------------------------------
if __name__ == '__main__':
    device = torch.device("cpu")

    # 配置
    LR_SIZE = 128
    UPSCALE = 4
    PATCH_SIZE = 4

    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Resize((LR_SIZE, LR_SIZE)),
    ])

    img_path = sys.argv[1]
    #img = Image.open("img_089.png").convert("RGB")
    img = Image.open(img_path).convert("RGB")
    lr = transform(img).unsqueeze(0).to(device)

    start_time = time()

    # 模型
    model = SimpleViTSR(
        patch_size=PATCH_SIZE,
        embed_dim=96,
        num_layers=10,
        num_heads=8,
        window_size=8,
        upscale_factor=UPSCALE
    ).to(device)
    checkpoint = torch.load("sr_epoch_80.pth", map_location="cpu")  # map_location 自动适配CPU/GPU
    model.load_state_dict(checkpoint)
    model.eval()

    # 推理
    with torch.no_grad():
        sr, attn_list = model(lr)

    total_time = time() - start_time
    print(total_time)
    print("LR shape:", lr.shape)
    print("SR shape:", sr.shape)

    save_image(sr, 'output.png')

    orig = np.array(img)

    # 若值域为 [0, 1]，clamp 一下再保存（imsave 会自动处理值域 [0,1] 映射到 [0,255]）
    # plt.imsave('output.png', sr_np.clip(0, 255))

    plt.figure(figsize=(12, 4))
    plt.subplot(132), plt.imshow(orig), plt.title("LR Input"), plt.axis('off')

    plt.subplot(133), plt.imshow(sr[0].cpu().permute(1, 2, 0).numpy()), plt.title(f"SR x{UPSCALE}"), plt.axis('off')

    # plt.tight_layout()
    # plt.show()

    np.save("attn_list.npy", attn_list)

    # 保存 sr 为 tensor
    torch.save(sr.cpu(), "sr_result.pt")
