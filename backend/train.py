import torch
import torch.nn as nn
import torch.optim as optim
import torchvision
import torchvision.transforms as transforms
from torch.utils.data import DataLoader
from einops import rearrange
from tqdm import tqdm

from MultiVITCLS import SimpleViT
import pandas as pd
import matplotlib.pyplot as plt
# -----------------------------
# 数据加载
# -----------------------------
def get_dataloaders(batch_size=64):
    transform_train = transforms.Compose([
        transforms.Resize((128,128)),
        transforms.RandomCrop(128, padding=16),  # 标准增强
        transforms.RandomHorizontalFlip(),  # 水平翻转
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.5071, 0.4865, 0.4409],
            std=[0.2673, 0.2564, 0.2762]
        ),
    ])
    transform_test = transforms.Compose([
        transforms.Resize((128, 128)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.5071, 0.4865, 0.4409],
            std=[0.2673, 0.2564, 0.2762]
        ),
    ])
    trainset = torchvision.datasets.CIFAR100(root='./data', train=True, download=True, transform=transform_train)
    testset = torchvision.datasets.CIFAR100(root='./data', train=False, download=True, transform=transform_test)

    trainloader = DataLoader(trainset, batch_size=batch_size, shuffle=True)
    testloader = DataLoader(testset, batch_size=batch_size, shuffle=False)
    return trainloader, testloader


# -----------------------------
# 测试函数
# -----------------------------
def test(model, testloader, device, topk=(1,5)):
    model.eval()
    correct_top1 = 0
    correct_top5 = 0
    total = 0

    with torch.no_grad():
        for images, labels in testloader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)

            # Top 1
            _, pred1 = outputs.topk(1, dim=1)
            correct_top1 += (pred1 == labels.view(-1,1)).sum().item()

            # Top 5
            _, pred5 = outputs.topk(5, dim=1)
            correct_top5 += (pred5 == labels.view(-1,1)).sum().item()

            total += labels.size(0)

    acc1 = 100 * correct_top1 / total
    acc5 = 100 * correct_top5 / total
    return acc1, acc5


# -----------------------------
# 训练函数（新增：每10 epoch保存权重 + 每epoch测试）
# -----------------------------
def train(model, trainloader, testloader, criterion, optimizer, scheduler, device, epochs=50):
    model.to(device)
    # 记录每一轮的指标
    history = {
        "epoch": [],
        "train_loss": [],
        "test_acc": [],
        "test_acc_top5": [],
    }

    for epoch in range(epochs):
        model.train()
        running_loss = 0.0

        progress = tqdm(trainloader, desc=f"Epoch {epoch+1}/{epochs}", ncols=120)

        for images, labels in progress:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            progress.set_postfix(loss=f"{loss.item():.4f}")

        """for name, param in model.named_parameters():
            if param.requires_grad:
                print(f"{name}: mean={param.data.mean():.4f}, std={param.data.std():.4f}")"""

        avg_loss = running_loss / len(trainloader)
        test_acc, test_acc_top5 = test(model, testloader, device)

        # 保存记录
        history["epoch"].append(epoch + 1)
        history["train_loss"].append(avg_loss)
        history["test_acc"].append(test_acc)
        history["test_acc_top5"].append(test_acc_top5)

        print(f"[Epoch {epoch + 1}] Loss: {avg_loss:.4f} | Acc1: {test_acc:.2f}% | Acc5: {test_acc_top5:.2f}% ")

        scheduler.step()

        # ---- 每 5 epoch 保存一次 ----
        if (epoch + 1) % 5 == 0:
            ckpt_name = f"simplevit_epoch_{epoch+1}.pth"
            torch.save(model.state_dict(), ckpt_name)
            print(f"已保存检查点: {ckpt_name}")

    # 保存CSV
    df = pd.DataFrame(history)
    df.to_csv("train_all_metrics.csv", index=False, encoding="utf-8-sig")

    # ==================== 一张图绘制所有指标 ====================
    plt.figure(figsize=(14, 7))
    epochs = history["epoch"]

    # 左Y轴：Loss
    ax1 = plt.gca()
    line1 = ax1.plot(epochs, history["train_loss"], 'b-o', label="Train Loss", linewidth=2, markersize=4)
    ax1.set_xlabel("Epoch", fontsize=12)
    ax1.set_ylabel("Loss", color="blue", fontsize=12)
    ax1.tick_params(axis='y', labelcolor="blue")

    # 右Y轴：准确率 + Top5 + LR
    ax2 = ax1.twinx()
    line2 = ax2.plot(epochs, history["test_acc"], 'r-o', label="Test Acc@1", linewidth=2, markersize=4)
    line3 = ax2.plot(epochs, history["test_acc_top5"], 'g-o', label="Test Acc@5", linewidth=2, markersize=4)

    ax2.set_ylabel("Accuracy (%) / LR", color="red", fontsize=12)
    ax2.tick_params(axis='y', labelcolor="red")

    # 合并图例
    lines = line1 + line2 + line3
    labels = [l.get_label() for l in lines]
    ax1.legend(lines, labels, loc="upper left", fontsize=11)

    plt.title("Train Loss + Test Acc@1 + Test Acc@5", fontsize=14)
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig("train_all_in_one.png", dpi=300)
    plt.close()



# -----------------------------
# 主函数
# -----------------------------
if __name__ == "__main__":
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    trainloader, testloader = get_dataloaders(batch_size=64)
    print(device)



    model = SimpleViT(img_size=128, patch_size=8, num_classes=100, embed_dim=128, num_heads=8, layer=2, stage=4)
    # model.load_state_dict(torch.load("simplevit_epoch_20.pth", map_location=device))
    model.to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=5e-4, weight_decay=1e-5)

    # 添加学习率调度器
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=5)

    train(model, trainloader, testloader, criterion, optimizer, scheduler, device, epochs=5)

    # 最终权重保存
    torch.save(model.state_dict(), "simplevit_final.pth")
    print("最终模型权重已保存到 simplevit_final.pth")