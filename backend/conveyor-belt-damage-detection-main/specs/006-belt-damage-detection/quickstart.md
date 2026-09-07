# Quickstart: Conveyor Belt Damage Detection

## Prerequisites
- Python 3.10+
- PyTorch
- Ultralytics YOLOv8

## Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Training
1. **Stage 1 (Belt ROI)**: Train a YOLOv8 model on the provided `train/` dataset to detect `belt_roi`.
2. **Data Preparation**: Use PyYAT (https://github.com/2vin/PyYAT.git) to manually annotate the extracted belt regions to create the training data for the Stage 2 model.
3. **Stage 2 (Damage Detection)**: Train a YOLOv8 model on the manually annotated dataset to detect "scratch" and "edge_damage".

## Inference
Run the inference pipeline on a directory of images:
```bash
python pipeline.py --image_dir <path_to_image_folder> --output_dir <folder>
```
This will generate an annotated `.jpg` and a `<image_name>.json` for each image in the specified output directory.
