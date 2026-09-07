#!/usr/bin/env python3
"""
Validation script to check if the project setup is correct.
"""

import os
import glob

def check_directories():
    """Check if required directories exist."""
    required_dirs = [
        "src/models",
        "src/utils", 
        "data/cropped_belts",
        "data/stage2_dataset",
        "train/train/images",
        "train/train/labels",
        "PyYAT-master"
    ]
    
    print("Checking directories...")
    for dir_path in required_dirs:
        if os.path.exists(dir_path):
            print(f"✓ {dir_path}")
        else:
            print(f"✗ {dir_path} - Missing!")
    
def check_files():
    """Check if required files exist."""
    required_files = [
        "pipeline.py",
        "train.py",
        "crop_script.py",
        "requirements.txt",
        "README.md",
        "src/models/base_model.py",
        "src/models/stage1_roi.py", 
        "src/models/stage2_damage.py",
        "src/utils/image_processing.py",
        "src/utils/json_formatter.py",
        "train/data.yaml",
        "data/stage2_dataset/data.yaml",
        "PyYAT-master/yolo_annotation_tool.py",
        "PyYAT-master/config.ini",
        "PyYAT-master/labels.csv",
        "PyYAT-master/USAGE_INSTRUCTIONS.md"
    ]
    
    print("\nChecking files...")
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✓ {file_path}")
        else:
            print(f"✗ {file_path} - Missing!")

def check_training_data():
    """Check if training data is available."""
    print("\nChecking training data...")
    
    # Check train images
    train_images = glob.glob("train/train/images/*.jpg")
    print(f"Training images found: {len(train_images)}")
    
    # Check train labels
    train_labels = glob.glob("train/train/labels/*.txt")
    print(f"Training labels found: {len(train_labels)}")
    
    if len(train_images) > 0 and len(train_labels) > 0:
        print("✓ Training data is available")
    else:
        print("✗ Training data is missing or incomplete")

def check_pyat_config():
    """Check PyYAT configuration."""
    print("\nChecking PyYAT configuration...")
    
    config_path = "PyYAT-master/config.ini"
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config_content = f.read()
        
        if "../data/cropped_belts/" in config_content:
            print("✓ PyYAT input directory configured correctly")
        else:
            print("✗ PyYAT input directory not configured")
            
        if "../data/stage2_dataset/" in config_content:
            print("✓ PyYAT output directory configured correctly")  
        else:
            print("✗ PyYAT output directory not configured")
    
    labels_path = "PyYAT-master/labels.csv"
    if os.path.exists(labels_path):
        with open(labels_path, 'r') as f:
            labels_content = f.read()
        
        if "scratch" in labels_content and "edge_damage" in labels_content:
            print("✓ PyYAT labels configured for damage detection")
        else:
            print("✗ PyYAT labels not configured for damage detection")

if __name__ == "__main__":
    print("=" * 50)
    print("CONVEYOR BELT DAMAGE DETECTION - SETUP VALIDATION")
    print("=" * 50)
    
    check_directories()
    check_files()
    check_training_data() 
    check_pyat_config()
    
    print("\n" + "=" * 50)
    print("NEXT STEPS:")
    print("1. Run: python crop_script.py")
    print("2. Run: cd PyYAT-master && python yolo_annotation_tool.py")
    print("3. Annotate the cropped images with 'scratch' and 'edge_damage'")
    print("4. Run: python train.py (select option 1, then option 2)")
    print("5. Run: python pipeline.py --image_dir <path> --output_dir <path>")
    print("=" * 50)