import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from ripix_utils import (
    ResnetFeatureExtractor,
    read_yolo_polygon,
    polygon_to_mask,
    mask_and_crop,
    image_to_tensor,
    anomaly_map_from_features,
    connected_components,
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
    parser.add_argument("--output_dir", required=True)
    parser.add_argument("--label_dir", default="train/train/labels", help="Belt ROI labels")
    parser.add_argument("--model_dir", default="model")
    parser.add_argument("--min_area", type=int, default=80)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--no_enhance", action="store_true", help="Disable contrast enhancement")
    args = parser.parse_args()

    image_dir = Path(args.image_dir)
    output_dir = Path(args.output_dir)
    label_dir = Path(args.label_dir)
    model_dir = Path(args.model_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=== ANOMALY PIPELINE START ===")
    print("image_dir:", image_dir)
    print("label_dir:", label_dir)
    print("model_dir:", model_dir)
    print("output_dir:", output_dir)
    print("min_area:", args.min_area)

    try:
        import torch

        if torch.cuda.is_available():
            args.device = "cuda"
    except Exception:
        pass

    print("device:", args.device)

    import torch

    model = torch.load(model_dir / "model.pt", map_location="cpu")
    memory_bank = model["memory_bank"]
    mean = model["mean"]
    std = model["std"]
    input_size = int(model["input_size"])
    threshold = float(model["threshold"])

    print("model_loaded: True")
    print("input_size:", input_size)
    print("threshold:", threshold)

    extractor = ResnetFeatureExtractor(device=args.device)

    num_images = 0
    for img_path in iter_images(image_dir):
        img = Image.open(img_path).convert("RGB")
        label_path = label_dir / f"{img_path.stem}.txt"
        if label_path.exists():
            pts = read_yolo_polygon(label_path)
            mask = polygon_to_mask(img.size, pts)
        else:
            mask = Image.new("L", img.size, 255)

        cropped, crop_box = mask_and_crop(img, mask)
        if not args.no_enhance:
            from ripix_utils import enhance_image
            cropped = enhance_image(cropped)
        tensor = image_to_tensor(cropped, input_size)
        feat = extractor.extract(tensor)  # (1, C, H, W)
        h_feat, w_feat = feat.shape[2], feat.shape[3]
        feat = feat.squeeze(0).permute(1, 2, 0).reshape(-1, feat.shape[1])

        scores = anomaly_map_from_features(feat, memory_bank, mean, std)
        scores = scores.reshape(h_feat, w_feat).cpu().numpy()

        scores_t = torch.from_numpy(scores).unsqueeze(0).unsqueeze(0)
        scores_t = torch.nn.functional.interpolate(
            scores_t,
            size=(cropped.size[1], cropped.size[0]),
            mode="bilinear",
            align_corners=False,
        )
        anomaly = scores_t.squeeze(0).squeeze(0).cpu().numpy()

        binary = anomaly > threshold
        comps = connected_components(binary)

        draw = ImageDraw.Draw(img)
        detections = {}
        det_idx = 1
        for ys, xs in comps:
            if len(xs) < args.min_area:
                continue
            x_min = int(xs.min())
            y_min = int(ys.min())
            x_max = int(xs.max()) + 1
            y_max = int(ys.max()) + 1

            left, top, _, _ = crop_box
            scale_x = cropped.size[0] / anomaly.shape[1]
            scale_y = cropped.size[1] / anomaly.shape[0]
            x_min = int(left + x_min * scale_x)
            x_max = int(left + x_max * scale_x)
            y_min = int(top + y_min * scale_y)
            y_max = int(top + y_max * scale_y)

            detections[str(det_idx)] = {
                "bbox_coordinates": [x_min, y_min, x_max, y_max]
            }
            det_idx += 1

            draw.rectangle([x_min, y_min, x_max, y_max], outline="red", width=3)

        out_img_path = output_dir / f"{img_path.stem}.jpg"
        out_json_path = output_dir / f"{img_path.stem}.json"
        img.save(out_img_path)
        save_json(out_json_path, detections)

        num_images += 1
        print("processed:", img_path.name, "detections:", len(detections))

    print("total_images_processed:", num_images)
    print("=== ANOMALY PIPELINE END ===")


if __name__ == "__main__":
    main()
