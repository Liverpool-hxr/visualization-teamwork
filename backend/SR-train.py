import glob
import os

import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.transforms as transforms
from PIL import Image
from torch.utils.data import Dataset, DataLoader
from tqdm import tqdm
import pandas as pd
import matplotlib.pyplot as plt
import torchmetrics
import numpy as np


def cubic(x):
    """Matlab 双三次插值核，Keys 公式，a=-0.5（与 Matlab 一致）"""
    absx = np.abs(x)
    absx2 = absx ** 2
    absx3 = absx ** 3
    return (
            (1.5 * absx3 - 2.5 * absx2 + 1) * (absx <= 1)
            + (-0.5 * absx3 + 2.5 * absx2 - 4 * absx + 2) * ((1 < absx) & (absx <= 2))
    )


def calculate_weights_indices(in_length, out_length, scale, kernel_width, antialiasing):
    """
    计算 imresize 所需的采样权重和索引，完全对齐 Matlab 行为。
    来源：BasicSR  utils/matlab_functions.py
    """
    if antialiasing and scale < 1:
        kernel_width = kernel_width / scale

    x = np.arange(1, out_length + 1, dtype=np.float64)
    u = x / scale + 0.5 * (1 - 1 / scale)

    left = np.floor(u - kernel_width / 2)
    P = int(np.ceil(kernel_width)) + 2

    indices = left[:, None] + np.arange(P)[None, :]  # [out_length, P]

    if antialiasing and scale < 1:
        weights = scale * cubic(scale * (u[:, None] - indices))
    else:
        weights = cubic(u[:, None] - indices)

    weights /= weights.sum(axis=1, keepdims=True)  # 归一化

    # 镜像填充处理越界索引
    indices = indices - 1  # 转为 0-based
    sym_len_s = -int(indices.min()) + 1
    sym_len_e = int(indices.max()) - (in_length - 1)
    indices = indices + sym_len_s - 1

    return weights.astype(np.float32), indices.astype(np.int64), sym_len_s, sym_len_e


def imresize_np(img, scale, antialiasing=True):
    """
    纯 NumPy 实现的 Matlab imresize（双三次，RGB float32 [H,W,C]，值域 [0,1]）。
    来源：BasicSR  utils/matlab_functions.py（略有整理）
    """
    in_H, in_W, in_C = img.shape
    out_H = int(round(in_H * scale))
    out_W = int(round(in_W * scale))

    kernel_width = 4
    img = img.astype(np.float64)

    # ── 水平方向 ──────────────────────────────────────────────────
    weights_W, indices_W, sym_s_W, sym_e_W = calculate_weights_indices(
        in_W, out_W, scale, kernel_width, antialiasing)

    img_pad_W = np.concatenate([
        img[:, 1:sym_s_W + 1, :][:, ::-1, :],
        img,
        img[:, -sym_e_W - 1:-1, :][:, ::-1, :] if sym_e_W > 0 else np.empty((in_H, 0, in_C))
    ], axis=1)

    out_H_temp = np.zeros((in_H, out_W, in_C))
    for j in range(out_W):
        w = weights_W[j]  # [P]
        idx = indices_W[j]  # [P]
        out_H_temp[:, j, :] = (img_pad_W[:, idx, :] * w[None, :, None]).sum(axis=1)

    # ── 垂直方向 ──────────────────────────────────────────────────
    weights_H, indices_H, sym_s_H, sym_e_H = calculate_weights_indices(
        in_H, out_H, scale, kernel_width, antialiasing)

    img_pad_H = np.concatenate([
        out_H_temp[1:sym_s_H + 1, :, :][::-1, :, :],
        out_H_temp,
        out_H_temp[-sym_e_H - 1:-1, :, :][::-1, :, :] if sym_e_H > 0 else np.empty((0, out_W, in_C))
    ], axis=0)

    out = np.zeros((out_H, out_W, in_C))
    for i in range(out_H):
        w = weights_H[i]
        idx = indices_H[i]
        out[i, :, :] = (img_pad_H[idx, :, :] * w[:, None, None]).sum(axis=0)

    return np.clip(out, 0, 1).astype(np.float32)


def matlab_imresize(hr_tensor, scale):
    """
    输入：FloatTensor [C, H, W]，值域 [0, 1]
    输出：FloatTensor [C, H', W']，与 Matlab imresize 对齐
    """
    img_np = hr_tensor.permute(1, 2, 0).numpy()  # [H, W, C]
    img_lr = imresize_np(img_np, scale)  # [H', W', C]
    return torch.from_numpy(img_lr).permute(2, 0, 1).float()


def print_gradients(model, max_params=10):
    print(f"{'Parameter Name':40} {'Shape':25} {'Grad Mean':10} {'Grad Std':10}")
    print("-" * 90)
    count = 0
    for name, param in model.named_parameters():
        if param.requires_grad:
            if param.grad is not None:
                grad_mean = param.grad.abs().mean().item()
                grad_std = param.grad.std().item()
            else:
                grad_mean = 0.0
                grad_std = 0.0
            print(f"{name:40} {str(param.shape):25} {grad_mean:12.2e} {grad_std:12.2e}")
            count += 1
            if count >= max_params:
                break
    print("-" * 90)


# =============================================================================
# 数据集
# =============================================================================

class TrainSRDataset(Dataset):
    def __init__(self, hr_dir, lr_size=64, scale=4):
        """
        hr_dir  : 高分辨率图像文件夹路径
        lr_size : LR patch 尺寸（默认 64）
        scale   : 上采样倍数（2 / 3 / 4）
        """
        super().__init__()
        self.lr_size = lr_size
        self.hr_size = lr_size * scale
        self.scale = scale

        self.img_paths = sorted(
            glob.glob(os.path.join(hr_dir, '*.png')) +
            glob.glob(os.path.join(hr_dir, '*.jpg')) +
            glob.glob(os.path.join(hr_dir, '*.bmp'))
        )

    def __len__(self):
        return len(self.img_paths)

    def __getitem__(self, idx):
        hr_img = Image.open(self.img_paths[idx]).convert('RGB')
        w, h = hr_img.size

        # ── 随机裁剪 HR patch ────────────────────────────────────
        if w < self.hr_size or h < self.hr_size:
            hr_img = hr_img.resize((self.hr_size, self.hr_size), Image.BICUBIC)
        else:
            left = torch.randint(0, w - self.hr_size + 1, (1,)).item()
            top = torch.randint(0, h - self.hr_size + 1, (1,)).item()
            hr_img = hr_img.crop((left, top, left + self.hr_size, top + self.hr_size))

        # ── 数据增强（官方标准：随机翻转 + 随机旋转 90°倍数） ──
        k = torch.randint(0, 4, (1,)).item()
        hr_img = hr_img.rotate(90 * k, expand=True)
        if torch.rand(1) > 0.5:
            hr_img = hr_img.transpose(Image.FLIP_LEFT_RIGHT)

        hr_tensor = transforms.ToTensor()(hr_img)  # [C, H, W]，值域 [0, 1]

        # ── LR 生成：Matlab-compatible 双三次（替换原 F.interpolate）──
        lr_tensor = matlab_imresize(hr_tensor, scale=1.0 / self.scale)

        return lr_tensor, hr_tensor


class TestSRDataset(Dataset):
    def __init__(self, hr_dir, scale=4):
        self.scale = scale
        self.img_paths = sorted(
            glob.glob(os.path.join(hr_dir, '*.png')) +
            glob.glob(os.path.join(hr_dir, '*.jpg')) +
            glob.glob(os.path.join(hr_dir, '*.bmp'))
        )

    def __len__(self):
        return len(self.img_paths)

    def __getitem__(self, idx):
        hr_img = Image.open(self.img_paths[idx]).convert('RGB')
        hr_tensor = transforms.ToTensor()(hr_img)  # [C, H, W]

        # ── 中心裁剪（如果需要）────────────────────────────────────
        _, h, w = hr_tensor.shape
        # 确保裁剪尺寸不超过原图
        crop_h = min(128, h)
        crop_w = min(128, w)
        start_h = (h - crop_h) // 2
        start_w = (w - crop_w) // 2
        hr_tensor = hr_tensor[:, start_h:start_h+crop_h, start_w:start_w+crop_w]

        # ── LR 生成：从裁剪后的 HR 下采样 ─────────────────────────
        lr_tensor = matlab_imresize(hr_tensor, scale=1.0 / self.scale)

        return lr_tensor, hr_tensor


# =============================================================================
# 数据加载
# =============================================================================

def get_train_loader(train_hr_dir, batch_size=16, lr_size=64, num_workers=2, scale=4):
    dataset = TrainSRDataset(train_hr_dir, lr_size=lr_size, scale=scale)
    return DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=num_workers)


def get_test_loader(test_hr_dir, batch_size=1, num_workers=2, scale=4):
    dataset = TestSRDataset(test_hr_dir, scale=scale)
    return DataLoader(dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers)


# =============================================================================
# 测试（官方标准：裁掉边缘 scale 个像素后再算 PSNR / SSIM）
# =============================================================================
def rgb_to_ycbcr(img):
    """img: [B,3,H,W], range [0,1] → Y: [B,1,H,W]"""
    coeff = torch.tensor([0.299, 0.587, 0.114], device=img.device).view(1, 3, 1, 1)
    return (img * coeff).sum(dim=1, keepdim=True)


def test(model, testloader, device, scale=4):
    """
    官方基准测试方案：
      1. 全图推理
      2. SR 与 HR 均裁掉边缘 scale 个像素（消除边缘伪影对指标的影响）
      3. 计算 Y 通道（亮度）PSNR / SSIM —— 此处仍用 RGB，与原代码保持一致；
         若要严格对齐论文需转 YCbCr 后只取 Y 通道。
    """
    model.eval()
    psnr_metric = torchmetrics.PeakSignalNoiseRatio(data_range=1.0).to(device)
    ssim_metric = torchmetrics.StructuralSimilarityIndexMeasure(
        data_range=1.0,
        kernel_size=11  # 标准设置
    ).to(device)

    psnr_total, ssim_total, count = 0.0, 0.0, 0
    border = scale  # 官方：裁掉四周各 scale 个像素

    with torch.no_grad():
        for lr, hr in testloader:
            lr, hr = lr.to(device), hr.to(device)
            sr, _ = model(lr)

            # ── 尺寸对齐（以防模型输出与 HR 不完全相同）────────
            _, _, h_sr, w_sr = sr.shape
            _, _, h_hr, w_hr = hr.shape
            min_h = min(h_sr, h_hr)
            min_w = min(w_sr, w_hr)
            sr = sr[:, :, :min_h, :min_w]
            hr = hr[:, :, :min_h, :min_w]

            # ── 官方边缘裁剪 ─────────────────────────────────────
            sr_crop = sr[:, :, border:-border, border:-border]
            hr_crop = hr[:, :, border:-border, border:-border]

            sr_y = rgb_to_ycbcr(sr_crop)
            hr_y = rgb_to_ycbcr(hr_crop)
            psnr = psnr_metric(sr_y, hr_y)
            ssim = ssim_metric(sr_y, hr_y)

            psnr_total += psnr.item()
            ssim_total += ssim.item()
            count += 1

    return psnr_total / max(count, 1), ssim_total / max(count, 1)


# =============================================================================
# 训练
# =============================================================================

def train(model, trainloader, testloader, criterion, optimizer, scheduler, device, epochs=50, scale=4):
    model.to(device)
    history = {"epoch": [], "train_loss": [], "psnr": [], "ssim": []}
    global_step = 0

    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        progress = tqdm(trainloader, desc=f"Epoch {epoch + 1}/{epochs}", ncols=120)

        for lr, hr in progress:
            global_step += 1
            lr, hr = lr.to(device), hr.to(device)
            sr, _ = model(lr)
            loss = criterion(sr, hr)

            optimizer.zero_grad()
            loss.backward()

            if (global_step + 1) % 2000 == 0 or global_step == 10:
                print(f"\n[Step {global_step}] Loss: {loss.item():.6f}")
                print_gradients(model, max_params=100000)

            optimizer.step()
            scheduler.step()

            running_loss += loss.item()
            progress.set_postfix(loss=f"{loss.item():.4f}")

        avg_loss = running_loss / len(trainloader)
        psnr, ssim = test(model, testloader, device, scale=scale)
        history["epoch"].append(epoch + 1)
        history["train_loss"].append(avg_loss)
        history["psnr"].append(psnr)
        history["ssim"].append(ssim)

        print(f"[Epoch {epoch + 1}] Loss: {avg_loss:.4f} | PSNR: {psnr:.2f} | SSIM: {ssim:.4f}")

        if (epoch + 1) % 20 == 0:
            ckpt_name = f"sr_epoch_{epoch + 1}.pth"
            torch.save(model.state_dict(), ckpt_name)
            print(f"已保存检查点: {ckpt_name}")

    df = pd.DataFrame(history)
    df.to_csv("sr_train_metrics_hxr.csv", index=False, encoding="utf-8-sig")

    plt.figure(figsize=(14, 7))
    ep = history["epoch"]
    plt.subplot(131);
    plt.plot(ep, history["train_loss"], 'b-o');
    plt.title("Train Loss")
    plt.subplot(132);
    plt.plot(ep, history["psnr"], 'r-o');
    plt.title("PSNR")
    plt.subplot(133);
    plt.plot(ep, history["ssim"], 'g-o');
    plt.title("SSIM")
    plt.tight_layout()
    plt.savefig("sr_train_curves_hxr.png", dpi=300)
    plt.close()


# -----------------------------
# 主函数
# -----------------------------
if __name__ == "__main__":
    from MultiVITSR import SimpleViTSR  # 你之前写的模型

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_hr_dir = r'D:\Flickr2K'  # 训练集 HR 文件夹
    test_hr_dir = r'D:\Set'  # 测试集 HR 文件夹（例如 Set5 的原图）

    upscale_factor = 4

    trainloader = get_train_loader(train_hr_dir, batch_size=8, lr_size=64, scale=upscale_factor)
    testloader = get_test_loader(test_hr_dir, batch_size=1)  # 测试时 batch_size 常用 1

    model = SimpleViTSR(patch_size=4, embed_dim=96, num_layers=10, num_heads=8, upscale_factor=upscale_factor,
                        window_size=8)
    checkpoint = torch.load("sr_epoch_200.pth", map_location="cpu")  # map_location 自动适配CPU/GPU
    model.load_state_dict(checkpoint)
    criterion = nn.L1Loss()
    # 优化器
    epochs = 200
    optimizer = optim.AdamW(
        model.parameters(),
        lr=2e-4,
        betas=(0.9, 0.99),  # β₂=0.99 是 SwinIR/HAT 论文的核心发现
        # weight_decay 不指定，即默认 0
        weight_decay=1e-4,
    )

    # 你当前 100 epoch × steps_per_epoch 步 ≈ 总步数 N
    # 按 SwinIR 比例，在 50%/80%/90%/95% 处各减半
    steps_per_epoch = len(trainloader)
    total_steps = epochs * steps_per_epoch

    milestones = [
        int(total_steps * 0.50),  # 第 50 轮结束
        int(total_steps * 0.80),  # 第 80 轮结束
        int(total_steps * 0.90),  # 第 90 轮结束
    ]
    scheduler = torch.optim.lr_scheduler.MultiStepLR(
        optimizer,
        milestones=milestones,
        gamma=0.75,  # 每次减半
    )

    '''scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=epochs * steps_per_epoch, eta_min=1e-6
    )
'''
    train(model, trainloader, testloader, criterion, optimizer, scheduler, device, epochs=epochs)

    torch.save(model.state_dict(), "sr_final.pth")
    print("最终模型权重已保存到 sr_final.pth")
