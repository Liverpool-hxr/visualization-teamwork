"""
eval_sr.py —— 超分模型评估 (文件夹配对，适配 Urban100 命名)
用法: python eval_sr.py --model sr.pth --lr_dir ./LR --hr_dir ./HR --scale 4
"""
import os, re
import torch
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from torchvision import transforms
from torchmetrics.functional import peak_signal_noise_ratio, structural_similarity_index_measure
from tqdm import tqdm


class PairedFolder(Dataset):
    def __init__(self, lr_dir, hr_dir, exts=('.png','.jpg','.jpeg','.bmp','.tif')):
        # 不区分大小写列出所有图像文件
        def list_files(d):
            return sorted(f for f in os.listdir(d) if f.lower().endswith(exts))

        lr_files = list_files(lr_dir)
        hr_files = list_files(hr_dir)

        print(f"\nLR 文件夹: {len(lr_files)} 个文件")
        print(f"HR 文件夹: {len(hr_files)} 个文件")

        # 清洗名称：去掉扩展名，移除 _LR / _HR 等后缀，统一小写
        def clean(filename):
            name = os.path.splitext(filename)[0]
            # 匹配 _LR, _HR, _x4, _down4 等常见后缀并删除
            name = re.sub(r'_(LR|HR|x[2348]|down[2348]|bicubic)', '', name, flags=re.IGNORECASE)
            return name.lower()

        lr_map = {clean(f): os.path.join(lr_dir, f) for f in lr_files}
        hr_map = {clean(f): os.path.join(hr_dir, f) for f in hr_files}

        # 打印映射示例帮助调试
        if lr_files:
            sample_lr = lr_files[0]
            print(f"示例: {sample_lr} → {clean(sample_lr)}")
        if hr_files:
            sample_hr = hr_files[0]
            print(f"示例: {sample_hr} → {clean(sample_hr)}")

        common = sorted(set(lr_map) & set(hr_map))
        self.pairs = [(lr_map[k], hr_map[k]) for k in common]

        if not self.pairs:
            # 尝试直接按数字编号匹配（兜底）
            lr_num = {}
            hr_num = {}
            for k, v in lr_map.items():
                m = re.search(r'(\d+)', k)
                if m: lr_num[m.group(1)] = v
            for k, v in hr_map.items():
                m = re.search(r'(\d+)', k)
                if m: hr_num[m.group(1)] = v
            common_nums = set(lr_num) & set(hr_num)
            self.pairs = [(lr_num[n], hr_num[n]) for n in sorted(common_nums)]
            print(f"按数字编号匹配: {len(self.pairs)} 对")
        else:
            print(f"按名称匹配: {len(self.pairs)} 对")

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, idx):
        lr_path, hr_path = self.pairs[idx]
        lr = transforms.ToTensor()(Image.open(lr_path).convert('RGB'))
        hr = transforms.ToTensor()(Image.open(hr_path).convert('RGB'))
        return lr, hr, os.path.basename(lr_path)


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    psnr_model, ssim_model = [], []
    psnr_bic, ssim_bic = [], []

    for lr, hr, name in tqdm(loader, desc='评估'):
        lr, hr = lr.to(device), hr.to(device)
        sr, _ = model(lr)
        sr = sr.clamp(0, 1)
        if sr.shape != hr.shape:
            min_h = min(sr.shape[-2], hr.shape[-2])
            min_w = min(sr.shape[-1], hr.shape[-1])
            sr = sr[..., :min_h, :min_w]
            hr = hr[..., :min_h, :min_w]
        bic = F.interpolate(lr, size=hr.shape[-2:], mode='bicubic', align_corners=False).clamp(0, 1)

        psnr_sr = peak_signal_noise_ratio(sr, hr, data_range=1.0).item()
        ssim_sr = structural_similarity_index_measure(sr, hr, data_range=1.0).item()
        psnr_b = peak_signal_noise_ratio(bic, hr, data_range=1.0).item()
        ssim_b = structural_similarity_index_measure(bic, hr, data_range=1.0).item()

        psnr_model.append(psnr_sr)
        ssim_model.append(ssim_sr)
        psnr_bic.append(psnr_b)
        ssim_bic.append(ssim_b)

        print(f"{name[0]:30s} | SR PSNR:{psnr_sr:.2f} SSIM:{ssim_sr:.4f} | Bicubic PSNR:{psnr_b:.2f} SSIM:{ssim_b:.4f}")

    print("\n========== 平均结果 ==========")
    print(f"模型   : PSNR {torch.tensor(psnr_model).mean():.2f} dB, SSIM {torch.tensor(ssim_model).mean():.4f}")
    print(f"Bicubic: PSNR {torch.tensor(psnr_bic).mean():.2f} dB, SSIM {torch.tensor(ssim_bic).mean():.4f}")


if __name__ == '__main__':
    from backend.MultiVITSR import SimpleViTSR

    device = 'cpu'  # ← 自动选择

    model = SimpleViTSR(patch_size=2, embed_dim=96, num_layers=10, num_heads=8, upscale_factor=4,
                        window_size=8)

    # 直接加载 state_dict
    state_dict = torch.load("sr_epoch_60.pth", map_location='cpu')
    model.load_state_dict(state_dict)
    model.to(device)  # ← 关键！移到 GPU
    model.eval()

    # 路径替换成你自己的
    lr_dir = r'D:\Urban\Urban 100\X4 Urban100\X4\LOW x4 URban100'
    hr_dir = r'D:\Urban\Urban 100\X4 Urban100\X4\HIGH x4 URban100'

    dataset = PairedFolder(lr_dir, hr_dir)
    loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)

    evaluate(model, loader, device=device)