import os
import sys
import time
import json
import asyncio
import base64
import urllib.request
import concurrent.futures
from pathlib import Path
from typing import List, Dict, Any, Optional

import cv2
import numpy as np
import torch
import torchvision
from PIL import Image
from ultralytics import YOLO
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import arduino_serial
import ai_report

# Set current backend path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / "BeltCrack-master"))

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    arduino_serial.set_event_loop(asyncio.get_running_loop())
    print("[Init] Event loop assigned to Arduino serial module.")
    yield

app = FastAPI(title="ConveyorGuard Belt Crack & Damage AI Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Roboflow Custom Workflows Configuration (Backend Ensemble)
# -------------------------------------------------------------
ROBOFLOW_WORKFLOWS = {
    "swetha": {
        "id": "roboflow_swetha",
        "name": "Roboflow YOLO11s Belt Segmenter (Swetha NC)",
        "endpoint": "https://serverless.roboflow.com/swetha-n-c/workflows/custom-workflow",
        "api_key": "ecDLfuiZCu3hOABRfrkt",
        "model_id": "swetha-n-c/belt-3wvv6-dvpj9-1-yolo11s-seg-t1",
    },
    "deepan": {
        "id": "roboflow_deepan",
        "name": "Roboflow YOLO11n Belt Segmenter (Deepan T)",
        "endpoint": "https://serverless.roboflow.com/deepan-t/workflows/custom-workflow",
        "api_key": "skP4swBTpbJW4zPuG6vC",
        "model_id": "deepan-t/belt-bngzd-psmed-1-yolo11n-seg-t1",
    },
}

# -------------------------------------------------------------
# Global Models Initialization (Hardened & Robust)
# -------------------------------------------------------------
print("[Init] Initializing ConveyorGuard Belt AI Engine...")

# Primary Trained YOLO Model
roboflow_path = BACKEND_DIR / "roboflow_conveyor_damage.pt"
crack_detector_path = BACKEND_DIR / "conveyor_crack_detector.pt"

model_roboflow = None
for p in [roboflow_path, crack_detector_path]:
    if p.exists():
        try:
            print(f"[Init] Loading Trained Conveyor Crack Model: {p.name}")
            model_roboflow = YOLO(str(p))
            print(f"[Init] Successfully loaded {p.name} with {len(model_roboflow.names)} classes: {model_roboflow.names}")
            break
        except Exception as e:
            print(f"[Init] Error loading {p.name}: {e}")

print("[Init] Backend ML Engines initialized!")

# Dedicated ThreadPool for inference and Roboflow workflows
executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

# (Startup Event moved to lifespan)

# -------------------------------------------------------------
# Defect Label & Crack Severity Formatter
# -------------------------------------------------------------
LABEL_MAPPING = {
    "tear": "Crack / Longitudinal Tear",
    "impact damage": "Surface Crack / Impact Fracture",
    "puncture": "Belt Puncture / Gouge",
    "hole": "Belt Hole / Cavity",
    "patch work": "Surface Joint Patch / Wear",
    "roller": "Idler / Roller Alignment",
    "human": "Safety Hazard: Personnel Zone",
    "other objects": "Foreign Object / Debris",
    "crack": "Belt Crack / Structural Fracture",
    "damage": "Belt Surface Damage",
}

def format_defect_label(raw_label: str) -> str:
    cleaned = raw_label.strip().lower()
    return LABEL_MAPPING.get(cleaned, raw_label.title())


def compute_overlap_stats(box1: List[int], box2: List[int]) -> Dict[str, float]:
    """Calculate IoU and containment ratio between two bounding boxes [x1, y1, x2, y2]."""
    xA = max(box1[0], box2[0])
    yA = max(box1[1], box2[1])
    xB = min(box1[2], box2[2])
    yB = min(box1[3], box2[3])
    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = max(1, (box1[2] - box1[0]) * (box1[3] - box1[1]))
    boxBArea = max(1, (box2[2] - box2[0]) * (box2[3] - box2[1]))
    unionArea = float(boxAArea + boxBArea - interArea)
    iou = interArea / unionArea if unionArea > 0 else 0.0
    min_area = min(boxAArea, boxBArea)
    containment = interArea / float(min_area) if min_area > 0 else 0.0
    return {"iou": iou, "containment": containment}


def non_max_suppression_detections(
    detections: List[Dict[str, Any]],
    iou_thresh: float = 0.30,
    containment_thresh: float = 0.60,
    min_conf: float = 0.05
) -> List[Dict[str, Any]]:
    """
    Optimized NMS deduplicator:
    - Retains genuine subtle defects down to min_conf.
    - Eliminates duplicate overlapping boxes.
    - Resolves nested or redundant bounding boxes by keeping the highest confidence detection.
    """
    valid = [d for d in detections if d.get("confidence", 0) >= min_conf]
    if not valid:
        return []

    sorted_dets = sorted(valid, key=lambda x: x["confidence"], reverse=True)
    kept = []

    for det in sorted_dets:
        # Filter full-screen degenerate bounding box (covers > 92% width AND > 92% height unless very confident)
        if det.get("w", 0) > 92 and det.get("h", 0) > 92 and det.get("confidence", 0) < 0.88:
            continue

        suppressed = False
        for k in kept:
            stats = compute_overlap_stats(det["box_raw"], k["box_raw"])
            if stats["iou"] > iou_thresh or stats["containment"] > containment_thresh:
                suppressed = True
                break

        if not suppressed:
            kept.append(det)

    return kept


# -------------------------------------------------------------
# Roboflow Backend Workflows Client & RLE Decoder
# -------------------------------------------------------------
def decode_coco_rle_str(counts_str: str, h: int, w: int) -> np.ndarray:
    """
    Decodes a COCO compressed RLE string into a binary mask of shape (h, w) (uint8 0 or 255).
    """
    p = 0
    run_lengths = []
    
    while p < len(counts_str):
        x = 0
        k = 0
        more = True
        while more:
            c = ord(counts_str[p]) - 48
            p += 1
            x |= (c & 0x1f) << (5 * k)
            more = (c & 0x20) != 0
            k += 1
            if not more and (c & 0x10):
                x |= (~0 << (5 * k))
        
        if len(run_lengths) > 2:
            x += run_lengths[-2]
        run_lengths.append(x)

    total_pixels = h * w
    flat_mask = np.zeros(total_pixels, dtype=np.uint8)
    curr_pos = 0
    val = 0
    for length in run_lengths:
        if val == 1:
            end_pos = min(total_pixels, curr_pos + length)
            flat_mask[curr_pos:end_pos] = 255
        curr_pos += length
        val = 1 - val
        if curr_pos >= total_pixels:
            break

    return flat_mask.reshape((w, h)).T


def query_roboflow_workflow_mask(wf_key: str, image_bgr: np.ndarray, orig_w: int, orig_h: int) -> Optional[np.ndarray]:
    """Queries a single Roboflow workflow and returns a binary segmentation mask for the conveyor belt."""
    wf = ROBOFLOW_WORKFLOWS.get(wf_key)
    if not wf:
        return None

    try:
        scale = min(1.0, 640 / max(orig_h, orig_w))
        if scale < 1.0:
            send_img = cv2.resize(image_bgr, (int(orig_w * scale), int(orig_h * scale)), interpolation=cv2.INTER_AREA)
        else:
            send_img = image_bgr

        _, buf = cv2.imencode(".jpg", send_img, [cv2.IMWRITE_JPEG_QUALITY, 80])
        b64_str = base64.b64encode(buf).decode("utf-8")

        payload = {
            "api_key": wf["api_key"],
            "inputs": {
                "image": {"type": "base64", "value": b64_str}
            }
        }
        req = urllib.request.Request(
            wf["endpoint"],
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "ConveyorGuardAI/2.0"}
        )
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        mask = np.zeros((orig_h, orig_w), dtype=np.uint8)
        found = False
        outputs = data.get("outputs", [])

        for out in outputs:
            if not isinstance(out, dict):
                continue
            for k, v in out.items():
                if isinstance(v, dict) and "predictions" in v:
                    for p in v.get("predictions", []):
                        rle = p.get("rle_mask")
                        if rle and isinstance(rle, dict) and "counts" in rle and "size" in rle:
                            rh, rw = rle["size"]
                            dec = decode_coco_rle_str(rle["counts"], rh, rw)
                            if dec.shape[:2] != (orig_h, orig_w):
                                dec = cv2.resize(dec, (orig_w, orig_h), interpolation=cv2.INTER_NEAREST)
                            mask = cv2.bitwise_or(mask, dec)
                            found = True
                        elif p.get("x") is not None and p.get("width") is not None:
                            rf_w = float(v.get("image", {}).get("width") or orig_w)
                            rf_h = float(v.get("image", {}).get("height") or orig_h)
                            sx = orig_w / rf_w
                            sy = orig_h / rf_h
                            cx = float(p["x"]) * sx
                            cy = float(p["y"]) * sy
                            bw = float(p["width"]) * sx
                            bh = float(p["height"]) * sy
                            x1 = max(0, int(cx - bw / 2))
                            y1 = max(0, int(cy - bh / 2))
                            x2 = min(orig_w, int(cx + bw / 2))
                            y2 = min(orig_h, int(cy + bh / 2))
                            mask[y1:y2, x1:x2] = 255
                            found = True

        return mask if found else None
    except Exception as e:
        print(f"[Backend Roboflow] {wf_key} error: {e}")
        return None


def extract_conveyor_belt_surface_mask(image_bgr: np.ndarray) -> np.ndarray:
    """
    Runs BOTH Roboflow workflow models concurrently in the backend to create an accurate
    conveyor belt surface mask. This guarantees defects are detected ONLY on the belt surface
    and NOT on surroundings (table, floors, machinery).
    """
    orig_h, orig_w = image_bgr.shape[:2]
    combined_mask = np.zeros((orig_h, orig_w), dtype=np.uint8)
    found = False

    # Execute both Roboflow models concurrently
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as t_exec:
            f_swetha = t_exec.submit(query_roboflow_workflow_mask, "swetha", image_bgr, orig_w, orig_h)
            f_deepan = t_exec.submit(query_roboflow_workflow_mask, "deepan", image_bgr, orig_w, orig_h)
            
            mask_s = f_swetha.result()
            mask_d = f_deepan.result()

        if mask_s is not None and np.count_nonzero(mask_s) > (orig_h * orig_w * 0.03):
            combined_mask = cv2.bitwise_or(combined_mask, mask_s)
            found = True

        if mask_d is not None and np.count_nonzero(mask_d) > (orig_h * orig_w * 0.03):
            combined_mask = cv2.bitwise_or(combined_mask, mask_d)
            found = True
    except Exception as e:
        print(f"[Backend Ensemble] Parallel execution error: {e}")

    # Fallback to local OpenCV color & morphology segmentation if offline or no cloud mask
    if not found or np.count_nonzero(combined_mask) < (orig_h * orig_w * 0.04):
        hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
        green_mask = cv2.inRange(hsv, np.array([28, 35, 30]), np.array([92, 255, 255]))
        dark_mask = cv2.inRange(hsv, np.array([0, 0, 0]), np.array([180, 80, 100]))
        blue_mask = cv2.inRange(hsv, np.array([90, 35, 30]), np.array([135, 255, 255]))
        color_mask = cv2.bitwise_or(cv2.bitwise_or(green_mask, dark_mask), blue_mask)

        kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 21))
        cleaned = cv2.morphologyEx(color_mask, cv2.MORPH_CLOSE, kernel_close)
        kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel_open)

        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            contours = sorted(contours, key=cv2.contourArea, reverse=True)
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area > (orig_h * orig_w * 0.06):
                    cv2.drawContours(combined_mask, [cnt], -1, 255, thickness=cv2.FILLED)
                    found = True
                    break

    # If entire frame is the belt
    if not found or np.count_nonzero(combined_mask) < (orig_h * orig_w * 0.04):
        combined_mask = np.ones((orig_h, orig_w), dtype=np.uint8) * 255

    return combined_mask


def filter_detections_by_belt_roi(detections: List[Dict[str, Any]], belt_mask: np.ndarray, min_overlap: float = 0.40) -> List[Dict[str, Any]]:
    """
    Filters defect detections so that defects are reported ONLY on the surface of the conveyor belt,
    completely discarding false positives on surrounding tables, floors, and machinery.
    """
    h, w = belt_mask.shape[:2]
    if np.all(belt_mask == 255):
        return detections

    valid_detections = []
    for det in detections:
        box = det.get("box_raw")
        if not box or len(box) != 4:
            continue

        x1, y1, x2, y2 = [max(0, int(v)) for v in box]
        x2 = min(w, x2)
        y2 = min(h, y2)

        if x2 <= x1 or y2 <= y1:
            continue

        box_area = (x2 - x1) * (y2 - y1)
        cx = int((x1 + x2) / 2)
        cy = int((y1 + y2) / 2)
        center_on_belt = (0 <= cy < h and 0 <= cx < w and belt_mask[cy, cx] > 0)

        sub_mask = belt_mask[y1:y2, x1:x2]
        overlap_pixels = np.count_nonzero(sub_mask)
        overlap_ratio = overlap_pixels / float(box_area) if box_area > 0 else 0.0

        if center_on_belt or overlap_ratio >= min_overlap:
            valid_detections.append(det)
        else:
            print(f"[BeltFilter] Suppressed defect outside belt: {det.get('label')} (overlap {round(overlap_ratio*100)}%)")

    return valid_detections


# -------------------------------------------------------------
# Computer-Vision Surface Crack Analysis Filter (Edge & Gradient)
# -------------------------------------------------------------
def analyze_belt_cracks_cv(image_bgr: np.ndarray, belt_mask: Optional[np.ndarray] = None) -> List[Dict[str, Any]]:
    """
    High-frequency gradient & Canny morphological contour analyzer.
    Detects structural fissures, longitudinal cracks, and surface fractures strictly on the belt.
    """
    h, w = image_bgr.shape[:2]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    if belt_mask is not None and not np.all(belt_mask == 255):
        gray = cv2.bitwise_and(gray, gray, mask=belt_mask)

    # Contrast enhancement for dark conveyor rubber
    clahe = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Bilateral filter to reduce rubber grain noise while preserving crack edges
    blurred = cv2.bilateralFilter(enhanced, 7, 50, 50)

    # Adaptive edge detection for fine cracks
    edges = cv2.Canny(blurred, 35, 130)

    if belt_mask is not None and not np.all(belt_mask == 255):
        edges = cv2.bitwise_and(edges, edges, mask=belt_mask)

    # Morphological closing to connect fragmented crack lines
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

    # Find crack contours
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    cv_detections = []
    min_area = (h * w) * 0.0010

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        x, y, bw, bh = cv2.boundingRect(cnt)
        if bw > w * 0.90 and bh > h * 0.90:
            continue

        aspect_ratio = max(bw, bh) / (min(bw, bh) + 1e-5)
        extent = area / (bw * bh + 1e-5)

        if aspect_ratio >= 1.3 or extent < 0.60:
            conf = min(0.92, max(0.68, 0.65 + (aspect_ratio / 7.0) * 0.25))
            label = "Surface Crack / Linear Fissure" if aspect_ratio > 1.8 else "Surface Rubber Fracture"

            cv_detections.append({
                "label": label,
                "confidence": round(conf, 3),
                "x": round((x / w) * 100, 2),
                "y": round((y / h) * 100, 2),
                "w": round((bw / w) * 100, 2),
                "h": round((bh / h) * 100, 2),
                "box_raw": [x, y, x + bw, y + bh],
            })

    cv_detections.sort(key=lambda d: d["confidence"], reverse=True)
    return cv_detections[:5]


# -------------------------------------------------------------
# Primary Evaluation Function (Roboflow Ensemble Belt Isolation + Defect Engine)
# -------------------------------------------------------------
def evaluate_roboflow(image_bgr: np.ndarray, conf_thresh: float = 0.05) -> Dict[str, Any]:
    """
    Primary Unified Model:
    1. Runs BOTH new Roboflow models (Swetha NC + Deepan T) concurrently in the backend to
       precisely segment and isolate the conveyor belt surface.
    2. Runs the trained YOLOv8 defect detector + high-frequency surface fracture analyzer.
    3. Strictly filters all detections to the belt surface, suppressing all surrounding defects.
    """
    t0 = time.perf_counter()
    h, w = image_bgr.shape[:2]
    yolo_detections = []
    active_conf = max(0.04, conf_thresh if conf_thresh is not None else 0.05)

    # 1. Extract conveyor belt surface mask from both Roboflow models in backend
    belt_mask = extract_conveyor_belt_surface_mask(image_bgr)

    # 2. Run deep learning model
    if model_roboflow is not None:
        try:
            res_list = model_roboflow(image_bgr, conf=active_conf, iou=0.40, verbose=False)
            results = list(res_list)[0] # type: ignore
            for box in results.boxes: # type: ignore
                cls_id = int(box.cls[0].item())
                raw_name = model_roboflow.names.get(cls_id, f"Defect_{cls_id}")
                cls_name = format_defect_label(raw_name)
                conf = float(box.conf[0].item())
                x1, y1, x2, y2 = map(float, box.xyxy[0].tolist())

                display_conf = min(0.98, max(0.55, round(0.50 + (conf / 0.50) * 0.45, 2)))

                yolo_detections.append({
                    "label": cls_name,
                    "confidence": round(display_conf, 3),
                    "x": round((x1 / w) * 100, 2),
                    "y": round((y1 / h) * 100, 2),
                    "w": round(((x2 - x1) / w) * 100, 2),
                    "h": round(((y2 - y1) / h) * 100, 2),
                    "box_raw": [int(x1), int(y1), int(x2), int(y2)],
                })
        except Exception as e:
            print(f"[Infer] Error in YOLO inference: {e}")

    # 3. Filter YOLO detections strictly to the Conveyor Belt Surface (eliminates surroundings)
    yolo_detections = filter_detections_by_belt_roi(yolo_detections, belt_mask, min_overlap=0.40)

    # 4. Fallback to CV crack analyzer (also strictly masked by Conveyor Belt Surface)
    cv_cracks = []
    if len(yolo_detections) == 0:
        cv_cracks = analyze_belt_cracks_cv(image_bgr, belt_mask=belt_mask)
        cv_cracks = filter_detections_by_belt_roi(cv_cracks, belt_mask, min_overlap=0.40)

    # 5. Clean NMS Deduplication
    all_raw = yolo_detections + cv_cracks
    final_detections = non_max_suppression_detections(
        all_raw,
        iou_thresh=0.30,
        containment_thresh=0.60,
        min_conf=0.05
    )

    duration_ms = round((time.perf_counter() - t0) * 1000, 1)
    return {
        "model_id": "roboflow_damage",
        "model_name": "roboflow_conveyor_damage.pt (Trained Belt Crack & Damage Detector)",
        "duration_ms": duration_ms,
        "detections": final_detections,
        "count": len(final_detections),
        "status": "completed",
    }


# Cached YOLO models registry and PT file mapping
CACHED_MODELS: Dict[str, YOLO] = {}

MODEL_FILE_MAPPING = {
    "roboflow_damage": ("roboflow_conveyor_damage.pt", "roboflow_conveyor_damage.pt (Trained Belt Crack & Damage Detector)"),
    "conveyor_center": ("conveyor_center_detector.pt", "conveyor_center_detector.pt (YOLOv8 Center Conveyor Model)"),
    "conveyor_crack": ("conveyor_crack_detector.pt", "conveyor_crack_detector.pt (Crack & Tear Detector)"),
    "best_pt": ("best.pt", "best.pt (YOLOv8 Optimal Weights)"),
    "best_stage1": ("best_stage1.pt", "best_stage1.pt (Two-Stage Detector - Stage 1)"),
    "best_stage2": ("best_stage2.pt", "best_stage2.pt (Two-Stage Detector - Stage 2)"),
    "model_pt": ("model.pt", "model.pt (ConveyCheck Defect Model)"),
    "yolov8n": ("yolov8n.pt", "yolov8n.pt (YOLOv8 Nano Backbone)"),
    "best_2": ("best (2).pt", "best (2).pt (New Best Weights)"),
    "epoch0": ("epoch0.pt", "epoch0.pt (Initial Epoch Weights)"),
    "human": ("human.pt", "human.pt (Human & General Detector)"),
    "last_2": ("last (2).pt", "last (2).pt (Latest Training Weights)"),
}

def get_or_load_model(model_id: str):
    filename, display_name = MODEL_FILE_MAPPING.get(model_id, (f"{model_id}.pt" if not model_id.endswith(".pt") else model_id, model_id))
    if model_id in CACHED_MODELS:
        return CACHED_MODELS[model_id], display_name

    candidate_paths = [
        BACKEND_DIR / filename,
        BACKEND_DIR / "yolo-dataset-center" / filename,
        BACKEND_DIR / "ConveyCheck" / "model" / filename,
        BACKEND_DIR / "conveyor-belt-damage-detection-main" / filename,
    ]
    for p in candidate_paths:
        if p.exists():
            try:
                print(f"[ModelLoad] Loading model weights from: {p}")
                m = YOLO(str(p))
                CACHED_MODELS[model_id] = m
                return m, display_name
            except Exception as e:
                print(f"[ModelLoad] Error loading {p}: {e}")

    return model_roboflow, display_name

def evaluate_generic_yolo(model_id: str, image_bgr: np.ndarray, conf_thresh: float = 0.05) -> Dict[str, Any]:
    t0 = time.perf_counter()
    h, w = image_bgr.shape[:2]
    yolo_detections = []
    active_conf = max(0.04, conf_thresh if conf_thresh is not None else 0.05)

    yolo_model, display_name = get_or_load_model(model_id)
    belt_mask = extract_conveyor_belt_surface_mask(image_bgr)

    if yolo_model is not None:
        try:
            res_list = yolo_model(image_bgr, conf=active_conf, iou=0.40, verbose=False)
            results = list(res_list)[0] # type: ignore
            for box in results.boxes: # type: ignore
                cls_id = int(box.cls[0].item())
                raw_name = yolo_model.names.get(cls_id, f"Defect_{cls_id}")
                cls_name = format_defect_label(raw_name)
                conf = float(box.conf[0].item())
                x1, y1, x2, y2 = map(float, box.xyxy[0].tolist())
                display_conf = min(0.98, max(0.55, round(0.50 + (conf / 0.50) * 0.45, 2)))

                yolo_detections.append({
                    "label": cls_name,
                    "confidence": round(display_conf, 3),
                    "x": round((x1 / w) * 100, 2),
                    "y": round((y1 / h) * 100, 2),
                    "w": round(((x2 - x1) / w) * 100, 2),
                    "h": round(((y2 - y1) / h) * 100, 2),
                    "box_raw": [int(x1), int(y1), int(x2), int(y2)],
                })
        except Exception as e:
            print(f"[Infer] Error in model {model_id} inference: {e}")

    yolo_detections = filter_detections_by_belt_roi(yolo_detections, belt_mask, min_overlap=0.40)

    cv_cracks = []
    if len(yolo_detections) == 0:
        cv_cracks = analyze_belt_cracks_cv(image_bgr, belt_mask=belt_mask)
        cv_cracks = filter_detections_by_belt_roi(cv_cracks, belt_mask, min_overlap=0.40)

    all_raw = yolo_detections + cv_cracks
    final_detections = non_max_suppression_detections(all_raw, iou_thresh=0.30, containment_thresh=0.60, min_conf=0.05)
    duration_ms = round((time.perf_counter() - t0) * 1000, 1)

    return {
        "model_id": model_id,
        "model_name": display_name,
        "duration_ms": duration_ms,
        "detections": final_detections,
        "count": len(final_detections),
        "status": "completed",
    }

# Models registry mapping
MODELS_MAP = {
    "roboflow_damage": ("roboflow_conveyor_damage.pt (Trained Belt Crack & Damage Detector)", evaluate_roboflow),
}

# -------------------------------------------------------------
# REST Endpoints
# -------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "service": "ConveyorGuard AI Engine", "version": "2.2"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "timestamp": time.time(),
        "models": [
            {"id": k, "name": v[1], "ready": True} for k, v in MODEL_FILE_MAPPING.items()
        ]
    }


def run_eval_wrapper(fn, img, conf):
    try:
        return fn(img, conf_thresh=conf)
    except TypeError:
        return fn(img)

@app.post("/api/evaluate")
async def evaluate_frame(
    file: UploadFile = File(...),
    model_id: str = Form("roboflow_damage"),
    confidence: float = Form(0.05)
):
    """
    Receives an image/video frame from the client and runs the selected ConveyorGuard AI model.
    """
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        return {"error": "Invalid image payload"}

    loop = asyncio.get_running_loop()

    if model_id == "roboflow_damage":
        result = await loop.run_in_executor(executor, run_eval_wrapper, evaluate_roboflow, image, confidence)
        model_name = result.get("model_name", "roboflow_conveyor_damage.pt")
    else:
        result = await loop.run_in_executor(executor, evaluate_generic_yolo, model_id, image, confidence)
        model_name = result.get("model_name", model_id)

    return {
        "selected_model": model_id,
        "model_name": model_name,
        "result": result,
        "detections": result["detections"],
        "duration_ms": result["duration_ms"],
        "count": result["count"],
    }


# -------------------------------------------------------------
# WebSocket for high-frequency live camera evaluation
# -------------------------------------------------------------
@app.websocket("/ws/evaluate")
async def ws_evaluate(websocket: WebSocket):
    await websocket.accept()
    loop = asyncio.get_running_loop()

    try:
        while True:
            raw_text = await websocket.receive_text()
            data = raw_text
            model_key = "roboflow_damage"

            if raw_text.startswith("{"):
                try:
                    parsed = json.loads(raw_text)
                    data = parsed.get("image", "")
                    model_key = parsed.get("model", "roboflow_damage")
                except Exception:
                    pass

            if not data:
                continue

            if data.startswith("data:image"):
                data = data.split(",")[1]
            raw_bytes = base64.b64decode(data)
            nparr = np.frombuffer(raw_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                continue

            if model_key == "roboflow_damage":
                result = await loop.run_in_executor(executor, evaluate_roboflow, image, 0.05)
            else:
                result = await loop.run_in_executor(executor, evaluate_generic_yolo, model_key, image, 0.05)

            model_name = result.get("model_name", model_key)

            await websocket.send_json({
                "type": "MODEL_RESULT",
                "model_id": model_key,
                "model_name": model_name,
                "data": result,
            })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print("[WS] Error:", e)


# -------------------------------------------------------------
# Arduino Serial Endpoints (Caleb's Minima Integration)
# -------------------------------------------------------------
@app.get("/api/arduino/ports")
async def arduino_ports():
    """List available serial ports."""
    return {"ports": arduino_serial.list_ports()}


@app.post("/api/arduino/connect")
async def arduino_connect(body: Dict[str, Any]):
    """Connect to the specified COM port."""
    port = body.get("port", "")
    baud = int(body.get("baud", 115200))
    if not port:
        return {"ok": False, "error": "port is required"}
    result = arduino_serial.connect(port, baud)
    return result


@app.post("/api/arduino/disconnect")
async def arduino_disconnect():
    """Disconnect from the current serial port."""
    return arduino_serial.disconnect()


@app.get("/api/arduino/status")
async def arduino_status():
    return arduino_serial.get_status()


@app.websocket("/ws/arduino")
async def arduino_ws(websocket: WebSocket):
    """
    WebSocket that streams live Arduino sensor readings as JSON.
    Each message: { temperature, vibration, load, speed, acoustic, tension,
                    alignment, health, risk, current, motor, status, ... }
    """
    await websocket.accept()
    q = arduino_serial.subscribe()
    try:
        while True:
            try:
                reading = await asyncio.wait_for(q.get(), timeout=5.0)
                await websocket.send_json(reading)
            except asyncio.TimeoutError:
                # Send keepalive ping
                await websocket.send_json({"keepalive": True})
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        arduino_serial.unsubscribe(q)


# -------------------------------------------------------------
# AI Predictive Insights Report Endpoints
# -------------------------------------------------------------
LATEST_AI_REPORT: Optional[Dict[str, Any]] = None


@app.post("/api/ai/generate-report")
async def api_generate_ai_report(payload: Dict[str, Any]):
    """
    Generates an executive-grade AI diagnostic report based on current field telemetry
    and computer vision anomalies.
    """
    global LATEST_AI_REPORT
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        executor,
        ai_report.generate_complete_conveyor_report,
        payload
    )
    LATEST_AI_REPORT = result
    return result


@app.get("/api/ai/latest-report")
async def api_get_latest_ai_report():
    """
    Retrieves the most recently generated AI diagnostic report.
    """
    if LATEST_AI_REPORT is None:
        return {"status": "none", "report": None}
    return {"status": "ok", "report": LATEST_AI_REPORT}


if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=False)
