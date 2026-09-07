# Feature Specification: Conveyor Belt Damage Detection Pipeline

**Feature Branch**: `006-belt-damage-detection`  
**Created**: 2026-04-03  
**Status**: Draft  
**Input**: User description: "Conveyor belt damage pipeline with ROI extraction and damage detection"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - End-to-End Inference Pipeline (Priority: P1)

As an end-user, I want to run a CLI script (`pipeline.py`) on a directory of images to automatically detect and flag "scratch" and "edge_damage" on conveyor belts, so that I can quickly identify damaged belts without manual inspection.

**Why this priority**: This is the core deliverable of the assignment and the primary way the model will be evaluated.

**Independent Test**: Can be fully tested by running `python pipeline.py --image_dir <path> --output_dir <path>` on a sample dataset and verifying the generated `.jpg` and `.json` files.

**Acceptance Scenarios**:

1. **Given** a directory of day/night conveyor belt images, **When** I run `pipeline.py`, **Then** it generates an annotated `.jpg` for each image with bounding boxes overlaid on the damage.
2. **Given** a directory of images, **When** I run `pipeline.py`, **Then** it generates a `<image_name>.json` file for each image containing a dictionary of detections with "type" and "bbox_coordinates".

---

### User Story 2 - Two-Stage Detection (ROI Extraction + Damage Detection) (Priority: P2)

As a computer vision engineer, I need the system to first extract the belt region using the provided `belt_roi` annotations (or a model trained on them), and then perform damage detection exclusively on the extracted belt, so that the model doesn't get confused by the background.

**Why this priority**: The provided dataset only has `belt_roi` labels. A two-stage approach is necessary to isolate the belt before finding the actual damage.

**Independent Test**: Can be tested by verifying that the intermediate step correctly crops/masks the belt region, ignoring the factory background.

**Acceptance Scenarios**:

1. **Given** an input image, **When** processed by the first stage, **Then** the system successfully isolates the conveyor belt from the background.
2. **Given** an isolated belt image, **When** processed by the second stage, **Then** the system accurately identifies scratches and edge damage.

---

### User Story 3 - Manual Annotation for Damage Training (Priority: P3)

As a data scientist, I want the option to use a manual annotation tool (like PyYAT) to label "scratch" and "edge_damage" on the extracted belt regions, so that I can train a supervised object detection model for the second stage.

**Why this priority**: Since the original dataset lacks damage labels, creating a small annotated subset is a viable strategy for training the damage detection model.

**Independent Test**: Can be tested by successfully exporting YOLO-format annotations for the damage classes and training a model (`train.py`) on them.

**Acceptance Scenarios**:

1. **Given** extracted belt images, **When** I use the annotation tool, **Then** I can generate YOLO-format labels for "scratch" and "edge_damage".
2. **Given** the new damage dataset, **When** I run `train.py`, **Then** the model successfully learns to detect the damage classes.

### Edge Cases

- What happens when an image contains no conveyor belt?
- How does the system handle images with extreme lighting conditions (e.g., very dark night images or overexposed day images)?
- What happens if the `belt_roi` extraction fails or is inaccurate?
- How does the system handle multiple instances of damage on the same belt?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a CLI script `pipeline.py` that accepts `--image_dir` and `--output_dir` arguments.
- **FR-002**: System MUST output an annotated `.jpg` image with bounding boxes for each detected damage region.
- **FR-003**: System MUST output a `<image_name>.json` file for each image with the exact schema: `{"1": {"type": "scratch | edge_damage", "bbox_coordinates": [x_min, y_min, x_max, y_max]}}`.
- **FR-004**: System MUST handle both day and night captures effectively.
- **FR-005**: System MUST implement a two-stage approach: extracting the `belt_roi` first, then detecting the damage.
- **FR-006**: System MUST include a `train.py` script (or notebook) with instructions to reproduce the training process.
- **FR-007**: System MUST include a `README.md` detailing setup, training, and inference reproduction steps.

### Key Entities

- **Image**: The raw input image (day or night capture).
- **Belt ROI**: The region of interest representing the conveyor belt itself.
- **Damage Detection**: A bounding box representing either a "scratch" or "edge_damage" along with its coordinates in pixels.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `pipeline.py` successfully runs on a directory of images without crashing and produces the exact required output formats.
- **SC-002**: The JSON output strictly adheres to the requested schema (dictionary of detections, correct keys, pixel coordinates).
- **SC-003**: The model achieves reasonable accuracy in distinguishing between "scratch" (surface) and "edge_damage" (borders) across both day and night images.
- **SC-004**: The `README.md` provides clear, reproducible steps that allow a third party to run the training and inference pipelines successfully.
