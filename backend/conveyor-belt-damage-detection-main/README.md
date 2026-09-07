# Conveyor Belt Damage Detection Pipeline

This repository contains a two-stage computer vision pipeline for detecting "scratch" and "edge_damage" on conveyor belts from day and night images.

## Problem Statement & Architecture

The provided dataset only contains bounding box annotations for the `belt_roi` (the outline of the conveyor belt), not the actual damage. To solve this "ROI Trap", this pipeline implements a two-stage approach:

1. **Stage 1 (ROI Extraction)**: A YOLOv8 model trained on the provided dataset to detect and crop the conveyor belt from the factory background.
2. **Stage 2 (Damage Detection)**: A second YOLOv8 model trained on manually annotated belt crops to detect the actual "scratch" and "edge_damage".

During inference, the pipeline maps the Stage 2 damage coordinates back to the original image dimensions to fulfill the exact JSON schema requirements.

## Process Flow (How we achieved the `outputs/`)

To build this pipeline and generate the final deliverables, the following step-by-step process was executed:

1. **Data Analysis**: Identified that the original dataset labels (`train/`) only contained polygons for the `belt_roi`, not the actual damage classes required (`scratch` and `edge_damage`).
2. **Stage 1 Training**: Trained a YOLOv8 model (`best_stage1_roi.pt`) to accurately detect and extract the conveyor belt region from the noisy factory background.
3. **Data Preparation**: Created `crop_script.py` to automatically crop the belt regions from the original images using the provided `belt_roi` labels, saving them to `data/cropped_belts/`.
4. **Manual Annotation**: Modified the open-source PyYAT tool to support rapid, manual bounding-box annotation of the cropped belts. Created a small, high-quality dataset of `scratch` and `edge_damage` labels in `data/stage2_dataset/`.
5. **Stage 2 Training**: Trained a second YOLOv8 model (`best_stage2_damage.pt`) specifically on these manually annotated crops to detect the two damage types.
6. **Inference Pipeline Development**: Built `pipeline.py` to chain the models together. It extracts the belt (Stage 1), detects damage on the crop (Stage 2), and mathematically maps the bounding box coordinates back to the original 4K image space.
7. **Final Output Generation**: Ran `pipeline.py` across the entire training dataset to generate the final annotated `.jpg` and `.json` files found in the `outputs/` directory, using a confidence threshold of `0.15` to balance recall and precision for the prototype.

## Setup

1. **Clone the repository** (or navigate to the project directory).
2. **Create a virtual environment** (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Validate setup** (optional):
   ```bash
   python validate_setup.py
   ```
   *This script checks if all required files and directories are in place.*

## Training the Models

### 1. Train Stage 1 (Belt ROI Model)

Run the training script and select option `1`. This will train a YOLOv8n model on the provided `train/` dataset.
```bash
python train.py
```
*The best weights will be saved as `best_stage1.pt` in the root directory.*

### 2. Prepare Data for Stage 2 (Manual Annotation)

Since the original dataset lacks damage labels, you must generate them for the Stage 2 model:

1. Run the cropping script to extract the belts using the existing `belt_roi` labels:
   ```bash
   python crop_script.py
   ```
   *This saves cropped belt images to `data/cropped_belts/`.*

2. Use the **modified PyYAT tool** to manually annotate these crops with "scratch" and "edge_damage":
   ```bash
   cd PyYAT-master
   python yolo_annotation_tool.py
   ```
   
   **PyYAT Controls:**
   - **Left Click + Drag**: Draw bounding box around damage
   - **'L' Key**: Switch between 'scratch' and 'edge_damage' labels
   - **'S' Key**: Save annotation and move to next image
   - **'R' Key**: Reset current annotations
   - **ESC**: Exit tool
   
   *The PyYAT tool has been pre-configured to load images from `../data/cropped_belts/` and save YOLO annotations to `../data/stage2_dataset/`. A `data.yaml` file is already created for training.*

### 3. Train Stage 2 (Damage Detection Model)

Once you have annotated the cropped belts, run the training script and select option `2`.
```bash
python train.py
```
*The best weights will be saved as `best_stage2.pt` in the root directory.*

## Inference Pipeline

To run the end-to-end inference pipeline on a directory of new images:

```bash
python pipeline.py --image_dir <path_to_image_folder> --output_dir <folder>
```

### Expected Output

For each image in the `--image_dir`, the pipeline will generate two files in the `--output_dir`:

1. **Annotated Image (`<image_name>.jpg`)**: The original image with bounding boxes overlaid on the detected damage.
2. **Detections JSON (`<image_name>.json`)**: A JSON file adhering strictly to the required schema:

```json
{
    "1": {
        "type": "scratch",
        "bbox_coordinates": [100, 200, 150, 250]
    },
    "2": {
        "type": "edge_damage",
        "bbox_coordinates": [300, 400, 350, 450]
    }
}
```
*Note: `bbox_coordinates` are in pixels `[x_min, y_min, x_max, y_max]` relative to the original image dimensions.*

## Files Structure After Setup

```
├── pipeline.py              # Main inference script
├── train.py                 # Training script
├── crop_script.py           # Belt cropping utility
├── requirements.txt         # Dependencies
├── README.md               # This file
├── src/
│   ├── models/             # Model wrapper classes
│   └── utils/              # Utility functions
├── data/
│   ├── cropped_belts/      # Cropped belt images (generated by crop_script.py)
│   └── stage2_dataset/     # Annotated damage dataset (generated by PyYAT)
├── PyYAT-master/           # Modified annotation tool
└── train/                  # Original dataset with belt_roi labels
```
