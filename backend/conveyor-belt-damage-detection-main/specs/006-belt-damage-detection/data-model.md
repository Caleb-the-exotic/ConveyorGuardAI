# Phase 1: Data Model & Contracts

## Data Model

### 1. Image
- **Description**: The raw input image (day or night capture).
- **Format**: `.jpg` (or other standard image formats).
- **Dimensions**: Variable (e.g., 640x640 or original resolution).

### 2. Belt ROI (Region of Interest)
- **Description**: The bounding box representing the conveyor belt itself.
- **Format**: `[x_min, y_min, x_max, y_max]` in pixels.
- **Class**: `belt_roi` (Class ID 0 in Stage 1 model).

### 3. Damage Detection
- **Description**: A bounding box representing either a "scratch" or "edge_damage" along with its coordinates in pixels.
- **Format**: `[x_min, y_min, x_max, y_max]` in pixels relative to the *original* image.
- **Classes**: `scratch` (Class ID 0 in Stage 2 model), `edge_damage` (Class ID 1 in Stage 2 model).

## Interface Contracts

### CLI Contract: `pipeline.py`
- **Command**: `python pipeline.py --image_dir <path_to_image_folder> --output_dir <folder>`
- **Arguments**:
  - `--image_dir`: Path to the directory containing input images.
  - `--output_dir`: Path to the directory where outputs will be saved.

### Output Contract: Annotated Image
- **Format**: `.jpg`
- **Filename**: `<original_image_name>.jpg`
- **Content**: Original image with bounding boxes overlaid on each detected damage region.

### Output Contract: `detections.json`
- **Format**: JSON
- **Filename**: `<original_image_name>.json`
- **Schema**:
  ```json
  {
    "1": {
      "type": "scratch | edge_damage",
      "bbox_coordinates": [x_min, y_min, x_max, y_max]
    },
    "2": { ... }
  }
  ```
- **Rules**:
  - `bbox_coordinates` must be in pixels.
  - The detection index key ("1", "2", etc.) holds no significance beyond identification.
