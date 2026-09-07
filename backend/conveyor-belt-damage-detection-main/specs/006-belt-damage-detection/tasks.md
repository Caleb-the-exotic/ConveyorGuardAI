---
description: "Task list template for feature implementation"
---

# Tasks: Conveyor Belt Damage Detection Pipeline

**Input**: Design documents from `/specs/006-belt-damage-detection/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

-[x] T001 Create project structure (`src/models`, `src/utils`) per implementation plan
-[x] T002 Initialize `requirements.txt` with PyTorch, Ultralytics, OpenCV, and other dependencies
-[x] T003 [P] Create empty `pipeline.py` and `train.py` at repository root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

-[x] T004 Implement coordinate mapping utilities in `src/utils/image_processing.py` (for mapping Stage 2 crop coordinates back to original image)
-[x] T005 [P] Implement JSON schema construction logic in `src/utils/json_formatter.py`
-[x] T006 Create base YOLOv8 model wrapper class in `src/models/base_model.py` (optional abstraction)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 3 - Manual Annotation for Damage Training (Priority: P3)

*Note: Executing US3 first as it generates the data required for US1 and US2's Stage 2 models.*

**Goal**: Use PyYAT to manually annotate extracted belt regions to train the Stage 2 damage detection model.

**Independent Test**: Can be tested by successfully exporting YOLO-format annotations for the damage classes and training a model (`train.py`) on them.

### Implementation for User Story 3

-[x] T007 [US3] Write script to crop all `train/` images using existing `belt_roi` labels and save to `data/cropped_belts/`
-[x] T008 [US3] Clone PyYAT repository (`https://github.com/2vin/PyYAT.git`) into a temporary workspace
-[x] T009 [US3] Manually annotate the cropped images in `data/cropped_belts/` with "scratch" and "edge_damage" using PyYAT
-[x] T010 [US3] Export the manual annotations to YOLO format in `data/stage2_dataset/`
-[x] T011 [US3] Implement Stage 2 training logic in `train.py` to train YOLOv8 on `data/stage2_dataset/`

**Checkpoint**: At this point, we have a trained Stage 2 model weight file (e.g., `best_stage2.pt`).

---

## Phase 4: User Story 2 - Two-Stage Detection (ROI Extraction + Damage Detection) (Priority: P2)

**Goal**: Implement the two-stage logic: extract belt using `belt_roi` model, then run damage detection on the crop.

**Independent Test**: Can be tested by verifying the intermediate step correctly crops/masks the belt region.

### Implementation for User Story 2

-[x] T012 [US2] Implement Stage 1 training logic in `train.py` to train YOLOv8 on original `train/` dataset for `belt_roi`
-[x] T013 [P] [US2] Implement `Stage1ROIModel` wrapper in `src/models/stage1_roi.py` to load weights and perform inference
-[x] T014 [P] [US2] Implement `Stage2DamageModel` wrapper in `src/models/stage2_damage.py` to load weights and perform inference
-[x] T015 [US2] Write integration logic in a temporary script or `pipeline.py` to pass Stage 1 crop to Stage 2 model

**Checkpoint**: Two-stage detection logic is functional.

---

## Phase 5: User Story 1 - End-to-End Inference Pipeline (Priority: P1) 🎯 MVP

**Goal**: CLI script (`pipeline.py`) to automatically detect and flag damage, outputting annotated `.jpg` and `.json`.

**Independent Test**: Run `python pipeline.py --image_dir <path> --output_dir <path>` and verify outputs.

### Implementation for User Story 1

-[x] T016 [US1] Implement `argparse` in `pipeline.py` to accept `--image_dir` and `--output_dir`
-[x] T017 [US1] Integrate `Stage1ROIModel` and `Stage2DamageModel` into the main loop of `pipeline.py`
-[x] T018 [US1] Integrate `src/utils/image_processing.py` to map Stage 2 coordinates back to original image space
-[x] T019 [US1] Integrate `src/utils/json_formatter.py` to generate `<image_name>.json` per image
-[x] T020 [US1] Add OpenCV logic in `pipeline.py` to draw bounding boxes and save `<image_name>.jpg`

**Checkpoint**: End-to-end CLI pipeline is fully functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

-[x] T021 [P] Write `README.md` with clear setup, training, and inference reproduction steps
-[x] T022 Code cleanup, adding docstrings and typing hints across `src/` and `pipeline.py`
-[x] T023 Verify pipeline handles edge cases (e.g., no belt detected in Stage 1) gracefully

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Story 3 (Phase 3)**: Depends on Foundational. Generates data for Stage 2.
- **User Story 2 (Phase 4)**: Depends on US3 (needs Stage 2 model weights).
- **User Story 1 (Phase 5)**: Depends on US2 (needs the two-stage logic).
- **Polish (Phase 6)**: Depends on all user stories being complete.

### Parallel Opportunities

- Setup tasks (T003) can run in parallel.
- Foundational tasks (T005) can run in parallel with T004.
- Model wrappers (T013, T014) can be implemented in parallel.
- `README.md` (T021) can be written in parallel with code cleanup.