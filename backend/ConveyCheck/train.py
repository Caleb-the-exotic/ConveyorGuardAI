import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from ripix_utils import (
    ResnetFeatureExtractor,
    read_yolo_polygon,
    polygon_to_mask,
    mask_and_crop,
    image_to_tensor,
    build_memory_bank,
    normalize_features,
    anomaly_map_from_features,
    save_json,
)


def iter_images(image_dir: Path):
    exts = {".jpg", ".jpeg", ".png", ".bmp"}
    for p in sorted(image_dir.iterdir()):
        if p.suffix.lower() in exts:
            yield p


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image_dir", required=True)
    parser.add_argument("--label_dir", required=True)
    parser.add_argument("--output_dir", required=True)
    parser.add_argument("--input_size", type=int, default=768)
    parser.add_argument("--max_patches", type=int, default=20000)
    parser.add_argument("--threshold_percentile", type=float, default=98.5)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--no_enhance", action="store_true", help="Disable contrast enhancement")
    args = parser.parse_args()

    image_dir = Path(args.image_dir)
    label_dir = Path(args.label_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=== TRAIN START ===")
    print("image_dir:", image_dir)
    print("label_dir:", label_dir)
    print("output_dir:", output_dir)
    print("input_size:", args.input_size)
    print("max_patches:", args.max_patches)
    print("threshold_percentile:", args.threshold_percentile)

    try:
        import torch

        if torch.cuda.is_available():
            args.device = "cuda"
    except Exception:
        pass

    print("device:", args.device)

    extractor = ResnetFeatureExtractor(device=args.device)

    all_patch_feats = []
    num_images = 0

    for img_path in iter_images(image_dir):
        label_path = label_dir / f"{img_path.stem}.txt"
        if not label_path.exists():
            continue

        img = Image.open(img_path).convert("RGB")
        pts = read_yolo_polygon(label_path)
        mask = polygon_to_mask(img.size, pts)
        cropped, _ = mask_and_crop(img, mask)
        if not args.no_enhance:
            from ripix_utils import enhance_image
            cropped = enhance_image(cropped)

        tensor = image_to_tensor(cropped, args.input_size)
        feat = extractor.extract(tensor)  # (1, C, H, W)
        feat = feat.squeeze(0).permute(1, 2, 0).reshape(-1, feat.shape[1])
        all_patch_feats.append(feat.cpu())
        num_images += 1
        if num_images % 50 == 0:
            print("processed_images:", num_images)

    print("total_images_used:", num_images)
    print("building_memory_bank...")
    memory_bank = build_memory_bank(all_patch_feats, max_patches=args.max_patches)
    _, mean, std = normalize_features(memory_bank)
    print("memory_bank_shape:", tuple(memory_bank.shape))

    print("computing_threshold...")
    all_scores = []
    for feat in all_patch_feats:
        scores = anomaly_map_from_features(feat, memory_bank, mean, std)
        all_scores.append(scores.cpu())
    all_scores = np.concatenate([s.numpy() for s in all_scores])
    threshold = float(np.percentile(all_scores, args.threshold_percentile))
    print("threshold_value:", threshold)

    try:
        import torch

        torch.save({
            "memory_bank": memory_bank,
            "mean": mean,
            "std": std,
            "input_size": args.input_size,
            "threshold": threshold,
        }, output_dir / "model.pt")
    except Exception as e:
        print("Failed to save model.pt:", e)

    save_json(output_dir / "config.json", {
        "input_size": args.input_size,
        "max_patches": args.max_patches,
        "threshold_percentile": args.threshold_percentile,
        "threshold": threshold,
        "device": args.device,
        "num_images": num_images,
    })

    print("Training complete.")
    print("Saved model to", output_dir / "model.pt")
    print("Threshold:", threshold)
    print("=== TRAIN END ===")


if __name__ == "__main__":
    main()
