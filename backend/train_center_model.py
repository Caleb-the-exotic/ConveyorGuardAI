import sys
import time
import json
import shutil
import argparse
from pathlib import Path
from ultralytics import YOLO

def main():
    parser = argparse.ArgumentParser(description="Train YOLO model on yolo-dataset-center dataset")
    parser.add_argument("--epochs", type=int, default=5, help="Number of training epochs (default: 5)")
    parser.add_argument("--batch", type=int, default=16, help="Batch size (default: 16)")
    parser.add_argument("--imgsz", type=int, default=416, help="Image size (default: 416)")
    parser.add_argument("--workers", type=int, default=2, help="Dataloader workers (default: 2)")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Pretrained model weights")
    args = parser.parse_args()

    backend_dir = Path(__file__).resolve().parent
    dataset_dir = backend_dir / "yolo-dataset-center"
    data_yaml = dataset_dir / "data.yaml"
    runs_dir = dataset_dir / "runs"

    print("=" * 60)
    print("CONVEYORGUARD AI - YOLO CENTER MODEL TRAINING")
    print("=" * 60)
    print(f"Dataset YAML : {data_yaml}")
    print(f"Base Model   : {args.model}")
    print(f"Epochs       : {args.epochs}")
    print(f"Image Size   : {args.imgsz}")
    print(f"Batch Size   : {args.batch}")
    print(f"Workers      : {args.workers}")
    print(f"Output Dir   : {runs_dir}")
    print("=" * 60)

    if not data_yaml.exists():
        print(f"Error: {data_yaml} not found!")
        sys.exit(1)

    # Resolve pretrained model
    base_model_path = backend_dir / args.model
    model_source = str(base_model_path) if base_model_path.exists() else args.model
    print(f"[1/4] Loading base model: {model_source}...")
    model = YOLO(model_source)

    # Start training
    print(f"[2/4] Commencing model training for {args.epochs} epoch(s)...")
    start_time = time.time()

    results = model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        device="cpu",
        project=str(runs_dir),
        name="conveyor_center_exp",
        exist_ok=True,
        plots=True,
        save=True,
        verbose=True,
    )

    elapsed = time.time() - start_time
    print(f"[2/4] Training completed in {elapsed / 60:.2f} minutes ({elapsed:.1f} s).")

    # Find best model weights
    exp_dir = runs_dir / "conveyor_center_exp"
    trained_best = exp_dir / "weights" / "best.pt"
    if not trained_best.exists():
        trained_best = exp_dir / "weights" / "last.pt"

    dest_center_best = dataset_dir / "best.pt"
    dest_backend_best = backend_dir / "conveyor_center_detector.pt"

    if trained_best.exists():
        print(f"[3/4] Copying best weights ({trained_best.stat().st_size / (1024*1024):.2f} MB)...")
        shutil.copy2(str(trained_best), str(dest_center_best))
        shutil.copy2(str(trained_best), str(dest_backend_best))
        print(f" -> Saved to: {dest_center_best}")
        print(f" -> Saved to: {dest_backend_best}")

    # Evaluate on test set
    print("[4/4] Evaluating trained model on test split...")
    test_metrics = {}
    try:
        val_model = YOLO(str(dest_center_best if dest_center_best.exists() else trained_best))
        val_res = val_model.val(data=str(data_yaml), split="test", imgsz=args.imgsz, workers=args.workers)
        test_metrics = {
            "mAP50": float(val_res.box.map50) if hasattr(val_res, "box") else None,
            "mAP50-95": float(val_res.box.map) if hasattr(val_res, "box") else None,
            "precision": float(val_res.box.mp) if hasattr(val_res, "box") else None,
            "recall": float(val_res.box.mr) if hasattr(val_res, "box") else None,
        }
        print("Test Evaluation Metrics:")
        for k, v in test_metrics.items():
            if v is not None:
                print(f" - {k}: {v:.4f}")
    except Exception as e:
        print(f"Warning: Test evaluation skipped with notice: {e}")

    # Save summary report
    summary = {
        "dataset": "yolo-dataset-center",
        "base_model": args.model,
        "epochs": args.epochs,
        "imgsz": args.imgsz,
        "batch_size": args.batch,
        "duration_seconds": round(elapsed, 1),
        "best_weights": str(dest_center_best),
        "metrics": test_metrics,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    summary_path = dataset_dir / "training_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print("=" * 60)
    print(f"SUCCESS: Model trained and saved to {dest_center_best}!")
    print(f"Training Summary saved to: {summary_path}")
    print("=" * 60)

if __name__ == "__main__":
    main()
