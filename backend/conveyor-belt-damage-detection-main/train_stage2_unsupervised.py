"""
Unsupervised Stage 2 Training - Memory Bank Approach
Reuses ConveyCheck's ResNet feature extractor + memory bank for anomaly detection.
"""
import argparse
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from ultralytics import YOLO

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


class ResnetFeatureExtractor:
    def __init__(self, device="cpu"):
        import torchvision
        self.device = torch.device(device)
        try:
            self.backbone = torchvision.models.resnet18(weights=torchvision.models.ResNet18_Weights.IMAGENET1K_V1)
        except Exception:
            self.backbone = torchvision.models.resnet18(weights=None)
        self.backbone.eval().to(self.device).float()
        self._features = None

        def hook_fn(_module, _inp, out):
            self._features = out
        self.backbone.layer3.register_forward_hook(hook_fn)

    def extract(self, tensor):
        with torch.no_grad():
            _ = self.backbone(tensor.to(self.device))
            return self._features


def image_to_tensor(image, size=512):
    image = image.resize((size, size), Image.BILINEAR)
    arr = np.asarray(image).astype(np.float32) / 255.0
    mean = np.array(IMAGENET_MEAN, dtype=np.float32)
    std = np.array(IMAGENET_STD, dtype=np.float32)
    arr = (arr - mean) / std
    arr = np.transpose(arr, (2, 0, 1))
    return torch.from_numpy(arr).float().unsqueeze(0)


def build_memory_bank(features_list, max_patches=20000, seed=0):
    feats = torch.cat(features_list, dim=0)
    n = feats.shape[0]
    if n <= max_patches:
        return feats
    g = torch.Generator().manual_seed(seed)
    idx = torch.randperm(n, generator=g)[:max_patches]
    return feats[idx]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage1_weights", default="best_stage1.pt")
    parser.add_argument("--image_dir", required=True)
    parser.add_argument("--output", default="best_stage2.pt")
    parser.add_argument("--input_size", type=int, default=512)
    parser.add_argument("--max_patches", type=int, default=10000)
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--device", default="cpu")
    args = parser.parse_args()

    try:
        if torch.cuda.is_available():
            args.device = "cuda"
    except Exception:
        pass

    print("=== STAGE 2 UNSUPERVISED TRAINING ===")
    print("Loading Stage 1 model:", args.stage1_weights)
    stage1_model = YOLO(args.stage1_weights)

    print("Loading ResNet feature extractor...")
    extractor = ResnetFeatureExtractor(device=args.device)

    image_dir = Path(args.image_dir)
    exts = {".jpg", ".jpeg", ".png", ".bmp"}
    image_paths = sorted([p for p in image_dir.iterdir() if p.suffix.lower() in exts])

    print(f"Found {len(image_paths)} images")
    all_patch_feats = []
    num_crops = 0

    for i, img_path in enumerate(image_paths):
        img = Image.open(img_path).convert("RGB")
        img_np = np.array(img)

        results = stage1_model.predict(img_np, conf=args.conf, verbose=False)
        if len(results[0].boxes) == 0:
            continue

        best_box = results[0].boxes[0]
        x_min, y_min, x_max, y_max = map(int, best_box.xyxy[0].tolist())
        h, w = img_np.shape[:2]
        x_min, y_min = max(0, x_min), max(0, y_min)
        x_max, y_max = min(w, x_max), min(h, y_max)

        crop = img_np[y_min:y_max, x_min:x_max]
        if crop.size == 0:
            continue

        crop_pil = Image.fromarray(crop)
        tensor = image_to_tensor(crop_pil, args.input_size)
        feat = extractor.extract(tensor)
        feat = feat.squeeze(0).permute(1, 2, 0).reshape(-1, feat.shape[1])
        all_patch_feats.append(feat.cpu())
        num_crops += 1

        if (i + 1) % 50 == 0:
            print(f"Processed {i + 1}/{len(image_paths)} images, {num_crops} crops")

    print(f"Total crops: {num_crops}")
    print("Building memory bank...")
    memory_bank = build_memory_bank(all_patch_feats, max_patches=args.max_patches)

    mean = memory_bank.mean(dim=0, keepdim=True)
    std = memory_bank.std(dim=0, keepdim=True) + 1e-6

    print("Computing threshold...")
    all_scores = []
    for feat in all_patch_feats:
        feats_norm = (feat - mean) / std
        memory_norm = (memory_bank - mean) / std
        dists = torch.cdist(feats_norm, memory_norm)
        min_dist, _ = dists.min(dim=1)
        all_scores.append(min_dist.cpu())

    all_scores = np.concatenate([s.numpy() for s in all_scores])
    threshold = float(np.percentile(all_scores, 98.5))

    torch.save({
        "memory_bank": memory_bank,
        "mean": mean,
        "std": std,
        "input_size": args.input_size,
        "threshold": threshold,
    }, args.output)

    print(f"Saved Stage 2 model to {args.output}")
    print(f"Memory bank shape: {tuple(memory_bank.shape)}")
    print(f"Threshold: {threshold}")
    print("=== STAGE 2 TRAINING COMPLETE ===")


if __name__ == "__main__":
    main()
