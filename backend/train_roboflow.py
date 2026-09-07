import os
import shutil
from pathlib import Path
from ultralytics import YOLO

def main():
    print("=== Conveyor Belt Damage Model Training ===")
    dataset_yaml = Path(__file__).resolve().parent / "Roboflow Conveyor belt damage" / "data.yaml"
    print(f"Dataset YAML: {dataset_yaml}")
    
    # Load base pretrained model (YOLOv8 nano for fast and accurate CPU training)
    print("Loading base YOLOv8n model...")
    model = YOLO("yolov8n.pt")
    
    # Train model
    print("Starting training on dataset...")
    results = model.train(
        data=str(dataset_yaml),
        epochs=15,          # 15 epochs for rapid convergence on CPU
        imgsz=640,
        batch=16,
        device="cpu",
        workers=2,
        project="runs_conveyor",
        name="roboflow_damage",
        exist_ok=True,
    )
    
    # Copy best.pt to backend/
    save_dir = Path(results.save_dir)
    best_weight = save_dir / "weights" / "best.pt"
    dest_weight = Path(__file__).resolve().parent / "roboflow_conveyor_damage.pt"
    
    if best_weight.exists():
        shutil.copy(best_weight, dest_weight)
        print(f"\n[SUCCESS] Model training complete!")
        print(f"[SUCCESS] Best weights saved to: {dest_weight}")
    else:
        print(f"\n[WARNING] Could not locate {best_weight}")

if __name__ == "__main__":
    main()
