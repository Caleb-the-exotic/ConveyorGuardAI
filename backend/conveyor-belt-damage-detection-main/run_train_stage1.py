import sys
sys.path.insert(0, r"C:\Users\Aarthy\Desktop\project-refine-main\backend\conveyor-belt-damage-detection-main")

from train import train_stage1

train_stage1(
    data_yaml="train/data.yaml",
    epochs=50,
    imgsz=640,
    batch=16
)
