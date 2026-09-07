# Phase 0: Research & Architecture Decisions

## Decision 1: Two-Stage Object Detection Architecture
- **Decision**: Implement a two-stage computer vision pipeline using Ultralytics YOLOv8.
- **Rationale**: The provided `train/` dataset only contains labels for `belt_roi`. A single-stage model cannot detect damage without damage labels. A two-stage approach allows us to first extract the belt region (Stage 1) and then run a separate damage detection model exclusively on the cropped belt (Stage 2). YOLOv8 is chosen for its speed, accuracy, and ease of use via the `ultralytics` package.
- **Alternatives considered**: Traditional CV techniques (edge detection, thresholding) for Stage 2 were considered but rejected because "scratch" and "edge_damage" can vary significantly in appearance, making deep learning (YOLO) more robust.

## Decision 2: Data Preparation for Stage 2 (PyYAT)
- **Decision**: Utilize the PyYAT tool (https://github.com/2vin/PyYAT.git) to manually annotate the extracted belt regions.
- **Rationale**: To train the Stage 2 YOLOv8 model, we need bounding box annotations for "scratch" and "edge_damage". PyYAT provides a semi-automatic way to quickly draw YOLO-format bounding boxes on the cropped belt images. This creates the necessary ground truth dataset for Stage 2.
- **Alternatives considered**: Unsupervised anomaly detection (e.g., Autoencoders, PatchCore) was considered to avoid manual labeling, but supervised object detection (YOLO) provides more precise bounding boxes and classification ("scratch" vs "edge_damage") as required by the JSON schema.

## Decision 3: Inference Pipeline & CLI Arguments
- **Decision**: Use Python's built-in `argparse` for `pipeline.py` to strictly accept `--image_dir` and `--output_dir`.
- **Rationale**: Meets the exact requirements specified in the feature spec and PDF.
- **Alternatives considered**: `click` or `typer` were considered but `argparse` requires no additional dependencies.

## Decision 4: JSON Output Schema Construction
- **Decision**: During inference, map Stage 2 bounding box coordinates back to the original image dimensions before saving to JSON.
- **Rationale**: Since Stage 2 operates on a cropped/extracted belt region, its bounding box coordinates are relative to the crop. To fulfill the requirement of `[x_min, y_min, x_max, y_max]` in the original image space, we must add the `(x_min, y_min)` offset of the Stage 1 crop to the Stage 2 coordinates. The JSON will be constructed as a nested dictionary keyed by an incremental index.
- **Alternatives considered**: N/A. The schema is strictly dictated by the requirements.
