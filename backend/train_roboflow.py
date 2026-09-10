import os
import sys
import shutil
import urllib.request
from pathlib import Path
import torch
from ultralytics import YOLO

def download_file_safe(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=15) as response, open(dest, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
        return True
    except Exception as e:
        print(f"[Download] Notice: Could not fetch from {url} ({e})")
        return False

def main():
    print("=" * 60)
    print("   CONVEYOR BELT CRACK & DAMAGE DETECTION MODEL TRAINING   ")
    print("=" * 60)
    
    backend_dir = Path(__file__).resolve().parent
    dataset_yaml = backend_dir / "Roboflow Conveyor belt damage" / "data.yaml"
    print(f"[Dataset] YAML Path: {dataset_yaml}")
    
    # Auto-detect GPU or CPU
    device = "0" if torch.cuda.is_available() else "cpu"
    print(f"[Hardware] Training device: {device} (CUDA available: {torch.cuda.is_available()})")
    
    # Prepare model backbone
    model_weight_path = backend_dir / "yolov8n.pt"
    if not model_weight_path.exists():
        print("[Model] Checking HuggingFace mirror for pretrained backbone...")
        hf_url = "https://huggingface.co/Ultralytics/YOLOv8/resolve/main/yolov8n.pt"
        download_file_safe(hf_url, model_weight_path)
    
    if model_weight_path.exists() and model_weight_path.stat().st_size > 1000000:
        print(f"[Model] Initializing with pretrained weights: {model_weight_path.name}")
        model = YOLO(str(model_weight_path))
    else:
        print("[Model] Initializing YOLOv8n architecture directly from YAML...")
        model = YOLO("yolov8n.yaml")
    
    # Train model on conveyor belt defect dataset
    print("[Training] Starting training on conveyor belt defect dataset...")
    results = model.train(
        data=str(dataset_yaml),
        epochs=10,
        imgsz=512,
        batch=8,
        device=device,
        workers=0,  # 0 avoids Windows multiprocessing spawning issues
        project=str(backend_dir / "runs_conveyor"),
        name="roboflow_damage",
        exist_ok=True,
        fliplr=0.5,
        flipud=0.5,
        mosaic=0.5,
        verbose=True,
    )
    
    # Copy best.pt to backend model paths
    save_dir = Path(results.save_dir)
    best_weight = save_dir / "weights" / "best.pt"
    last_weight = save_dir / "weights" / "last.pt"
    
    chosen_weight = best_weight if best_weight.exists() else last_weight
    
    dest_weight = backend_dir / "roboflow_conveyor_damage.pt"
    dest_crack_weight = backend_dir / "conveyor_crack_detector.pt"
    
    if chosen_weight.exists():
        shutil.copy(chosen_weight, dest_weight)
        shutil.copy(chosen_weight, dest_crack_weight)
        print("\n" + "=" * 60)
        print("[SUCCESS] Model training complete!")
        print(f"[SUCCESS] Best weights deployed to: {dest_weight}")
        print(f"[SUCCESS] Crack detector deployed to: {dest_crack_weight}")
        print("=" * 60)
    else:
        print(f"\n[WARNING] Could not locate weights in {save_dir}")

if __name__ == "__main__":
    main()
