import os
from ultralytics import YOLO

def train_stage1(data_yaml="train/data.yaml", epochs=50, imgsz=640, batch=16):
    """
    Trains the Stage 1 model to detect the conveyor belt ROI.
    """
    print("Training Stage 1: Belt ROI Detection...")
    model = YOLO("yolov8n.pt")  # Load a pretrained YOLOv8n model
    
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        project="runs/stage1",
        name="belt_roi_model"
    )
    
    print(f"Stage 1 training complete. Best weights saved to runs/stage1/belt_roi_model/weights/best.pt")
    
    # Optionally, copy best weights to root for easy access
    os.system("cp runs/stage1/belt_roi_model/weights/best.pt best_stage1.pt")

def train_stage2(data_yaml="data/stage2_dataset/data.yaml", epochs=100, imgsz=640, batch=16):
    """
    Trains the Stage 2 model to detect damage on the cropped belt ROI.
    """
    print("Training Stage 2: Damage Detection...")
    
    if not os.path.exists(data_yaml):
        print(f"Error: Stage 2 dataset not found at {data_yaml}.")
        print("Please run crop_script.py and manually annotate the crops using PyYAT first.")
        return
        
    model = YOLO("yolov8n.pt")  # Load a pretrained YOLOv8n model
    
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        project="runs/stage2",
        name="damage_detection_model"
    )
    
    print(f"Stage 2 training complete. Best weights saved to runs/stage2/damage_detection_model/weights/best.pt")
    
    # Optionally, copy best weights to root for easy access
    os.system("cp runs/stage2/damage_detection_model/weights/best.pt best_stage2.pt")

if __name__ == "__main__":
    print("Select training stage:")
    print("1. Train Stage 1 (Belt ROI)")
    print("2. Train Stage 2 (Damage Detection)")
    
    choice = input("Enter choice (1 or 2): ")
    
    if choice == "1":
        train_stage1()
    elif choice == "2":
        train_stage2()
    else:
        print("Invalid choice.")
