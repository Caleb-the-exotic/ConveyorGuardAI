import json
from pathlib import Path
from typing import List, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageOps

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def read_yolo_polygon(label_path: Path) -> List[Tuple[float, float]]:
    text = label_path.read_text().strip()
    if not text:
        return []
    line = text.splitlines()[0].strip()
    parts = line.split()
    if len(parts) < 3:
        return []
    coords = list(map(float, parts[1:]))
    pts = list(zip(coords[0::2], coords[1::2]))
    return pts


def polygon_to_mask(size: Tuple[int, int], pts_norm: List[Tuple[float, float]]) -> Image.Image:
    w, h = size
    if not pts_norm:
        return Image.new("L", (w, h), 0)
    pts = [(x * w, y * h) for x, y in pts_norm]
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon(pts, outline=255, fill=255)
    return mask


def mask_and_crop(image: Image.Image, mask: Image.Image, margin: int = 8):
    mask_np = np.array(mask)
    ys, xs = np.where(mask_np > 0)
    if len(xs) == 0 or len(ys) == 0:
        w, h = image.size
        return image.copy(), (0, 0, w, h)

    left = max(int(xs.min()) - margin, 0)
    top = max(int(ys.min()) - margin, 0)
    right = min(int(xs.max()) + margin + 1, image.size[0])
    bottom = min(int(ys.max()) + margin + 1, image.size[1])

    masked = Image.composite(image, Image.new("RGB", image.size, (0, 0, 0)), mask)
    cropped = masked.crop((left, top, right, bottom))
    return cropped, (left, top, right, bottom)


def image_to_tensor(image: Image.Image, size: int):
    import torch

    image = image.resize((size, size), Image.BILINEAR)
    arr = np.asarray(image).astype(np.float32) / 255.0
    mean = np.array(IMAGENET_MEAN, dtype=np.float32)
    std = np.array(IMAGENET_STD, dtype=np.float32)
    arr = (arr - mean) / std
    arr = np.transpose(arr, (2, 0, 1))
    tensor = torch.from_numpy(arr).float().unsqueeze(0)
    return tensor


def enhance_image(image: Image.Image, contrast: float = 1.3):
    """
    Lightweight contrast enhancement to make scratches more visible.
    Uses autocontrast + contrast boost. Pure PIL (no extra deps).
    """
    img = ImageOps.autocontrast(image)
    img = ImageEnhance.Contrast(img).enhance(contrast)
    return img


class ResnetFeatureExtractor:
    def __init__(self, device: str = "cpu"):
        import torch
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
        import torch

        with torch.no_grad():
            _ = self.backbone(tensor.to(self.device))
            feat = self._features
        return feat


def build_memory_bank(features_list, max_patches: int = 20000, seed: int = 0):
    import torch

    feats = torch.cat(features_list, dim=0)
    n = feats.shape[0]
    if n <= max_patches:
        return feats
    g = torch.Generator().manual_seed(seed)
    idx = torch.randperm(n, generator=g)[:max_patches]
    return feats[idx]


def normalize_features(feats, mean=None, std=None):
    if mean is None:
        mean = feats.mean(dim=0, keepdim=True)
    if std is None:
        std = feats.std(dim=0, keepdim=True) + 1e-6
    return (feats - mean) / std, mean, std


def anomaly_map_from_features(feats, memory_bank, mean, std, chunk_size: int = 4096):
    import torch

    device = feats.device
    memory_bank = memory_bank.to(device)
    mean = mean.to(device)
    std = std.to(device)

    feats = (feats - mean) / std
    memory = (memory_bank - mean) / std

    scores = []
    for i in range(0, feats.shape[0], chunk_size):
        chunk = feats[i:i + chunk_size]
        dists = torch.cdist(chunk, memory)
        min_dist, _ = dists.min(dim=1)
        scores.append(min_dist)
    return torch.cat(scores, dim=0)


def connected_components(binary_mask: np.ndarray):
    h, w = binary_mask.shape
    visited = np.zeros_like(binary_mask, dtype=bool)
    comps = []

    for y in range(h):
        for x in range(w):
            if not binary_mask[y, x] or visited[y, x]:
                continue
            stack = [(y, x)]
            visited[y, x] = True
            ys = []
            xs = []
            while stack:
                cy, cx = stack.pop()
                ys.append(cy)
                xs.append(cx)
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and binary_mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        stack.append((ny, nx))
            comps.append((np.array(ys), np.array(xs)))
    return comps


def save_json(path: Path, data: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        json.dump(data, f, indent=2)
