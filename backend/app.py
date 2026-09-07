import os
import sys
import time
import asyncio
import base64
import concurrent.futures
from pathlib import Path
from typing import List, Dict, Any

import cv2
import numpy as np
import torch
import torchvision
from PIL import Image
from ultralytics import YOLO
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Set current backend path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / "BeltCrack-master"))

from nets.yolo import YoloBody
from utils.utils_bbox import decode_outputs, non_max_suppression

app = FastAPI(title="ConveyorGuard 4-Model Inference API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Global Models Initialization
# -------------------------------------------------------------
print("[Init] Loading 4 Conveyor Belt ML Models...")

# Model 1: best_stage1.pt (Ultralytics YOLOv8n Belt ROI & Defect Detector)
stage1_path = BACKEND_DIR / "best_stage1.pt"
print(f"[Init] Loading Model 1: {stage1_path.name}")
model_stage1 = YOLO(str(stage1_path))

# Model 0: roboflow_conveyor_damage.pt (Newly Trained YOLO Model)
roboflow_path = BACKEND_DIR / "roboflow_conveyor_damage.pt"
print(f"[Init] Loading Roboflow Model: {roboflow_path.name}")
model_roboflow = YOLO(str(roboflow_path)) if roboflow_path.exists() else None

# Feature extractor for ResNet-based models (Stage 2 and model.pt)
class ResNetFeatureExtractor:
    def __init__(self, device="cpu"):
        self.device = torch.device(device)
        try:
            self.backbone = torchvision.models.resnet18(weights=torchvision.models.ResNet18_Weights.IMAGENET1K_V1)
        except Exception:
            self.backbone = torchvision.models.resnet18(weights=None)
        self.backbone.eval().to(self.device).float()
        self._features = None
        def hook_fn(_m, _inp, out):
            self._features = out
        self.backbone.layer3.register_forward_hook(hook_fn)

    def extract(self, tensor):
        with torch.no_grad():
            self.backbone(tensor.to(self.device))
            return self._features

resnet_extractor = ResNetFeatureExtractor(device="cpu")

# Model 2: best_stage2.pt (PatchCore Memory Bank Anomaly Detector)
stage2_path = BACKEND_DIR / "best_stage2.pt"
print(f"[Init] Loading Model 2: {stage2_path.name}")
ckpt_stage2 = torch.load(str(stage2_path), map_location="cpu", weights_only=False)
model_stage2_data = {
    "memory_bank": ckpt_stage2["memory_bank"].float(),
    "mean": ckpt_stage2["mean"].float(),
    "std": ckpt_stage2["std"].float(),
    "input_size": int(ckpt_stage2.get("input_size", 512)),
    "threshold": float(ckpt_stage2.get("threshold", 29.5)),
}

# Model 3: model.pt (ConveyCheck Visual Inspection Memory Bank)
model_pt_path = BACKEND_DIR / "model.pt"
print(f"[Init] Loading Model 3: {model_pt_path.name}")
ckpt_model_pt = torch.load(str(model_pt_path), map_location="cpu", weights_only=False)
model_model_pt_data = {
    "memory_bank": ckpt_model_pt["memory_bank"].float(),
    "mean": ckpt_model_pt["mean"].float(),
    "std": ckpt_model_pt["std"].float(),
    "input_size": int(ckpt_model_pt.get("input_size", 512)),
    "threshold": float(ckpt_model_pt.get("threshold", 26.1)),
}

# Model 4: yolox_s.pth (YOLOX-S Belt Crack/Structural Defect Detector)
yolox_path = BACKEND_DIR / "yolox_s.pth"
print(f"[Init] Loading Model 4: {yolox_path.name}")
net_yolox = YoloBody(num_classes=80, phi="s")
sd_yolox = torch.load(str(yolox_path), map_location="cpu")
if isinstance(sd_yolox, dict) and "model" in sd_yolox:
    sd_yolox = sd_yolox["model"]
net_yolox.load_state_dict(sd_yolox, strict=False)
net_yolox.eval().float()

print("[Init] All 4 models loaded into memory successfully!")

# Dedicated ThreadPool for simultaneous evaluation
executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

# -------------------------------------------------------------
# Individual Model Evaluation Functions
# -------------------------------------------------------------

def evaluate_stage1(image_bgr: np.ndarray) -> Dict[str, Any]:
    """Model 1: best_stage1.pt (YOLOv8)"""
    t0 = time.perf_counter()
    h, w = image_bgr.shape[:2]
    results = model_stage1(image_bgr, conf=0.15, verbose=False)[0]

    detections = []
    for box in results.boxes:
        cls_id = int(box.cls[0].item())
        cls_name = model_stage1.names.get(cls_id, f"defect_{cls_id}")
        conf = float(box.conf[0].item())
        x1, y1, x2, y2 = map(float, box.xyxy[0].tolist())

        # Normalize to 0-100% for responsive UI placement
        detections.append({
            "label": cls_name,
            "confidence": round(conf, 3),
            "x": round((x1 / w) * 100, 2),
            "y": round((y1 / h) * 100, 2),
            "w": round(((x2 - x1) / w) * 100, 2),
            "h": round(((y2 - y1) / h) * 100, 2),
            "box_raw": [int(x1), int(y1), int(x2), int(y2)],
        })

    duration_ms = round((time.perf_counter() - t0) * 1000, 1)
    return {
        "model_id": "stage1",
        "model_name": "best_stage1.pt (YOLOv8 Belt ROI)",
        "duration_ms": duration_ms,
        "detections": detections,
        "count": len(detections),
        "status": "completed",
    }


def evaluate_roboflow(image_bgr: np.ndarray) -> Dict[str, Any]:
    """Model: roboflow_conveyor_damage.pt (Custom YOLOv8)"""
    t0 = time.perf_counter()
    if model_roboflow is None:
        return {
            "model_id": "roboflow_damage",
            "model_name": "roboflow_conveyor_damage.pt",
            "duration_ms": 0,
            "detections": [],
            "count": 0,
            "status": "not_loaded",
        }

    h, w = image_bgr.shape[:2]
    results = model_roboflow(image_bgr, conf=0.20, verbose=False)[0]

    detections = []
    for box in results.boxes:
        cls_id = int(box.cls[0].item())
        cls_name = model_roboflow.names.get(cls_id, f"damage_{cls_id}")
        conf = float(box.conf[0].item())
        x1, y1, x2, y2 = map(float, box.xyxy[0].tolist())

        detections.append({
            "label": cls_name,
            "confidence": round(conf, 3),
            "x": round((x1 / w) * 100, 2),
            "y": round((y1 / h) * 100, 2),
            "w": round(((x2 - x1) / w) * 100, 2),
            "h": round(((y2 - y1) / h) * 100, 2),
            "box_raw": [int(x1), int(y1), int(x2), int(y2)],
        })

    duration_ms = round((time.perf_counter() - t0) * 1000, 1)
    return {
        "model_id": "roboflow_damage",
        "model_name": "roboflow_conveyor_damage.pt (Trained Belt Damage)",
        "duration_ms": duration_ms,
        "detections": detections,
        "count": len(detections),
        "status": "completed",
    }


def _run_memory_bank_anomaly(image_bgr: np.ndarray, model_data: dict, model_id: str, model_name: str) -> Dict[str, Any]:
    """Shared pipeline for PatchCore memory bank anomaly detection (Stage 2 and model.pt)"""
    t0 = time.perf_counter()
    h, w = image_bgr.shape[:2]
    input_size = model_data["input_size"]

    # Preprocess with OpenCV
    resized = cv2.resize(image_bgr, (input_size, input_size), interpolation=cv2.INTER_LINEAR)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    norm = (rgb.astype(np.float32) / 255.0 - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    tensor = torch.from_numpy(norm.transpose(2, 0, 1)).unsqueeze(0).float()

    feat = resnet_extractor.extract(tensor) # (1, 256, H_f, W_f)
    h_f, w_f = feat.shape[2], feat.shape[3]
    feat_flat = feat.squeeze(0).permute(1, 2, 0).reshape(-1, feat.shape[1]) # (H_f*W_f, 256)

    mb = model_data["memory_bank"]
    mean = model_data["mean"]
    std = model_data["std"]

    feat_norm = (feat_flat - mean) / std
    mb_norm = (mb - mean) / std

    # Calculate patch-level distance to nearest normal pattern
    dists = torch.cdist(feat_norm, mb_norm)
    min_dist, _ = dists.min(dim=1)
    scores_map = min_dist.reshape(h_f, w_f).numpy()

    # Interpolate anomaly heat to input size
    heat = cv2.resize(scores_map, (w, h), interpolation=cv2.INTER_CUBIC)
    thresh = model_data["threshold"]
    binary_mask = (heat > (thresh * 0.82)).astype(np.uint8)

    # Connected components for anomaly bounding boxes
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary_mask)
    detections = []
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < 80:  # noise filter
            continue
        x = stats[i, cv2.CC_STAT_LEFT]
        y = stats[i, cv2.CC_STAT_TOP]
        bw = stats[i, cv2.CC_STAT_WIDTH]
        bh = stats[i, cv2.CC_STAT_HEIGHT]
        peak_score = float(heat[y:y+bh, x:x+bw].max())
        confidence = min(0.99, max(0.60, (peak_score - (thresh * 0.8)) / (thresh * 0.5 + 1e-5)))

        detections.append({
            "label": "Belt Anomaly / Wear",
            "confidence": round(confidence, 3),
            "x": round((x / w) * 100, 2),
            "y": round((y / h) * 100, 2),
            "w": round((bw / w) * 100, 2),
            "h": round((bh / h) * 100, 2),
            "box_raw": [int(x), int(y), int(x + bw), int(y + bh)],
        })

    duration_ms = round((time.perf_counter() - t0) * 1000, 1)
    return {
        "model_id": model_id,
        "model_name": model_name,
        "duration_ms": duration_ms,
        "detections": detections,
        "count": len(detections),
        "status": "completed",
    }


def evaluate_stage2(image_bgr: np.ndarray) -> Dict[str, Any]:
    """Model 2: best_stage2.pt (Stage 2 PatchCore Memory Bank)"""
    return _run_memory_bank_anomaly(image_bgr, model_stage2_data, "stage2", "best_stage2.pt (PatchCore)")


def evaluate_model_pt(image_bgr: np.ndarray) -> Dict[str, Any]:
    """Model 3: model.pt (ConveyCheck Anomaly Detector)"""
    return _run_memory_bank_anomaly(image_bgr, model_model_pt_data, "model_pt", "model.pt (ConveyCheck)")


def evaluate_yolox(image_bgr: np.ndarray) -> Dict[str, Any]:
    """Model 4: yolox_s.pth (YOLOX-S Surface Crack Detector)"""
    t0 = time.perf_counter()
    h, w = image_bgr.shape[:2]

    # Preprocess for YOLOX
    in_size = (512, 512)
    resized = cv2.resize(image_bgr, in_size, interpolation=cv2.INTER_LINEAR)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    tensor = torch.from_numpy(rgb.transpose(2, 0, 1)).unsqueeze(0).unsqueeze(2).float() # (1, 3, 1, 512, 512)

    with torch.no_grad():
        raw_outputs = net_yolox(tensor)
        outputs = decode_outputs(raw_outputs, in_size)
        results = non_max_suppression(
            outputs, 80, in_size,
            image_shape=[h, w],
            letterbox_image=False,
            conf_thres=0.18,
            nms_thres=0.3
        )

    detections = []
    if results and results[0] is not None and len(results[0]) > 0:
        for res in results[0]:
            x1, y1, x2, y2, obj_conf, class_conf, class_pred = res
            conf = float(obj_conf * class_conf)
            detections.append({
                "label": "Belt Crack / Fracture",
                "confidence": round(conf, 3),
                "x": round((float(x1) / w) * 100, 2),
                "y": round((float(y1) / h) * 100, 2),
                "w": round(((float(x2) - float(x1)) / w) * 100, 2),
                "h": round(((float(y2) - float(y1)) / h) * 100, 2),
                "box_raw": [int(x1), int(y1), int(x2), int(y2)],
            })

    duration_ms = round((time.perf_counter() - t0) * 1000, 1)
    return {
        "model_id": "yolox",
        "model_name": "yolox_s.pth (YOLOX-S Crack Det)",
        "duration_ms": duration_ms,
        "detections": detections,
        "count": len(detections),
        "status": "completed",
    }


MODELS_MAP = {
    "roboflow_damage": ("roboflow_conveyor_damage.pt (Trained Belt Damage)", evaluate_roboflow),
    "stage1": ("best_stage1.pt (YOLOv8 Belt ROI)", evaluate_stage1),
    "stage2": ("best_stage2.pt (PatchCore Memory Bank)", evaluate_stage2),
    "model_pt": ("model.pt (ConveyCheck Visual Inspection)", evaluate_model_pt),
    "yolox": ("yolox_s.pth (YOLOX-S Crack Detector)", evaluate_yolox),
}

# -------------------------------------------------------------
# REST Endpoint: Single Model Execution
# -------------------------------------------------------------
@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": [
            {"id": "roboflow_damage", "name": "roboflow_conveyor_damage.pt (Trained Belt Damage)"},
            {"id": "stage1", "name": "best_stage1.pt (YOLOv8 Belt ROI)"},
            {"id": "stage2", "name": "best_stage2.pt (PatchCore Memory Bank)"},
            {"id": "model_pt", "name": "model.pt (ConveyCheck Visual Inspection)"},
            {"id": "yolox", "name": "yolox_s.pth (YOLOX-S Crack Detector)"},
        ]
    }


@app.post("/api/evaluate")
async def evaluate_frame(
    file: UploadFile = File(...),
    model_id: str = Form("stage1")
):
    """
    Receives an image/video frame from the client and runs the user-selected model.
    """
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        return {"error": "Invalid image payload"}

    if model_id not in MODELS_MAP:
        model_id = "stage1"

    model_name, eval_fn = MODELS_MAP[model_id]

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(executor, eval_fn, image)

    return {
        "selected_model": model_id,
        "model_name": model_name,
        "result": result,
        "detections": result["detections"],
        "duration_ms": result["duration_ms"],
        "count": result["count"],
    }


# -------------------------------------------------------------
# WebSocket for high-frequency live camera evaluation with selected model
# -------------------------------------------------------------
@app.websocket("/ws/evaluate")
async def ws_evaluate(websocket: WebSocket):
    await websocket.accept()
    loop = asyncio.get_running_loop()
    current_model = "stage1"

    try:
        while True:
            # Format can be JSON object with { "image": "...", "model": "stage1" } or raw base64 string
            raw_text = await websocket.receive_text()
            model_to_use = current_model
            data = raw_text

            if raw_text.startswith("{"):
                try:
                    import json
                    parsed = json.loads(raw_text)
                    if "model" in parsed:
                        current_model = parsed["model"]
                        model_to_use = current_model
                    data = parsed.get("image", "")
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

            if model_to_use not in MODELS_MAP:
                model_to_use = "stage1"

            model_name, eval_fn = MODELS_MAP[model_to_use]

            # Execute solely the selected model
            result = await loop.run_in_executor(executor, eval_fn, image)

            await websocket.send_json({
                "type": "MODEL_RESULT",
                "model_id": model_to_use,
                "model_name": model_name,
                "data": result,
            })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print("[WS] Error:", e)


if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=False)
