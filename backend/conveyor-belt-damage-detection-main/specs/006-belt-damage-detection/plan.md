# Implementation Plan: Conveyor Belt Damage Detection Pipeline

**Branch**: `006-belt-damage-detection` | **Date**: 2026-04-03 | **Spec**: [specs/006-belt-damage-detection/spec.md](specs/006-belt-damage-detection/spec.md)
**Input**: Feature specification from `/specs/006-belt-damage-detection/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The system will implement a two-stage computer vision architecture using PyTorch and Ultralytics YOLOv8. Stage 1 will extract the belt ROI using the existing `belt_roi` labels in the `train/` directory. A data preparation phase will utilize the PyYAT tool (https://github.com/2vin/PyYAT.git) to manually annotate the extracted belt regions to create the training data for the Stage 2 model. Stage 2 will then detect "scratch" and "edge_damage" on the extracted belt. The inference script (`pipeline.py`) will use `argparse` to accept `--image_dir` and `--output_dir`, and will construct the nested JSON schema by mapping Stage 2 coordinates back to the original image dimensions.

## Technical Context

**Language/Version**: Python 3.10+
**Primary Dependencies**: PyTorch, Ultralytics (YOLOv8), OpenCV, argparse, JSON
**Storage**: Local file system (images, JSON, YOLO labels)
**Testing**: Unit tests for coordinate mapping and JSON schema validation
**Target Platform**: CLI (Linux/macOS/Windows)
**Project Type**: CLI Pipeline
**Performance Goals**: Reasonable inference speed (e.g., < 1s per image on CPU)
**Constraints**: Two-stage detection required due to missing damage labels in the original dataset.
**Scale/Scope**: Processing directories of day/night conveyor belt images.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Code Quality**: The pipeline will be modular, separating ROI extraction, damage detection, and coordinate mapping into distinct functions.
- **Testing Standards**: Unit tests will verify the coordinate mapping logic (Stage 2 to original image space) and the JSON schema structure.
- **User Experience Consistency**: The CLI will strictly adhere to the requested arguments (`--image_dir`, `--output_dir`).
- **Performance Requirements**: YOLOv8 is chosen for its efficient inference speed.

## Project Structure

### Documentation (this feature)

```text
specs/006-belt-damage-detection/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── models/
│   ├── stage1_roi.py       # YOLOv8 model wrapper for belt extraction
│   └── stage2_damage.py    # YOLOv8 model wrapper for damage detection
├── utils/
│   ├── image_processing.py # Cropping and coordinate mapping utilities
│   └── json_formatter.py   # JSON schema construction
├── pipeline.py             # Main inference CLI script
└── train.py                # Training script for both stages
```

**Structure Decision**: A single project structure is chosen, with a `src/` directory containing the core logic, and `pipeline.py` and `train.py` at the root for easy execution.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Two-stage pipeline | The provided dataset lacks damage labels | A single-stage model cannot learn to detect damage without labels. Unsupervised anomaly detection is less precise than supervised YOLO. |
