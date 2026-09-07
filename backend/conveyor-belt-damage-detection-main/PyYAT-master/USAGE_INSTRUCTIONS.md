# PyYAT Usage for Conveyor Belt Damage Annotation

This modified version of PyYAT has been configured specifically for annotating conveyor belt damage.

## Setup

The tool is now configured to:
- Load images from `../data/cropped_belts/` (the cropped belt images)
- Save annotations to `../data/stage2_dataset/` (for YOLO training)
- Use only two classes: `scratch` and `edge_damage`

## How to Use

1. First, make sure you have cropped the belt images by running the crop script from the main directory:
   ```bash
   cd ..
   python crop_script.py
   cd PyYAT-master
   ```

2. Run the annotation tool:
   ```bash
   python yolo_annotation_tool.py
   ```

## Controls

- **Left Click + Drag**: Draw bounding box around damage
- **'L' Key**: Switch between 'scratch' and 'edge_damage' labels
- **'S' Key**: Save annotation and move to next image
- **'R' Key**: Reset current annotations (start over on current image)
- **'X' Key**: Skip current image without saving
- **ESC**: Exit tool

## Classes

- **scratch**: Damage on the surface of the belt
- **edge_damage**: Damage on the edges/borders of the belt

## Output

Annotations are saved in YOLO format in `../data/stage2_dataset/` with:
- `.jpg` files: The annotated images
- `.txt` files: YOLO format labels (class_id x_center y_center width height)

The `data.yaml` file is already created for YOLO training.